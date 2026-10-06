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
  const [clientToEdit, setClientToEdit] = useState<Client | null>(null);
  const [clientToDelete, setClientToDelete] = useState<Client | null>(null);
  const [savingClient, setSavingClient] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
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
  }

  async function handleCreateClient() {
    try {
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

      setClientName("");
      setClientPlatform("Twitter / X");
      setClientHandle("");
      setClientNotes("");

      await loadClients();
    } catch (error) {
    console.error(error);
    showToast("Could not create client.", "error");
    }
  }

    async function handleDeleteClient(clientId: number) {
    try {
        await deleteClient(clientId);
        await loadClients();
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
    setClientToEdit(client);
    setClientName(client.name);
    setClientPlatform(client.platform || "Twitter / X");
    setClientHandle(client.handle || "");
    setClientNotes(client.notes || "");
  }

  async function handleSaveClientChanges() {
    if (!clientToEdit) {
      return;
    }

    try {
      setSavingClient(true);

      await updateClient(
        clientToEdit.id,
        clientName,
        clientPlatform,
        clientHandle,
        clientNotes,
      );

      setClientToEdit(null);
      setClientName("");
      setClientPlatform("Twitter / X");
      setClientHandle("");
      setClientNotes("");

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
      "bg-[#1f2933]",
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

    setSelectedClient(null);
    onOpenCommissionsPage();
  }

  function getCommissionCompletionPercentage(commission: Commission) {
    return getCommissionCompletionPercentageHelper(commission, templateStagesByTemplateId);
  }

  function isCommissionCompleted(commission: Commission) {
    return isCommissionCompletedHelper(commission, templateStagesByTemplateId);
  }

  return (
    <>
      <PageHeader
        label="Client database"
        title="Clients"
        description="Manage your commission clients."
      />

      <section className="grid h-[calc(100vh-117px)] min-h-0 grid-cols-[360px_minmax(0,1fr)] gap-5 overflow-hidden p-5 pb-6">
        <div className="flex min-h-0 flex-col rounded-[2rem] border border-[#e1d8ca] bg-white p-5 shadow-sm">
          <h3 className="text-xl font-black">
            New client
          </h3>

          <div className="mt-5 min-h-0 flex-1 space-y-3 overflow-y-auto pr-2">
            <input
              value={clientName}
              onChange={(event) =>
                setClientName(event.target.value)
              }
              placeholder="Client name"
              className="w-full rounded-2xl border border-[#d8cec0] bg-[#fffaf2] px-4 py-3"
            />

            <select
              value={clientPlatform}
              onChange={(event) =>
                setClientPlatform(event.target.value)
              }
              className="w-full rounded-2xl border border-[#d8cec0] bg-[#fffaf2] px-4 py-3"
            >
              <option>Twitter / X</option>
              <option>Bluesky</option>
              <option>Telegram</option>
              <option>Discord</option>
              <option>Other</option>
            </select>

            <input
              value={clientHandle}
              onChange={(event) =>
                setClientHandle(event.target.value)
              }
              placeholder="@username"
              className="w-full rounded-2xl border border-[#d8cec0] bg-[#fffaf2] px-4 py-3"
            />

            <textarea
              value={clientNotes}
              onChange={(event) =>
                setClientNotes(event.target.value)
              }
              placeholder="Notes"
              rows={4}
              className="w-full rounded-2xl border border-[#d8cec0] bg-[#fffaf2] px-4 py-3"
            />

            <button
              onClick={handleCreateClient}
              className="w-full rounded-2xl bg-[#1f2933] px-4 py-3 font-bold text-white"
            >
              Create client
            </button>
          </div>
        </div>

        <div className="flex min-h-0 flex-col rounded-[2rem] border border-[#e1d8ca] bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-black">
              Clients
            </h3>

            <span className="rounded-full bg-[#fffaf2] px-3 py-1 text-xs font-bold text-[#9a8f82]">
              {clients.length} clients
            </span>
          </div>

          <div className="mt-5 min-h-0 flex-1 space-y-3 overflow-y-auto pr-2">
            {clients.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-[#d8cec0] bg-[#fffaf2] p-8 text-center text-sm text-[#9a8f82]">
                No clients yet
              </div>
            ) : (
              clients.map((client) => {
                const clientCommissions = commissions.filter(
                  (commission) => commission.client_id === client.id,
                );

                const clientTotal = clientCommissions.reduce(
                  (total, commission) => total + (commission.price || 0),
                  0,
                );

                const clientPaidCount = clientCommissions.filter((commission) =>
                  (commissionTagsById[commission.id] ?? []).some(
                    (tag) =>
                      tag.category === "Payment" &&
                      tag.name.trim().toLowerCase() === "paid",
                  ),
                ).length;

                const clientUnpaidCount = clientCommissions.filter((commission) =>
                  (commissionTagsById[commission.id] ?? []).some(
                    (tag) =>
                      tag.category === "Payment" &&
                      tag.name.trim().toLowerCase() === "not paid",
                  ),
                ).length;

                return (
                  <div
                    key={client.id}
                    onClick={() => setSelectedClient(client)}
                    className="cursor-pointer rounded-3xl border border-[#e6ded2] bg-[#fffaf2] p-4 transition hover:border-[#1f2933] hover:shadow-md"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3">
                        {client.avatar_url ? (
                          <img
                            src={client.avatar_url}
                            alt={client.name}
                            className="h-12 w-12 rounded-2xl object-cover shadow-sm"
                          />
                        ) : (
                          <div
                            className={`flex h-12 w-12 items-center justify-center rounded-2xl text-sm font-black text-white shadow-sm ${getClientAvatarBackground(
                              client.name,
                            )}`}
                          >
                            {getClientInitials(client.name)}
                          </div>
                        )}

                        <div>
                          <h4 className="font-black">{client.name}</h4>

                          {client.platform && (
                            <p className="mt-1 text-sm font-semibold text-[#1f2933]">
                              {client.platform}
                            </p>
                          )}

                          {client.handle && (
                            <p className="text-sm text-[#7c7163]">
                              {client.handle}
                            </p>
                          )}

                          <div className="mt-3 flex flex-wrap gap-2">
                            <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-[#7c7163] shadow-sm">
                              {clientCommissions.length} commissions
                            </span>

                            <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-[#1f2933] shadow-sm">
                              {clientTotal} EUR
                            </span>

                            <span className="rounded-full bg-green-50 px-3 py-1 text-xs font-black text-green-700 shadow-sm">
                              {clientPaidCount} paid
                            </span>

                            <span className="rounded-full bg-red-50 px-3 py-1 text-xs font-black text-red-600 shadow-sm">
                              {clientUnpaidCount} unpaid
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {client.platform === "Bluesky" && client.handle && (
                          <button
                            onClick={() => handleFetchClientAvatar(client)}
                            className="rounded-full bg-white px-3 py-1 text-xs font-black text-[#1f2933] shadow-sm transition hover:bg-[#f1e8da]"
                          >
                            Fetch avatar
                          </button>
                        )}

                        <button
                          onClick={(event) => {
                            event.stopPropagation();
                            handleOpenEditClient(client);
                          }}
                          className="rounded-full bg-white px-3 py-1 text-xs font-black text-[#1f2933] shadow-sm transition hover:bg-[#f1e8da]"
                        >
                          Edit
                        </button>

                        <button
                          onClick={(event) => {
                            event.stopPropagation();
                            setClientToDelete(client);
                          }}
                          className="rounded-full bg-white px-3 py-1 text-xs font-black text-red-500 shadow-sm transition hover:bg-red-50"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </section>
      {selectedClient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
          <div className="max-h-[90vh] w-[560px] overflow-y-auto rounded-[2rem] border border-[#e1d8ca] bg-white p-6 shadow-2xl">
            <div className="flex items-start gap-4">
              {selectedClient.avatar_url ? (
                <img
                  src={selectedClient.avatar_url}
                  alt={selectedClient.name}
                  className="h-16 w-16 rounded-3xl object-cover shadow-sm"
                />
              ) : (
                <div
                  className={`flex h-16 w-16 items-center justify-center rounded-3xl text-lg font-black text-white shadow-sm ${getClientAvatarBackground(
                    selectedClient.name,
                  )}`}
                >
                  {getClientInitials(selectedClient.name)}
                </div>
              )}

              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#9a8f82]">
                  Client profile
                </p>

                <h3 className="mt-1 text-2xl font-black text-[#1f2933]">
                  {selectedClient.name}
                </h3>

                <p className="mt-1 text-sm font-semibold text-[#7c7163]">
                  {selectedClient.platform || "No platform"}
                  {selectedClient.handle
                    ? ` · ${selectedClient.handle}`
                    : ""}
                </p>
                <div className="mt-6 grid grid-cols-4 gap-3">
                  <div className="rounded-3xl bg-[#fffaf2] p-4">
                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#9a8f82]">
                      Total
                    </p>

                    <p className="mt-2 text-xl font-black text-[#1f2933]">
                      {selectedClientCommissions.length}
                    </p>
                  </div>

                  <div className="rounded-3xl bg-[#fffaf2] p-4">
                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#9a8f82]">
                      Active
                    </p>

                    <p className="mt-2 text-xl font-black text-amber-600">
                      {activeCommissions.length}
                    </p>
                  </div>

                  <div className="rounded-3xl bg-[#fffaf2] p-4">
                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#9a8f82]">
                      Completed
                    </p>

                    <p className="mt-2 text-xl font-black text-green-600">
                      {completedCommissions.length}
                    </p>
                  </div>

                  <div className="rounded-3xl bg-[#fffaf2] p-4">
                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#9a8f82]">
                      Spent
                    </p>

                    <p className="mt-2 text-xl font-black text-[#1f2933]">
                      {totalSpent} EUR
                    </p>
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-3 gap-3">
                  <div className="rounded-3xl bg-[#fffaf2] p-4">
                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#9a8f82]">
                      Average
                    </p>

                    <p className="mt-2 text-xl font-black text-[#1f2933]">
                      {averagePrice} EUR
                    </p>
                  </div>

                  <div className="rounded-3xl bg-[#fffaf2] p-4">
                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#9a8f82]">
                      Paid
                    </p>

                    <p className="mt-2 text-xl font-black text-green-700">
                      {paidCommissionsCount}
                    </p>
                  </div>

                  <div className="rounded-3xl bg-[#fffaf2] p-4">
                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#9a8f82]">
                      Unpaid
                    </p>

                    <p className="mt-2 text-xl font-black text-red-600">
                      {unpaidCommissionsCount}
                    </p>
                  </div>
                </div>
              </div>
            </div>
            <div className="mt-6 rounded-3xl bg-[#fffaf2] p-4">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#9a8f82]">
                  Commissions
                </p>

                <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-[#9a8f82] shadow-sm">
                  {selectedClientCommissions.length}
                </span>
              </div>

              {selectedClientCommissions.length === 0 ? (
                <p className="mt-3 text-sm text-[#7c7163]">
                  No commissions yet.
                </p>
              ) : (
                <div className="mt-3 space-y-2">
                  {selectedClientCommissions.map((commission) => {
                    const commissionImages = stageImagesByCommissionId[commission.id] ?? [];

                    const commissionPreview =
                      commissionImages.length > 0
                        ? commissionImages[commissionImages.length - 1]
                        : null;

                    const completionPercentage = getCommissionCompletionPercentage(commission);
                    const isCompleted = isCommissionCompleted(commission);

                    return (
                      <div
                        key={commission.id}
                        className="flex items-center justify-between gap-3 rounded-2xl bg-white px-4 py-3 shadow-sm"
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          {commissionPreview && (
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                setZoomedImage(imageUrl(commissionPreview.image_data_url));
                              }}
                              className="shrink-0 overflow-hidden rounded-2xl border border-[#e6ded2] bg-[#fffaf2] shadow-sm transition hover:scale-[1.03]"
                            >
                              <img
                                src={thumbUrl(commissionPreview.image_data_url)}
                                loading="lazy" decoding="async"
                                alt={commission.title}
                                className="h-16 w-16 object-cover"
                              />
                            </button>
                          )}

                          <div className="flex min-w-0 items-center gap-3">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-black text-[#1f2933]">
                                {commission.title}
                              </p>

                              <p className="mt-1 text-xs text-[#7c7163]">
                                {commission.price
                                  ? `${commission.price} ${commission.currency || "EUR"}`
                                  : "No price"}
                                {" · "}
                                {commission.deadline || "No deadline"}
                              </p>

                              <div className="mt-2">
                                <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-[0.12em] text-[#9a8f82]">
                                  <span>
                                    {isCompleted ? "Completed" : "Progress"}
                                  </span>

                                  <span>
                                    {completionPercentage}%
                                  </span>
                                </div>

                                <div className="mt-1 h-2 overflow-hidden rounded-full bg-[#fffaf2]">
                                  <div
                                    className={
                                      isCompleted
                                        ? "h-full rounded-full bg-green-500"
                                        : "h-full rounded-full bg-[#1f2933]"
                                    }
                                    style={{ width: `${completionPercentage}%` }}
                                  />
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>

                        <button
                          onClick={() => handleOpenCommissionFromClient(commission)}
                          className="rounded-full bg-[#1f2933] px-3 py-1 text-xs font-black text-white shadow-sm"
                        >
                          Open
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            <div className="mt-6 rounded-3xl bg-[#fffaf2] p-4">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#9a8f82]">
                  Characters
                </p>

                <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-[#7c7163]">
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
                  className="flex-1 rounded-2xl border border-[#d8cec0] bg-white px-4 py-2"
                />

                <button
                  onClick={handleCreateCharacter}
                  className="rounded-2xl bg-[#1f2933] px-4 py-2 text-sm font-black text-white"
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
                      className="rounded-2xl bg-white p-3 shadow-sm"
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
                            <span className="rounded-full bg-[#fffaf2] px-3 py-1 text-xs font-black text-[#7c7163] shadow-sm">
                              {references.length} refs
                            </span>

                            <span className="rounded-full bg-[#fffaf2] px-3 py-1 text-xs font-black text-[#7c7163] shadow-sm">
                              {commissionsUsingCharacter.length} commissions
                            </span>
                          </div>

                          {lastUsedCommission && (
                            <p className="mt-2 text-xs font-semibold text-[#9a8f82]">
                              Last used in{" "}
                              <span className="font-black text-[#1f2933]">
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
                            className={`block w-full cursor-pointer rounded-2xl border border-dashed px-4 py-3 text-center text-xs font-black transition hover:border-[#1f2933] disabled:cursor-wait disabled:opacity-60 ${
                              dragZoneId === `character:${character.id}`
                                ? "scale-[1.02] border-[#1f2933] bg-[#f1e8da] text-[#1f2933]"
                                : "border-[#d8cec0] bg-[#fffaf2] text-[#7c7163]"
                            }`}
                          >
                            {importingCharacterId === character.id
                              ? "Optimizing…"
                              : dragZoneId === `character:${character.id}`
                                ? "Drop to add"
                                : "Add reference"}
                          </button>

                          {references.length === 0 ? (
                            <p className="mt-3 text-center text-sm text-[#9a8f82]">
                              No references yet.
                            </p>
                          ) : (
                            <div className="mt-4 grid grid-cols-4 gap-3">
                              {references.map((reference) => (
                                <div
                                  key={reference.id}
                                  className="overflow-hidden rounded-2xl border border-[#e6ded2] bg-white shadow-sm"
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
                                    <span className="truncate text-[10px] font-black text-[#7c7163]">
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
                            <p className="mb-2 text-xs font-black uppercase tracking-[0.14em] text-[#9a8f82]">
                                Commission history
                            </p>

                            {commissionsUsingCharacter.length === 0 ? (
                                <p className="text-center text-sm text-[#9a8f82]">
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
                                        className="overflow-hidden rounded-2xl border border-[#e6ded2] bg-white text-left shadow-sm transition hover:scale-[1.02] hover:border-[#1f2933]"
                                    >
                                        {latestHistoryImage ? (
                                        <img
                                            src={thumbUrl(latestHistoryImage.image_data_url)}
                                            loading="lazy" decoding="async"
                                            alt={historyCommission.title}
                                            className="aspect-square w-full object-cover"
                                        />
                                        ) : (
                                        <div className="flex aspect-square items-center justify-center bg-[#fffaf2] text-[10px] text-[#9a8f82]">
                                            No image
                                        </div>
                                        )}

                                        <div className="px-2 py-1">
                                        <p className="truncate text-[10px] font-black text-[#7c7163]">
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
              <div className="mt-6 rounded-3xl bg-[#fffaf2] p-4">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#9a8f82]">
                  Notes
                </p>

                <p className="mt-2 text-sm text-[#7c7163]">
                  {selectedClient.notes}
                </p>
              </div>
            )}

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setSelectedClient(null)}
                className="rounded-2xl bg-[#1f2933] px-4 py-2 font-bold text-white"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
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
      {clientToEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
          <div className="w-[520px] rounded-[2rem] border border-[#e1d8ca] bg-white p-6 shadow-2xl">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#9a8f82]">
              Edit client
            </p>

            <h3 className="mt-2 text-2xl font-black text-[#1f2933]">
              Update client
            </h3>

            <div className="mt-6 space-y-3">
              <input
                value={clientName}
                onChange={(event) => setClientName(event.target.value)}
                placeholder="Client name"
                className="w-full rounded-2xl border border-[#d8cec0] bg-[#fffaf2] px-4 py-3"
              />

              <select
                value={clientPlatform}
                onChange={(event) => setClientPlatform(event.target.value)}
                className="w-full rounded-2xl border border-[#d8cec0] bg-[#fffaf2] px-4 py-3"
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
                className="w-full rounded-2xl border border-[#d8cec0] bg-[#fffaf2] px-4 py-3"
              />

              <textarea
                value={clientNotes}
                onChange={(event) => setClientNotes(event.target.value)}
                placeholder="Notes"
                rows={4}
                className="w-full rounded-2xl border border-[#d8cec0] bg-[#fffaf2] px-4 py-3"
              />
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => {
                  setClientToEdit(null);
                  setClientName("");
                  setClientPlatform("Twitter / X");
                  setClientHandle("");
                  setClientNotes("");
                }}
                className="rounded-2xl border border-[#d8cec0] px-4 py-2 font-semibold"
              >
                Cancel
              </button>

              <button
                onClick={handleSaveClientChanges}
                disabled={savingClient}
                className="rounded-2xl bg-[#1f2933] px-4 py-2 font-bold text-white"
              >
                {savingClient ? "Saving..." : "Save"}
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