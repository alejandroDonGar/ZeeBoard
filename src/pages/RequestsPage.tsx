import { useEffect, useState } from "react";
import {
  addRequest,
  appSettings,
  createClient,
  createCommission,
  deleteRequest,
  getClients,
  getRequests,
  getTemplates,
  importRequests,
  setClientEmail,
  setRequestStatus,
  setRequestTemplate,
  updateSettings,
  type CommissionRequest,
  type Template,
} from "../lib/database";
import { calculateCommissionPrice, formatMoney, loadOpenCommissions } from "../lib/commissionHelpers";
import { normalizeHandle, parseResponses } from "../lib/formImport";
import { hide } from "../lib/privacy";
import { Segmented } from "../components/BoardFilters";
import ConfirmModal from "../components/ConfirmModal";
import PageHeader from "../components/PageHeader";
import { useToast } from "../context/ToastContext";

const PLATFORMS = ["Twitter / X", "Bluesky", "Discord", "Telegram", "Email", "Other"];

type Draft = { name: string; platform: string; contact: string; template_id: number | null; characters: number; details: string };
const emptyDraft: Draft = { name: "", platform: "Twitter / X", contact: "", template_id: null, characters: 1, details: "" };

const dateFormatter = new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short" });

function RequestsPage({ onOpenCommissionsPage }: { onOpenCommissionsPage: () => void }) {
  const [requests, setRequests] = useState<CommissionRequest[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [taken, setTaken] = useState(0);
  const [settings, setSettings] = useState(appSettings());
  const [draft, setDraft] = useState<Draft | null>(null);
  const [showArchive, setShowArchive] = useState(false);
  const [confirmAccept, setConfirmAccept] = useState<CommissionRequest | null>(null);
  const [busy, setBusy] = useState(false);
  const { showToast } = useToast();

  async function load() {
    const [requestList, templateList, open] = await Promise.all([getRequests(), getTemplates(), loadOpenCommissions()]);
    setRequests(requestList);
    setTemplates(templateList);
    setTaken(open.length);
  }

  useEffect(() => {
    load().catch(console.error);
  }, []);

  async function saveSlots(changes: Parameters<typeof updateSettings>[0]) {
    await updateSettings(changes);
    setSettings({ ...appSettings() });
  }

  async function run(action: () => Promise<void>, errorPrefix: string) {
    try {
      setBusy(true);
      await action();
      await load();
    } catch (error) {
      console.error(error);
      showToast(`${errorPrefix}: ${error instanceof Error ? error.message : error}`, "error");
    } finally {
      setBusy(false);
    }
  }

  function startAccept(request: CommissionRequest) {
    // Con las plazas llenas se pide confirmación: aceptar de más es una decisión, no un descuido
    if (settings.slots_total > 0 && taken >= settings.slots_total) {
      setConfirmAccept(request);
    } else {
      accept(request);
    }
  }

  /** Crea el cliente (o reutiliza el que tenga ese nombre) y la comisión, y la abre. */
  async function accept(request: CommissionRequest) {
    setConfirmAccept(null);

    try {
      setBusy(true);

      const clients = await getClients();
      const handle = normalizeHandle(request.contact);
      // Un cliente que ya tienes: por su usuario (lo más fiable) o, si no, por el nombre
      const existing =
        clients.find((client) => handle !== "" && normalizeHandle(client.handle) === handle) ??
        clients.find((client) => client.name.trim().toLowerCase() === request.name.trim().toLowerCase());
      const platform = existing?.platform || request.platform || "Other";
      const clientId = existing?.id ?? (await createClient(request.name, platform, request.contact ?? "", ""));

      if (request.email) {
        await setClientEmail(clientId, request.email);
      }

      const template = templates.find((item) => item.id === request.template_id);
      const price =
        template?.base_price != null
          ? calculateCommissionPrice(template.base_price, request.characters, settings.extra_character_rate)
          : null;

      // El título es el tipo, sin el nombre del cliente: así no se cuela en un directo con el modo privado
      const commissionId = await createCommission(
        template?.name ?? "New commission",
        clientId,
        request.name,
        platform,
        request.template_id,
        price,
        settings.default_currency,
        null,
        request.details ?? "",
      );

      await setRequestStatus(request.id, "accepted", commissionId);
      localStorage.setItem("zeeboard-active-commission-id", String(commissionId));
      showToast("Commission created. Edit it to rename it and link the characters.", "success");
      onOpenCommissionsPage();
    } catch (error) {
      console.error(error);
      showToast(`Could not accept: ${error instanceof Error ? error.message : error}`, "error");
      setBusy(false);
    }
  }

  async function handleImport(file: File | undefined) {
    if (!file) {
      return;
    }

    try {
      setBusy(true);
      const { requests: parsed, error } = parseResponses(await file.text(), templates);

      if (error) {
        showToast(error, "error");
        return;
      }

      const { added, skipped } = await importRequests(parsed);
      await load();
      showToast(
        added === 0 ? "No new responses: everything in that file was already imported." : `Imported ${added} new ${added === 1 ? "request" : "requests"}${skipped > 0 ? ` (${skipped} already there)` : ""}.`,
        "success",
      );
    } catch (error) {
      console.error(error);
      showToast(`Could not import: ${error instanceof Error ? error.message : error}`, "error");
    } finally {
      setBusy(false);
    }
  }

  async function handleAdd() {
    if (!draft) {
      return;
    }

    if (!draft.name.trim() || draft.template_id === null) {
      showToast("A request needs a name and a type.", "error");
      return;
    }

    await run(async () => {
      await addRequest({ ...draft, contact: draft.contact, platform: draft.platform });
      setDraft(null);
    }, "Could not add the request");
  }

  const waiting = requests.filter((request) => request.status === "new");
  const waitlist = requests.filter((request) => request.status === "waitlist");
  const archive = requests.filter((request) => request.status === "accepted" || request.status === "declined").reverse();
  const free = settings.slots_total - taken;

  const panel = "divide-y divide-line rounded-3xl border border-line bg-surface shadow-sm";
  const heading = "mb-2 text-[11px] font-black uppercase tracking-[0.16em] text-faint";
  const ghost =
    "rounded-md border border-line-strong px-3 py-1.5 text-xs font-semibold text-ink transition hover:border-ink disabled:opacity-50";
  const field = "w-full rounded-md border border-line-strong bg-paper px-3 py-2 text-sm outline-none focus:border-ink";

  function renderRequest(request: CommissionRequest) {
    const template = templates.find((item) => item.id === request.template_id);
    const estimate =
      template?.base_price != null
        ? formatMoney(calculateCommissionPrice(template.base_price, request.characters, settings.extra_character_rate), settings.default_currency)
        : null;
    const archived = request.status === "accepted" || request.status === "declined";

    return (
      <div key={request.id} className="flex items-start gap-4 px-5 py-4">
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-baseline gap-x-2">
            <span className="font-bold">{hide(request.name)}</span>
            <span className="text-sm text-muted">
              {[request.platform, request.contact && hide(request.contact)].filter(Boolean).join(" · ")}
            </span>
            <span className="text-xs text-faint">{dateFormatter.format(new Date(request.created_at))}</span>
          </p>

          <p className="mt-0.5 text-sm">
            {template ? (
              template.name
            ) : (
              <select
                value=""
                onChange={(event) =>
                  run(() => setRequestTemplate(request.id, Number(event.target.value)), "Could not set the type")
                }
                className="rounded-md border border-amber-400 bg-amber-100 px-2 py-0.5 text-sm font-semibold text-amber-900"
              >
                <option value="">Choose the type…</option>
                {templates.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            )}{" "}
            · {request.characters} {request.characters === 1 ? "character" : "characters"}
            {estimate && <span className="text-muted"> · ≈ {estimate}</span>}
            {request.email && <span className="text-muted"> · {hide(request.email)}</span>}
          </p>

          {request.details && <p className="mt-1 line-clamp-2 whitespace-pre-wrap text-sm text-muted">{request.details}</p>}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {request.status === "accepted" && (
            <span className="rounded-sm bg-green-50 px-2 py-0.5 text-xs font-bold text-green-700">Accepted</span>
          )}
          {request.status === "declined" && (
            <span className="rounded-sm bg-highlight px-2 py-0.5 text-xs font-bold text-muted">Declined</span>
          )}

          {(request.status === "new" || request.status === "waitlist") && (
            <>
              <button
                type="button"
                onClick={() => startAccept(request)}
                disabled={busy || request.template_id === null}
                title={request.template_id === null ? "Choose the type first" : undefined}
                className="rounded-md bg-primary px-3 py-1.5 text-xs font-bold text-on-primary transition hover:bg-primary-hover disabled:opacity-50"
              >
                Accept
              </button>
              {request.status === "new" && (
                <button type="button" onClick={() => run(() => setRequestStatus(request.id, "waitlist"), "Could not move it")} disabled={busy} className={ghost}>
                  Waitlist
                </button>
              )}
              <button type="button" onClick={() => run(() => setRequestStatus(request.id, "declined"), "Could not decline")} disabled={busy} className={ghost}>
                Decline
              </button>
            </>
          )}

          {request.status === "declined" && (
            <button type="button" onClick={() => run(() => setRequestStatus(request.id, "new"), "Could not restore")} disabled={busy} className={ghost}>
              Restore
            </button>
          )}

          {request.status === "accepted" && request.commission_id !== null && (
            <button
              type="button"
              onClick={() => {
                localStorage.setItem("zeeboard-active-commission-id", String(request.commission_id));
                onOpenCommissionsPage();
              }}
              className={ghost}
            >
              Open
            </button>
          )}

          {archived && (
            <button
              type="button"
              title="Remove from the list"
              onClick={() => run(() => deleteRequest(request.id), "Could not remove it")}
              className="px-1 text-faint transition hover:text-red-500"
            >
              ×
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <>
      <PageHeader
        label="Intake"
        title="Requests"
        description="People who want a commission: accept them, keep them waiting, or decline."
        action="+ New request"
        onAction={() => setDraft({ ...emptyDraft })}
      />

      <section className="h-[calc(100vh-117px)] overflow-y-auto p-5 pb-10">
        <div className="mx-auto max-w-3xl space-y-8">
          <div className={panel}>
            <div className="flex items-center gap-4 px-5 py-4">
              <div className="flex-1">
                <p className="font-semibold">Open for commissions</p>
                <p className="text-sm text-muted">Opening or closing your form is still up to you; this keeps count.</p>
              </div>
              <Segmented
                options={[
                  { value: "closed", label: "Closed" },
                  { value: "open", label: "Open" },
                ]}
                value={settings.slots_open ? "open" : "closed"}
                onChange={(value) => saveSlots({ slots_open: value === "open" }).catch(console.error)}
              />
            </div>

            <div className="flex items-center gap-4 px-5 py-4">
              <div className="flex-1">
                <p className="font-semibold">
                  {taken} of {settings.slots_total} slots taken
                  <span className={`ml-2 text-sm font-normal ${free < 0 ? "text-red-500" : "text-muted"}`}>
                    {free > 0 ? `${free} free` : free === 0 ? "full" : `${-free} over`}
                  </span>
                </p>
                <div className="mt-2 flex flex-wrap gap-1">
                  {Array.from({ length: Math.max(settings.slots_total, taken) }, (_, index) => (
                    <span
                      key={index}
                      className={`h-3 w-5 rounded-sm ${
                        index >= settings.slots_total ? "bg-red-400" : index < taken ? "bg-primary" : "border border-line-strong"
                      }`}
                    />
                  ))}
                </div>
                <p className="mt-1.5 text-xs text-faint">Every commission that isn't finished takes a slot, including the ones in the queue.</p>
              </div>
              <label className="flex items-center gap-1.5 text-sm font-semibold">
                <input
                  type="number"
                  min={1}
                  value={settings.slots_total}
                  onChange={(event) => saveSlots({ slots_total: Math.max(1, Math.round(Number(event.target.value)) || 1) }).catch(console.error)}
                  className="w-16 rounded-md border border-line-strong bg-paper px-2 py-1.5 text-right font-bold outline-none focus:border-ink"
                />
                slots
              </label>
            </div>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-[11px] font-black uppercase tracking-[0.16em] text-faint">New · {waiting.length}</h3>

              <label className={`${ghost} cursor-pointer ${busy ? "pointer-events-none opacity-50" : ""}`}>
                Import responses…
                <input
                  type="file"
                  accept=".csv,text/csv"
                  className="hidden"
                  onChange={(event) => {
                    handleImport(event.target.files?.[0]);
                    // Permite elegir el mismo archivo otra vez
                    event.target.value = "";
                  }}
                />
              </label>
            </div>
            {waiting.length === 0 ? (
              <p className="rounded-3xl border border-dashed border-line-strong px-5 py-6 text-center text-sm text-faint">
                No new requests. Add one with "+ New request".
              </p>
            ) : (
              <div className={panel}>{waiting.map(renderRequest)}</div>
            )}
          </div>

          {waitlist.length > 0 && (
            <div>
              <h3 className={heading}>Waitlist · {waitlist.length}</h3>
              <div className={panel}>{waitlist.map(renderRequest)}</div>
              {free > 0 && (
                <p className="mt-2 text-sm text-muted">
                  You have {free} free {free === 1 ? "slot" : "slots"}: time to take someone from the waitlist.
                </p>
              )}
            </div>
          )}

          {archive.length > 0 && (
            <div>
              <button
                type="button"
                onClick={() => setShowArchive((open) => !open)}
                className={`${heading} transition hover:text-ink`}
              >
                Archive · {archive.length} {showArchive ? "▴" : "▾"}
              </button>
              {showArchive && <div className={panel}>{archive.map(renderRequest)}</div>}
            </div>
          )}
        </div>
      </section>

      {draft && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
          <div className="w-[520px] max-w-[94vw] rounded-3xl border border-line bg-surface p-6 shadow-2xl">
            <h3 className="text-xl font-black">New request</h3>

            <div className="mt-5 space-y-3">
              <input
                autoFocus
                data-private
                value={draft.name}
                onChange={(event) => setDraft({ ...draft, name: event.target.value })}
                placeholder="Name"
                className={field}
              />

              <div className="grid grid-cols-[150px_minmax(0,1fr)] gap-3">
                <select value={draft.platform} onChange={(event) => setDraft({ ...draft, platform: event.target.value })} className={field}>
                  {PLATFORMS.map((platform) => (
                    <option key={platform}>{platform}</option>
                  ))}
                </select>
                <input
                  data-private
                  value={draft.contact}
                  onChange={(event) => setDraft({ ...draft, contact: event.target.value })}
                  placeholder="@username or email"
                  className={field}
                />
              </div>

              <div className="grid grid-cols-[minmax(0,1fr)_120px] gap-3">
                <select
                  value={draft.template_id ?? ""}
                  onChange={(event) => setDraft({ ...draft, template_id: event.target.value ? Number(event.target.value) : null })}
                  className={field}
                >
                  <option value="">Type of commission</option>
                  {templates.map((template) => (
                    <option key={template.id} value={template.id}>
                      {template.name}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  min={1}
                  value={draft.characters}
                  onChange={(event) => setDraft({ ...draft, characters: Math.max(1, Math.round(Number(event.target.value)) || 1) })}
                  title="Number of characters"
                  className={field}
                />
              </div>

              <textarea
                value={draft.details}
                onChange={(event) => setDraft({ ...draft, details: event.target.value })}
                placeholder="What they asked for: idea, references, links…"
                rows={4}
                className={field}
              />
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button type="button" onClick={() => setDraft(null)} className="rounded-md px-4 py-2 text-sm font-semibold text-muted hover:text-ink">
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAdd}
                disabled={busy || !draft.name.trim() || draft.template_id === null}
                className="rounded-md bg-primary px-4 py-2 text-sm font-bold text-on-primary transition hover:bg-primary-hover disabled:opacity-50"
              >
                Add request
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmAccept && (
        <ConfirmModal
          eyebrow="Slots are full"
          title={`Accept ${hide(confirmAccept.name)} anyway?`}
          message={`You have ${taken} of ${settings.slots_total} slots taken. Accepting adds one more. You can also send them to the waitlist instead.`}
          confirmLabel="Accept anyway"
          confirmVariant="primary"
          onConfirm={() => accept(confirmAccept)}
          onCancel={() => setConfirmAccept(null)}
        />
      )}
    </>
  );
}

export default RequestsPage;
