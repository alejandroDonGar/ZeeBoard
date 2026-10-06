import { useEffect, useState } from "react";
import { imageUrl, thumbUrl, importImage, pickImagePaths } from "../lib/images";
import { useImageInput } from "../lib/useImageInput";
import {
  loadStageImagesForCommissions as loadStageImagesForCommissionsHelper,
  getCommissionCompletionPercentage as getCommissionCompletionPercentageHelper,
  isCommissionCompleted as isCommissionCompletedHelper,
} from "../lib/commissionHelpers";
import {
  getTemplateStages,
  getCommissions,
  getCommissionTags,
  getClients,
  createClient,
  deleteClient,
  updateClient,
  updateClientAvatar,
  getClientCharacters,
  createClientCharacter,
  getCharacterReferences,
  createCharacterReference,
  deleteCharacterReference,
  getCommissionCharacterIds,
  type ClientCharacter,
  type CharacterReference,
  type CommissionStageImage,
  type Client,
  type Tag,
  type Commission,
  type TemplateStage,
} from "../lib/database";
import PageHeader from "../components/PageHeader";
import ConfirmModal from "../components/ConfirmModal";
import { useToast } from "../context/ToastContext";

function ClientsPage({
  onOpenCommissionsPage,
}: {
  onOpenCommissionsPage: () => void;
}) {
  const [clients, setClients] = useState<Client[]>([]);
  const [commissions, setCommissions] = useState<Commission[]>([]);
  const [commissionTagsById, setCommissionTagsById] = useState<Record<number, Tag[]>>({});
  const [clientName, setClientName] = useState("");
  const [clientPlatform, setClientPlatform] = useState("Twitter / X");
  const [clientHandle, setClientHandle] = useState("");
  const [clientNotes, setClientNotes] = useState("");
  // null = cerrado, "new" = crear, Client = editar
  const [clientForm, setClientForm] = useState<Client | "new" | null>(null);
  const [clientSearch, setClientSearch] = useState("");
  const [clientToDelete, setClientToDelete] = useState<Client | null>(null);
  const [savingClient, setSavingClient] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState<number | null>(null);
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);
  const [importingCharacterId, setImportingCharacterId] = useState<number | null>(null);
  const [stageImagesByCommissionId, setStageImagesByCommissionId] = useState<Record<number, CommissionStageImage[]>>({});
  const [templateStagesByTemplateId, setTemplateStagesByTemplateId] = useState<Record<number, TemplateStage[]>>({});
  const [charactersByClientId, setCharactersByClientId] = useState<Record<number, ClientCharacter[]>>({});
  const [referencesByCharacterId, setReferencesByCharacterId] = useState<Record<number, CharacterReference[]>>({});
  const [commissionCharactersById, setCommissionCharactersById] = useState<Record<number, number[]>>({});
  const [expandedCharacterId, setExpandedCharacterId] = useState<number | null>(null);
  const [newCharacterName, setNewCharacterName] = useState("");
  const [newCharacterNotes, setNewCharacterNotes] = useState("");
  const { showToast } = useToast();

  async function loadClients() {
    const data = await getClients();
    setClients(data);
    return data;
  }

  const selectedClient = clients.find((client) => client.id === selectedClientId) ?? null;

  function closeClientForm() {
    setClientForm(null);
    setClientName("");
    setClientPlatform("Twitter / X");
    setClientHandle("");
    setClientNotes("");
  }

  function handleOpenNewClient() {
    closeClientForm();
    setClientForm("new");
  }

  async function handleCreateClient() {
    try {
      setSavingClient(true);

      await createClient(
        clientName,
        clientPlatform,
        clientHandle,
        clientNotes,
      );

      const avatarUrl = await fetchBlueskyAvatar(clientPlatform, clientHandle);

      if (avatarUrl) {
        const data = await getClients();
        const createdClient = data.find(
          (client) =>
            client.name === clientName.trim() &&
            client.handle === clientHandle.trim(),
        );

        if (createdClient) {
          await updateClientAvatar(createdClient.id, avatarUrl);
        }
      }

      closeClientForm();

      // El cliente nuevo es el de id más alto: se abre su ficha
      const data = await loadClients();
      setSelectedClientId(Math.max(...data.map((client) => client.id)));
    } catch (error) {
      console.error(error);
      showToast("Could not create client.", "error");
    } finally {
      setSavingClient(false);
    }
  }

    async function handleDeleteClient(clientId: number) {
    try {
        await deleteClient(clientId);
        await loadClients();
        setSelectedClientId(null);
        showToast("Client deleted.", "success");
    } catch (error) {
        console.error(error);
        showToast("Could not delete client.", "error");
    }
    }

  async function loadClientCommissionTags(data: Commission[]) {
    const entries = await Promise.all(
      data.map(async (commission) => {
        const tags = await getCommissionTags(commission.id);
        return [commission.id, tags] as const;
      }),
    );

    setCommissionTagsById(Object.fromEntries(entries));
  }

  async function loadStageImagesForCommissions(data: Commission[]) {
    setStageImagesByCommissionId(await loadStageImagesForCommissionsHelper(data));
  }

  async function loadCharactersForCommissions(data: Commission[]) {
    const entries = await Promise.all(
      data.map(async (commission) => {
        const characterIds = await getCommissionCharacterIds(commission.id);
        return [commission.id, characterIds] as const;
      }),
    );

    setCommissionCharactersById(Object.fromEntries(entries));
  }

  async function loadReferencesForCharacters(
    charactersByClient: Record<number, ClientCharacter[]>,
  ) {
    const allCharacters = Object.values(charactersByClient).flat();

    const entries = await Promise.all(
      allCharacters.map(async (character) => {
        const refs = await getCharacterReferences(character.id);
        return [character.id, refs] as const;
      }),
    );

    setReferencesByCharacterId(Object.fromEntries(entries));

  }

  useEffect(() => {
    (async () => {
      const data = await getClients();

      setClients(data);
      // Se abre la ficha del primer cliente por orden alfabético
      setSelectedClientId(
        [...data].sort((a, b) => a.name.localeCompare(b.name))[0]?.id ?? null,
      );

      const characterEntries = await Promise.all(
        data.map(async (client) => {
          const characters = await getClientCharacters(client.id);
          return [client.id, characters] as const;
        }),
      );

      const nextCharactersByClientId = Object.fromEntries(characterEntries);

      setCharactersByClientId(nextCharactersByClientId);

      await loadReferencesForCharacters(nextCharactersByClientId);
    })();

    getCommissions()
      .then(async (data) => {
        setCommissions(data);
        await loadClientCommissionTags(data);
        await loadStageImagesForCommissions(data);
        await loadCharactersForCommissions(data);

        const templateIds = Array.from(
          new Set(
            data
              .map((commission) => commission.template_id)
              .filter((templateId): templateId is number => templateId !== null),
          ),
        );

        const entries = await Promise.all(
          templateIds.map(async (templateId) => {
            const stages = await getTemplateStages(templateId);
            return [templateId, stages] as const;
          }),
        );

        setTemplateStagesByTemplateId(Object.fromEntries(entries));
      })
      .catch(console.error);
  }, []);

  function handleOpenEditClient(client: Client) {
    setClientForm(client);
    setClientName(client.name);
    setClientPlatform(client.platform || "Twitter / X");
    setClientHandle(client.handle || "");
    setClientNotes(client.notes || "");
  }

  async function handleSaveClientChanges() {
    if (!clientForm || clientForm === "new") {
      return;
    }

    try {
      setSavingClient(true);

      await updateClient(
        clientForm.id,
        clientName,
        clientPlatform,
        clientHandle,
        clientNotes,
      );

      closeClientForm();
      await loadClients();
    } catch (error) {
    console.error(error);
    showToast("Could not save client changes.", "error");
    } finally {
      setSavingClient(false);
    }
  }

  function getClientInitials(name: string) {
    const words = name.trim().split(/\s+/).filter(Boolean);

    if (words.length === 0) {
      return "?";
    }

    if (words.length === 1) {
      return words[0].slice(0, 2).toUpperCase();
    }

    return `${words[0][0]}${words[1][0]}`.toUpperCase();
  }

  function getClientAvatarBackground(name: string) {
    const colours = [
      "bg-primary",
      "bg-[#7c3aed]",
      "bg-[#0891b2]",
      "bg-[#16a34a]",
      "bg-[#f59e0b]",
      "bg-[#dc2626]",
    ];

    const total = name
      .split("")
      .reduce((sum, letter) => sum + letter.charCodeAt(0), 0);

    return colours[total % colours.length];
  }

  function cleanBlueskyHandle(handle: string) {
    return handle.trim().replace(/^@/, "");
  }

  async function fetchBlueskyAvatar(platform: string | null, handle: string | null) {
    if (platform !== "Bluesky" || !handle) {
      return null;
    }

    const cleanHandle = cleanBlueskyHandle(handle);

    const response = await fetch(
      `https://public.api.bsky.app/xrpc/app.bsky.actor.getProfile?actor=${encodeURIComponent(
        cleanHandle,
      )}`,
    );

    if (!response.ok) {
      return null;
    }

    const profile = await response.json();

    return profile.avatar || null;
  }

  async function handleFetchClientAvatar(client: Client) {
    try {
      const avatarUrl = await fetchBlueskyAvatar(client.platform, client.handle);

      await updateClientAvatar(client.id, avatarUrl);

      await loadClients();
    } catch (error) {
      console.error(error);
    }
  }

  async function handleCreateCharacter() {
    if (!selectedClient) {
      return;
    }

    await createClientCharacter(
      selectedClient.id,
      newCharacterName,
      newCharacterNotes,
    );

    const updatedCharacters =
      await getClientCharacters(selectedClient.id);

    setCharactersByClientId((current) => ({
      ...current,
      [selectedClient.id]: updatedCharacters,
    }));

    setNewCharacterName("");
    setNewCharacterNotes("");
  }

  /** Sin `sources` abre el selector; con ellas, vienen de arrastrar y soltar o de Ctrl+V. */
  async function handleAddCharacterReferences(characterId: number, sources?: (string | File)[]) {
    if (importingCharacterId !== null) {
      return;
    }

    const items = sources ?? (await pickImagePaths());

    if (items.length === 0) {
      return;
    }

    setImportingCharacterId(characterId);

    try {
      for (const item of items) {
        const stored = await importImage(item);
        await createCharacterReference(characterId, stored.path);
      }
    } catch (error) {
      console.error(error);
      showToast(`Could not add reference image: ${error}`, "error");
    } finally {
      setImportingCharacterId(null);
    }

    const updatedReferences = await getCharacterReferences(characterId);

    setReferencesByCharacterId((current) => ({
      ...current,
      [characterId]: updatedReferences,
    }));
  }

  const dragZoneId = useImageInput({
    onDrop: (zoneId, paths) => {
      const [kind, characterId] = zoneId.split(":");

      if (kind === "character") {
        handleAddCharacterReferences(Number(characterId), paths);
      }
    },
    // Ctrl+V añade la imagen al personaje desplegado en la ficha del cliente
    onPaste: (files) => {
      if (selectedClient && expandedCharacterId !== null) {
        handleAddCharacterReferences(expandedCharacterId, files);
      }
    },
  });

  async function handleDeleteCharacterReference(
    characterId: number,
    referenceId: number,
  ) {
    await deleteCharacterReference(referenceId);

    const updatedReferences =
      await getCharacterReferences(characterId);

    setReferencesByCharacterId((current) => ({
      ...current,
      [characterId]: updatedReferences,
    }));
  }

  const selectedClientCommissions = selectedClient
    ? commissions.filter(
        (commission) => commission.client_id === selectedClient.id,
      )
    : [];

  const completedCommissions = selectedClientCommissions.filter(
    isCommissionCompleted,
  );

  const activeCommissions = selectedClientCommissions.filter(
    (commission) => !isCommissionCompleted(commission),
  );

  const totalSpent = selectedClientCommissions.reduce(
    (sum, commission) => sum + (commission.price ?? 0),
    0,
  );

  const totalEarned = selectedClientCommissions.reduce(
    (total, commission) => total + (commission.price || 0),
    0,
  );

  const commissionsWithPrice = selectedClientCommissions.filter(
    (commission) => commission.price !== null,
  );

  const averagePrice =
    commissionsWithPrice.length > 0
      ? Math.round(totalEarned / commissionsWithPrice.length)
      : 0;

  const paidCommissionsCount = selectedClientCommissions.filter((commission) =>
    (commissionTagsById[commission.id] ?? []).some(
      (tag) =>
        tag.category === "Payment" &&
        tag.name.trim().toLowerCase() === "paid",
    ),
  ).length;

  const unpaidCommissionsCount = selectedClientCommissions.filter((commission) =>
    (commissionTagsById[commission.id] ?? []).some(
      (tag) =>
        tag.category === "Payment" &&
        tag.name.trim().toLowerCase() === "not paid",
    ),
  ).length;

  function handleOpenCommissionFromClient(commission: Commission) {
    localStorage.setItem(
      "zeeboard-open-commission-tabs",
      JSON.stringify([commission.id]),
    );

    localStorage.setItem(
      "zeeboard-active-commission-id",
      String(commission.id),
    );

    onOpenCommissionsPage();
  }

  function getCommissionCompletionPercentage(commission: Commission) {
    return getCommissionCompletionPercentageHelper(commission, templateStagesByTemplateId);
  }

  function isCommissionCompleted(commission: Commission) {
    return isCommissionCompletedHelper(commission, templateStagesByTemplateId);
  }

  const visibleClients = [...clients]
    .filter((client) =>
      `${client.name} ${client.handle ?? ""}`.toLowerCase().includes(clientSearch.trim().toLowerCase()),
    )
    .sort((a, b) => a.name.localeCompare(b.name));

  function renderAvatar(client: Client, size: "sm" | "lg") {
    const sizeClass = size === "sm" ? "h-9 w-9 text-xs" : "h-14 w-14 text-base";

    return client.avatar_url ? (
      <img
        src={client.avatar_url}
        alt={client.name}
        className={`${sizeClass} shrink-0 rounded-full object-cover`}
      />
    ) : (
      <div
        className={`${sizeClass} flex shrink-0 items-center justify-center rounded-full font-black text-white ${getClientAvatarBackground(
          client.name,
        )}`}
      >
        {getClientInitials(client.name)}
      </div>
    );
  }

  return (
    <>
      <PageHeader
        label="Client database"
        title="Clients"
        description="Your clients, their characters and their commissions."
        action="+ New client"
        onAction={handleOpenNewClient}
      />

      <section className="grid h-[calc(100vh-117px)] min-h-0 grid-cols-[280px_minmax(0,1fr)] gap-5 overflow-hidden p-5 pb-6">
        <div className="flex min-h-0 flex-col rounded-3xl border border-line bg-surface p-3 shadow-sm">
          <input
            value={clientSearch}
            onChange={(event) => setClientSearch(event.target.value)}
            placeholder="Search clients…"
            className="mb-2 rounded-md border border-line-strong bg-paper px-3 py-2 text-sm"
          />

          <div className="min-h-0 flex-1 space-y-0.5 overflow-y-auto">
            {visibleClients.length === 0 ? (
              <p className="p-4 text-center text-sm text-faint">
                {clients.length === 0 ? "No clients yet" : "No matches"}
              </p>
            ) : (
              visibleClients.map((client) => {
                const commissionCount = commissions.filter(
                  (commission) => commission.client_id === client.id,
                ).length;

                return (
                  <button
                    key={client.id}
                    type="button"
                    onClick={() => setSelectedClientId(client.id)}
                    className={`flex w-full items-center gap-3 rounded-md px-2 py-2 text-left transition ${
                      client.id === selectedClientId ? "bg-highlight" : "hover:bg-paper"
                    }`}
                  >
                    {renderAvatar(client, "sm")}

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold">{client.name}</p>
                      <p className="truncate text-xs text-faint">
                        {client.handle || client.platform || "No contact"}
                      </p>
                    </div>

                    {commissionCount > 0 && (
                      <span className="text-xs font-semibold text-faint">{commissionCount}</span>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>

        <div className="min-h-0 overflow-y-auto rounded-3xl border border-line bg-surface p-6 shadow-sm">
          {!selectedClient ? (
            <div className="flex h-full flex-col items-center justify-center text-center">
              <p className="text-lg font-black">
                {clients.length === 0 ? "Add your first client" : "Pick a client"}
              </p>
              <p className="mt-1 text-sm text-muted">
                {clients.length === 0
                  ? "Keep their contact, characters and references in one place."
                  : "Their profile, characters and commissions show up here."}
              </p>
              {clients.length === 0 && (
                <button
                  type="button"
                  onClick={handleOpenNewClient}
                  className="mt-4 rounded-md bg-primary px-4 py-2 text-sm font-bold text-on-primary"
                >
                  New client
                </button>
              )}
            </div>
          ) : (
            <>
              <div className="flex items-center gap-4">
                {renderAvatar(selectedClient, "lg")}

                <div className="min-w-0 flex-1">
                  <h3 className="truncate text-2xl font-black">{selectedClient.name}</h3>
                  <p className="text-sm text-muted">
                    {selectedClient.platform || "No platform"}
                    {selectedClient.handle ? ` · ${selectedClient.handle}` : ""}
                  </p>
                </div>

                <div className="flex shrink-0 gap-2">
                  {selectedClient.platform === "Bluesky" && selectedClient.handle && (
                    <button
                      type="button"
                      onClick={() => handleFetchClientAvatar(selectedClient)}
                      className="rounded-md border border-line-strong px-3 py-1.5 text-xs font-semibold text-muted transition hover:border-ink hover:text-ink"
                    >
                      Fetch avatar
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => handleOpenEditClient(selectedClient)}
                    className="rounded-md border border-line-strong px-3 py-1.5 text-xs font-semibold text-ink transition hover:border-ink"
                  >
                    Edit
                  </button>

                  <button
                    type="button"
                    onClick={() => setClientToDelete(selectedClient)}
                    className="rounded-md px-3 py-1.5 text-xs font-semibold text-red-500 transition hover:bg-red-50"
                  >
                    Delete
                  </button>
                </div>
              </div>

              <dl className="mt-6 grid grid-cols-4 gap-3">
                {[
                  {
                    label: "Commissions",
                    value: selectedClientCommissions.length,
                    detail: `${activeCommissions.length} active · ${completedCommissions.length} done`,
                    className: "text-ink",
                  },
                  {
                    label: "Spent",
                    value: `${totalSpent} EUR`,
                    detail: `${averagePrice} EUR average`,
                    className: "text-ink",
                  },
                  { label: "Paid", value: paidCommissionsCount, detail: "commissions", className: "text-green-600" },
                  { label: "Unpaid", value: unpaidCommissionsCount, detail: "commissions", className: "text-red-500" },
                ].map((stat) => (
                  <div key={stat.label} className="rounded-md bg-paper p-3">
                    <dt className="text-[10px] font-black uppercase tracking-[0.16em] text-faint">
                      {stat.label}
                    </dt>
                    <dd className={`mt-1 text-xl font-black ${stat.className}`}>{stat.value}</dd>
                    <dd className="text-[11px] text-muted">{stat.detail}</dd>
                  </div>
                ))}
              </dl>

              <h4 className="mb-2 mt-8 text-[11px] font-black uppercase tracking-[0.16em] text-faint">
                Commissions · {selectedClientCommissions.length}
              </h4>

              {selectedClientCommissions.length === 0 ? (
                <p className="text-sm text-muted">No commissions yet.</p>
              ) : (
                <div className="divide-y divide-line border-y border-line">
                  {selectedClientCommissions.map((commission) => {
                    const commissionImages = stageImagesByCommissionId[commission.id] ?? [];
                    const commissionPreview = commissionImages[commissionImages.length - 1] ?? null;
                    const completionPercentage = getCommissionCompletionPercentage(commission);
                    const isCompleted = isCommissionCompleted(commission);

                    return (
                      <button
                        key={commission.id}
                        type="button"
                        onClick={() => handleOpenCommissionFromClient(commission)}
                        title="Open commission"
                        className="flex w-full items-center gap-4 px-2 py-2.5 text-left transition hover:bg-paper"
                      >
                        {commissionPreview ? (
                          <img
                            src={thumbUrl(commissionPreview.image_data_url)}
                            loading="lazy" decoding="async"
                            alt={commission.title}
                            className="h-12 w-12 shrink-0 rounded-md object-cover"
                          />
                        ) : (
                          <div className="h-12 w-12 shrink-0 rounded-md bg-paper" />
                        )}

                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-bold">{commission.title}</p>
                          <p className="text-xs text-muted">
                            {commission.price
                              ? `${commission.price} ${commission.currency || "EUR"}`
                              : "No price"}
                            {" · "}
                            {commission.deadline || "No deadline"}
                          </p>
                        </div>

                        <div className="w-32 shrink-0">
                          <div className="flex justify-between text-[10px] font-bold text-faint">
                            <span>{isCompleted ? "Done" : "Progress"}</span>
                            <span>{completionPercentage}%</span>
                          </div>
                          <div className="mt-1 h-1.5 overflow-hidden rounded-sm bg-paper">
                            <div
                              className={isCompleted ? "h-full bg-green-500" : "h-full bg-primary"}
                              style={{ width: `${completionPercentage}%` }}
                            />
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}

              <div className="mt-6 rounded-3xl bg-paper p-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-faint">
                    Characters
                  </p>

                  <span className="rounded-sm bg-surface px-3 py-1 text-xs font-black text-muted">
                    {(charactersByClientId[selectedClient.id] ?? []).length}
                  </span>
                </div>

                <div className="mt-4 flex gap-2">
                  <input
                    value={newCharacterName}
                    onChange={(event) =>
                      setNewCharacterName(event.target.value)
                    }
                    placeholder="Character name"
                    className="flex-1 rounded-2xl border border-line-strong bg-surface px-4 py-2"
                  />

                  <button
                    onClick={handleCreateCharacter}
                    className="rounded-2xl bg-primary px-4 py-2 text-sm font-black text-on-primary"
                  >
                    Add
                  </button>
                </div>

                <div className="mt-4 space-y-2">
                  {(charactersByClientId[selectedClient.id] ?? []).map((character) => {
                    const references = referencesByCharacterId[character.id] ?? [];

                    const commissionsUsingCharacter = commissions.filter((commission) =>
                      (commissionCharactersById[commission.id] ?? []).includes(character.id),
                    );

                    const lastUsedCommission =
                      commissionsUsingCharacter.length > 0
                        ? [...commissionsUsingCharacter].sort(
                            (a, b) =>
                              new Date(b.created_at).getTime() -
                              new Date(a.created_at).getTime(),
                          )[0]
                        : null;

                    return (
                      <div
                        key={character.id}
                        className="rounded-2xl bg-surface p-3 shadow-sm"
                      >
                        <button
                          onClick={() =>
                            setExpandedCharacterId(
                              expandedCharacterId === character.id
                                ? null
                                : character.id,
                            )
                          }
                          className="flex w-full items-center justify-between"
                        >
                          <div className="text-left">
                            <p className="font-black">
                              {character.name}
                            </p>

                            <div className="mt-2 flex flex-wrap gap-2">
                              <span className="rounded-sm bg-paper px-3 py-1 text-xs font-black text-muted shadow-sm">
                                {references.length} refs
                              </span>

                              <span className="rounded-sm bg-paper px-3 py-1 text-xs font-black text-muted shadow-sm">
                                {commissionsUsingCharacter.length} commissions
                              </span>
                            </div>

                            {lastUsedCommission && (
                              <p className="mt-2 text-xs font-semibold text-faint">
                                Last used in{" "}
                                <span className="font-black text-ink">
                                  {lastUsedCommission.title}
                                </span>
                              </p>
                            )}
                          </div>

                          <span className="text-lg font-black">
                            {expandedCharacterId === character.id ? "−" : "+"}
                          </span>
                        </button>

                        {expandedCharacterId === character.id && (
                          <div className="mt-4">
                            <button
                              type="button"
                              data-image-drop={`character:${character.id}`}
                              title="Click, drop images here or paste with Ctrl+V"
                              disabled={importingCharacterId !== null}
                              onClick={() => handleAddCharacterReferences(character.id)}
                              className={`block w-full cursor-pointer rounded-2xl border border-dashed px-4 py-3 text-center text-xs font-black transition hover:border-ink disabled:cursor-wait disabled:opacity-60 ${
                                dragZoneId === `character:${character.id}`
                                  ? "scale-[1.02] border-ink bg-highlight text-ink"
                                  : "border-line-strong bg-paper text-muted"
                              }`}
                            >
                              {importingCharacterId === character.id
                                ? "Optimizing…"
                                : dragZoneId === `character:${character.id}`
                                  ? "Drop to add"
                                  : "Add reference"}
                            </button>

                            {references.length === 0 ? (
                              <p className="mt-3 text-center text-sm text-faint">
                                No references yet.
                              </p>
                            ) : (
                              <div className="mt-4 grid grid-cols-4 gap-3">
                                {references.map((reference) => (
                                  <div
                                    key={reference.id}
                                    className="overflow-hidden rounded-2xl border border-line bg-surface shadow-sm"
                                  >
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setZoomedImage(imageUrl(reference.image_data_url))
                                      }
                                      className="block w-full"
                                    >
                                      <img
                                        src={thumbUrl(reference.image_data_url)}
                                        loading="lazy" decoding="async"
                                        alt={reference.label}
                                        className="aspect-square w-full object-cover"
                                      />
                                    </button>

                                    <div className="flex items-center justify-between px-2 py-1">
                                      <span className="truncate text-[10px] font-black text-muted">
                                        {reference.label}
                                      </span>

                                      <button
                                        type="button"
                                        onClick={() =>
                                          handleDeleteCharacterReference(
                                            character.id,
                                            reference.id,
                                          )
                                        }
                                        className="text-[10px] font-black text-red-500"
                                      >
                                        ×
                                      </button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                            <div className="mt-6">
                              <p className="mb-2 text-xs font-black uppercase tracking-[0.14em] text-faint">
                                  Commission history
                              </p>

                              {commissionsUsingCharacter.length === 0 ? (
                                  <p className="text-center text-sm text-faint">
                                  No commissions yet.
                                  </p>
                              ) : (
                                  <div className="grid grid-cols-4 gap-3">
                                  {commissionsUsingCharacter.map((historyCommission) => {
                                      const historyImages = stageImagesByCommissionId[historyCommission.id] ?? [];
                                      const latestHistoryImage =
                                      historyImages.length > 0
                                          ? historyImages[historyImages.length - 1]
                                          : null;

                                      return (
                                      <button
                                          key={historyCommission.id}
                                          type="button"
                                          onClick={() => handleOpenCommissionFromClient(historyCommission)}
                                          className="overflow-hidden rounded-2xl border border-line bg-surface text-left shadow-sm transition hover:scale-[1.02] hover:border-ink"
                                      >
                                          {latestHistoryImage ? (
                                          <img
                                              src={thumbUrl(latestHistoryImage.image_data_url)}
                                              loading="lazy" decoding="async"
                                              alt={historyCommission.title}
                                              className="aspect-square w-full object-cover"
                                          />
                                          ) : (
                                          <div className="flex aspect-square items-center justify-center bg-paper text-[10px] text-faint">
                                              No image
                                          </div>
                                          )}

                                          <div className="px-2 py-1">
                                          <p className="truncate text-[10px] font-black text-muted">
                                              {historyCommission.title}
                                          </p>
                                          </div>
                                      </button>
                                      );
                                  })}
                                  </div>
                              )}
                              </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {selectedClient.notes && (
                <>
                  <h4 className="mb-2 mt-8 text-[11px] font-black uppercase tracking-[0.16em] text-faint">
                    Notes
                  </h4>
                  <p className="whitespace-pre-wrap text-sm text-muted">{selectedClient.notes}</p>
                </>
              )}
            </>
          )}
        </div>
      </section>

      {zoomedImage && (
        <div
          className="fixed inset-0 z-[999] flex items-center justify-center bg-black/80 backdrop-blur-md"
          onClick={() => setZoomedImage(null)}
        >
          <img
            src={zoomedImage}
            alt=""
            className="max-h-[90vh] max-w-[90vw] rounded-3xl shadow-2xl"
          />
        </div>
      )}
      {clientForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
          <div className="w-[480px] rounded-3xl border border-line bg-surface p-6 shadow-2xl">
            <h3 className="text-xl font-black text-ink">
              {clientForm === "new" ? "New client" : "Edit client"}
            </h3>

            <div className="mt-5 space-y-3">
              <input
                autoFocus
                value={clientName}
                onChange={(event) => setClientName(event.target.value)}
                placeholder="Client name"
                className="w-full rounded-md border border-line-strong bg-paper px-3 py-2.5"
              />

              <div className="grid grid-cols-[160px_minmax(0,1fr)] gap-3">
                <select
                  value={clientPlatform}
                  onChange={(event) => setClientPlatform(event.target.value)}
                  className="rounded-md border border-line-strong bg-paper px-3 py-2.5"
                >
                  <option>Twitter / X</option>
                  <option>Bluesky</option>
                  <option>Telegram</option>
                  <option>Discord</option>
                  <option>Other</option>
                </select>

                <input
                  value={clientHandle}
                  onChange={(event) => setClientHandle(event.target.value)}
                  placeholder="@username"
                  className="rounded-md border border-line-strong bg-paper px-3 py-2.5"
                />
              </div>

              <textarea
                value={clientNotes}
                onChange={(event) => setClientNotes(event.target.value)}
                placeholder="Notes"
                rows={4}
                className="w-full rounded-md border border-line-strong bg-paper px-3 py-2.5"
              />
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={closeClientForm}
                className="rounded-md px-4 py-2 text-sm font-semibold text-muted hover:text-ink"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={clientForm === "new" ? handleCreateClient : handleSaveClientChanges}
                disabled={savingClient || !clientName.trim()}
                className="rounded-md bg-primary px-4 py-2 text-sm font-bold text-on-primary transition hover:bg-primary-hover disabled:opacity-50"
              >
                {savingClient ? "Saving…" : clientForm === "new" ? "Create client" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}

      {clientToDelete && (
        <ConfirmModal
            eyebrow="Delete client"
            title={clientToDelete.name}
            message="This action cannot be undone."
            confirmLabel="Delete"
            onConfirm={async () => {
            await handleDeleteClient(clientToDelete.id);
            setClientToDelete(null);
            }}
            onCancel={() => setClientToDelete(null)}
        />
        )}
    </>
  );
}

export default ClientsPage;