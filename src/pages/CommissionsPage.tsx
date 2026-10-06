import { useEffect, useState } from "react";
import { imageUrl, thumbUrl, importImage, pickImagePaths } from "../lib/images";
import { useImageInput } from "../lib/useImageInput";
import BoardFilters, { type PaymentFilter } from "../components/BoardFilters";
import CommissionPayments from "../components/CommissionPayments";
import {
  loadStageImagesForCommissions as loadStageImagesForCommissionsHelper,
  getCommissionCompletionPercentage as getCommissionCompletionPercentageHelper,
  isCommissionCompleted as isCommissionCompletedHelper,
  getDeadlineStatus,
  formatMoney,
  parsePrice,
  paymentSummary,
  PAYMENT_STATUS_STYLE,
  calculateCommissionPrice,
  EXTRA_CHARACTER_RATE,
} from "../lib/commissionHelpers";
import {
  getTemplateStages,
  getTemplates,
  createCommission,
  getCommissions,
  getAllPayments,
  updateCommissionStage,
  updateCommission,
  duplicateCommission,
  deleteCommission,
  getCommissionTags,
  replaceCommissionTags,
  getClients,
  createCommissionStageImage,
  deleteCommissionStageImage,
  getClientCharacters,
  getCharacterReferences,
  getCommissionCharacterIds,
  replaceCommissionCharacters,
  getTags,
  type ClientCharacter,
  type CharacterReference,
  type CommissionStageImage,
  type Client,
  type Tag,
  type Commission,
  type CommissionPayment,
  type Template,
  type TemplateStage,
} from "../lib/database";
import PageHeader from "../components/PageHeader";
import OpenTabs from "../components/OpenTabs";
import ConfirmModal from "../components/ConfirmModal";
import { useToast } from "../context/ToastContext";

function CommissionsPage() {
  const [showNewCommissionModal, setShowNewCommissionModal] = useState(false);
  const [commissionTitle, setCommissionTitle] = useState("");
  const [commissionPrice, setCommissionPrice] = useState("");
  const [commissionDeadline, setCommissionDeadline] = useState("");
  const [commissionNotes, setCommissionNotes] = useState("");
  const [clientName, setClientName] = useState("");
  const [selectedClientId, setSelectedClientId] = useState<number | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClientIds, setSelectedClientIds] = useState<number[]>([]);
  const [charactersByClientId, setCharactersByClientId] = useState<Record<number, ClientCharacter[]>>({});
  const [selectedCharacterIds, setSelectedCharacterIds] = useState<number[]>([]);
  const [commissionCharactersById, setCommissionCharactersById] = useState<Record<number, number[]>>({});
  const [referencesByCharacterId, setReferencesByCharacterId] = useState<Record<number, CharacterReference[]>>({});
  const [platform, setPlatform] = useState("Discord");
  const [currency, setCurrency] = useState("EUR");
  const [hasDeadline, setHasDeadline] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | null>(null);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [creatingCommission, setCreatingCommission] = useState(false);
  const [commissionCreated, setCommissionCreated] = useState(false);
  const [commissions, setCommissions] = useState<Commission[]>([]);
  const [openCommissionTabs, setOpenCommissionTabs] = useState<Commission[]>([]);
  const [activeCommissionId, setActiveCommissionId] = useState<number | null>(null);
  const [tabsRestored, setTabsRestored] = useState(false);
  const [workflowStages, setWorkflowStages] = useState<TemplateStage[]>([]);
  const [templateStagesByTemplateId, setTemplateStagesByTemplateId] = useState<Record<number, TemplateStage[]>>({});
  const activeCommission = commissions.find((commission) => commission.id === activeCommissionId) ?? null;
  const [showEditCommissionModal, setShowEditCommissionModal] = useState(false);
  const [savingCommission, setSavingCommission] = useState(false);
  const [commissionSaved, setCommissionSaved] = useState(false);
  const [duplicatingCommission, setDuplicatingCommission] = useState(false);
  const [showDeleteCommissionModal, setShowDeleteCommissionModal] = useState(false);
  const [deletingCommission, setDeletingCommission] = useState(false);
  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>([]);
  const [commissionTagsById, setCommissionTagsById] = useState<Record<number, Tag[]>>({});
  const [stageImagesByCommissionId, setStageImagesByCommissionId] = useState<Record<number, CommissionStageImage[]>>({});
  const [activeStageImageIndexByStageId, setActiveStageImageIndexByStageId] = useState<Record<number, number>>({});
  // Etapa que se ve en el visor; null = la etapa actual de la comisión
  const [viewedStageId, setViewedStageId] = useState<number | null>(null);
  const [commissionMenuOpen, setCommissionMenuOpen] = useState(false);
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);
  const [importingStageId, setImportingStageId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterTagIds, setFilterTagIds] = useState<number[]>([]);
  const [filterStatus, setFilterStatus] = useState<"all" | "active" | "overdue">("all");
  const [filterPayment, setFilterPayment] = useState<PaymentFilter>("all");
  const [paymentsByCommissionId, setPaymentsByCommissionId] = useState<Record<number, CommissionPayment[]>>({});
  const { showToast } = useToast();

    const filteredCommissions = commissions.filter((commission) => {
    if (isCommissionCompleted(commission)) {
        return false;
    }

    const query = searchQuery.trim().toLowerCase();

    const matchesSearch =
        query === "" ||
        commission.title.toLowerCase().includes(query) ||
        (commission.client_name ?? "").toLowerCase().includes(query);

    const tags = commissionTagsById[commission.id] ?? [];
    // Dentro de una categoría basta con una etiqueta (Sketch o Full Colour); entre categorías, todas (y Paid)
    const selectedTagsByCategory = Object.values(
        allTags
        .filter((tag) => filterTagIds.includes(tag.id))
        .reduce<Record<string, number[]>>((groups, tag) => {
            (groups[tag.category || "General"] ??= []).push(tag.id);
            return groups;
        }, {}),
    );
    const matchesTags = selectedTagsByCategory.every((tagIds) =>
        tags.some((tag) => tagIds.includes(tag.id)),
    );

    const isOverdue =
        commission.deadline !== null &&
        new Date(`${commission.deadline}T00:00:00`) < new Date(new Date().toDateString());

    const matchesStatus =
        filterStatus === "all" ||
        (filterStatus === "active" && !isOverdue) ||
        (filterStatus === "overdue" && isOverdue);

    const matchesPayment =
        filterPayment === "all" ||
        paymentSummary(commission.price, paymentsByCommissionId[commission.id] ?? []).status === filterPayment;

    return matchesSearch && matchesTags && matchesStatus && matchesPayment;
    });


  useEffect(() => {
    getTemplates()
      .then(async (data) => {
        setTemplates(data);

        const entries = await Promise.all(
          data.map(async (template) => {
            const stages = await getTemplateStages(template.id);
            return [template.id, stages] as const;
          }),
        );

        setTemplateStagesByTemplateId(Object.fromEntries(entries));
      })
      .catch(console.error);

    getCommissions()
      .then(async (data) => {
        setCommissions(data);
        await loadTagsForCommissions(data);
        await loadStageImagesForCommissions(data);
        await loadCharactersForCommissions(data);
      })
      .catch(console.error);

    getClients()
      .then(async (data) => {
        setClients(data);

        const characterEntries = await Promise.all(
          data.map(async (client) => {
            const characters = await getClientCharacters(client.id);
            return [client.id, characters] as const;
          }),
        );

        const nextCharactersByClientId =
          Object.fromEntries(characterEntries);

        setCharactersByClientId(nextCharactersByClientId);

        await loadReferencesForCharactersFromClients(
          nextCharactersByClientId,
        );
      })
      .catch(console.error);

    getTags()
      .then(setAllTags)
      .catch(console.error);
  }, []);

  async function handleCreateCommission() {
    try {
      setCreatingCommission(true);

      const selectedClient = clients.find((client) => client.id === selectedClientId) ?? null;

      await createCommission(
        commissionTitle,
        selectedClientId,
        selectedClient?.name || clientName,
        selectedClient?.platform || platform,
        selectedTemplateId,
        parsePrice(commissionPrice),
        currency,
        hasDeadline ? commissionDeadline : null,
        commissionNotes,
      );

      const createdCommissions = await getCommissions();
      const createdCommission = createdCommissions[0];

      if (createdCommission) {
        await replaceCommissionCharacters(
          createdCommission.id,
          selectedCharacterIds,
        );
      }

      const data = await getCommissions();
      setCommissions(data);
      await loadTagsForCommissions(data);

      setCommissionTitle("");
      setSelectedClientId(null);
      setClientName("");
      setPlatform("Discord");
      setSelectedTemplateId(null);
      setCommissionPrice("");
      setCurrency("EUR");
      setHasDeadline(false);
      setCommissionDeadline("");
      setCommissionNotes("");
      setSelectedClientIds([]);
      setSelectedCharacterIds([]);

      setCommissionCreated(true);

      setTimeout(() => {
        setCommissionCreated(false);
        setShowNewCommissionModal(false);
      }, 1500);
    } catch (error) {
    console.error(error);
    showToast(error instanceof Error ? error.message : `Commission error: ${error}`, "error");
    } finally {
      setCreatingCommission(false);
    }
  }

  useEffect(() => {
    const savedTabs = localStorage.getItem("zeeboard-open-commission-tabs");
    const savedActiveId = localStorage.getItem("zeeboard-active-commission-id");

    getCommissions()
      .then((data) => {
        if (savedTabs) {
          const tabIds = JSON.parse(savedTabs) as number[];

          const restoredTabs = data.filter((commission) =>
            tabIds.includes(commission.id),
          );

          setOpenCommissionTabs(restoredTabs);

          if (savedActiveId) {
            const activeId = Number(savedActiveId);
            const activeExists = restoredTabs.some((tab) => tab.id === activeId);

            setActiveCommissionId(activeExists ? activeId : null);
          }
        }

        setTabsRestored(true);
      })
      .catch((error) => {
        console.error(error);
        setTabsRestored(true);
      });
  }, []);

  useEffect(() => {
    if (!tabsRestored) {
      return;
    }

    localStorage.setItem(
      "zeeboard-open-commission-tabs",
      JSON.stringify(openCommissionTabs.map((commission) => commission.id)),
    );

    if (activeCommissionId !== null) {
      localStorage.setItem(
        "zeeboard-active-commission-id",
        String(activeCommissionId),
      );
    } else {
      localStorage.removeItem("zeeboard-active-commission-id");
    }
  }, [openCommissionTabs, activeCommissionId, tabsRestored]);

  useEffect(() => {
    async function loadWorkflowStages() {
      if (!activeCommission?.template_id) {
        setWorkflowStages([]);
        return;
      }

      try {
        const stages = await getTemplateStages(
          activeCommission.template_id,
        );

        setWorkflowStages(stages);
      } catch (error) {
        console.error(error);
      }
    }

    loadWorkflowStages();
  }, [activeCommission]);

  function handleOpenCommission(commission: Commission) {
    setOpenCommissionTabs((currentTabs: Commission[]) => {
      const alreadyOpen = currentTabs.some(
        (tab: Commission) => tab.id === commission.id,
      );

      if (alreadyOpen) {
        return currentTabs;
      }

      return [...currentTabs, commission];
    });

    setActiveCommissionId(commission.id);
  }

  function handleCloseCommissionTab(commissionId: number) {
    setOpenCommissionTabs((currentTabs: Commission[]) =>
      currentTabs.filter((tab: Commission) => tab.id !== commissionId),
    );

    if (activeCommissionId === commissionId) {
      setActiveCommissionId(null);
    }
  }

  /** Precio automático: lo llaman los cambios de plantilla y personajes, nunca al abrir un formulario */
  function applyAutoPrice(templateId: number | null, characterCount: number) {
    const basePrice = templates.find((template) => template.id === templateId)?.base_price;

    if (basePrice != null) {
      setCommissionPrice(String(calculateCommissionPrice(basePrice, characterCount)).replace(".", ","));
    }
  }

  const selectedTemplateBasePrice =
    templates.find((template) => template.id === selectedTemplateId)?.base_price ?? null;
  const extraCharacters = Math.max(selectedCharacterIds.length, 1) - 1;
  const autoPriceHint =
    selectedTemplateBasePrice === null
      ? null
      : extraCharacters === 0
        ? `${formatMoney(selectedTemplateBasePrice)} base price`
        : `${formatMoney(selectedTemplateBasePrice)} + ${EXTRA_CHARACTER_RATE * 100}% × ${extraCharacters} extra character${extraCharacters === 1 ? "" : "s"}`;

  async function loadPayments() {
    const payments = await getAllPayments();
    const grouped: Record<number, CommissionPayment[]> = {};

    for (const payment of payments) {
      (grouped[payment.commission_id] ??= []).push(payment);
    }

    setPaymentsByCommissionId(grouped);
  }

  async function loadTagsForCommissions(data: Commission[]) {
    // Los pagos se recargan en los mismos momentos que las etiquetas
    loadPayments().catch(console.error);

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

  async function loadReferencesForCharactersFromClients(
    charactersByClient: Record<number, ClientCharacter[]>,
  ) {
    const allCharacters = Object.values(charactersByClient).flat();

    const entries = await Promise.all(
      allCharacters.map(async (character) => {
        const references = await getCharacterReferences(character.id);
        return [character.id, references] as const;
      }),
    );

    setReferencesByCharacterId(Object.fromEntries(entries));
  }

  /** +1 avanza a la siguiente etapa, -1 vuelve a la anterior */
  async function handleMoveStage(direction: 1 | -1) {
    if (!activeCommission || workflowStages.length === 0) {
      return;
    }

    const currentStageIndex = workflowStages.findIndex(
      (stage) => stage.id === activeCommission.current_stage_id,
    );

    const nextStage = workflowStages[currentStageIndex + direction];

    if (!nextStage) {
      return;
    }

    await updateCommissionStage(activeCommission.id, nextStage.id);
    // El visor sigue a la etapa actual
    setViewedStageId(null);

    const data = await getCommissions();
    setCommissions(data);

    setOpenCommissionTabs((currentTabs) =>
      currentTabs.map((tab) =>
        tab.id === activeCommission.id
          ? { ...tab, current_stage_id: nextStage.id }
          : tab,
      ),
    );
  }

  async function handleOpenEditCommission() {
    if (!activeCommission) {
      return;
    }

    setCommissionTitle(activeCommission.title);
    setClientName(activeCommission.client_name || "");
    setSelectedClientId(activeCommission.client_id);
    setPlatform(activeCommission.platform || "Discord");
    setCommissionPrice(
      activeCommission.price ? String(activeCommission.price) : "",
    );
    setCurrency(activeCommission.currency || "EUR");
    setCommissionDeadline(activeCommission.deadline || "");
    setHasDeadline(Boolean(activeCommission.deadline));
    setCommissionNotes(activeCommission.notes || "");

    const tags = await getCommissionTags(activeCommission.id);

    setSelectedTagIds(
      tags.map((tag) => tag.id),
    );
    setShowEditCommissionModal(true);
  }

  async function handleSaveCommissionChanges() {
    if (!activeCommission) {
      return;
    }

    try {
      setSavingCommission(true);

      const selectedClient = clients.find((client) => client.id === selectedClientId) ?? null;

      await updateCommission(
        activeCommission.id,
        commissionTitle,
        selectedClientId,
        selectedClient?.name || clientName,
        selectedClient?.platform || platform,
        parsePrice(commissionPrice),
        currency,
        hasDeadline ? commissionDeadline : null,
        commissionNotes,
      );
      await replaceCommissionTags(
        activeCommission.id,
        selectedTagIds,
      );

      const data = await getCommissions();

      setCommissions(data);

      await loadTagsForCommissions(data);
      await loadStageImagesForCommissions(data);

      setOpenCommissionTabs((currentTabs) =>
        currentTabs.map((tab) => {
          const updatedCommission = data.find(
            (commission) => commission.id === tab.id,
          );

          return updatedCommission ?? tab;
        }),
      );

      setCommissionSaved(true);

      setTimeout(() => {
        setCommissionSaved(false);
        setShowEditCommissionModal(false);
      }, 1500);
    } catch (error) {
      console.error(error);
      showToast(error instanceof Error ? error.message : `Commission error: ${error}`, "error");
    } finally {
      setSavingCommission(false);
    }
  }

  async function handleDuplicateCommission() {
    if (!activeCommission) {
        return;
    }

    try {
        setDuplicatingCommission(true);

        const newCommissionId = await duplicateCommission(activeCommission.id);
        const data = await getCommissions();

        setCommissions(data);
        await loadTagsForCommissions(data);

        const duplicatedCommission =
        data.find((commission) => commission.id === newCommissionId) ?? null;

        if (duplicatedCommission) {
        setOpenCommissionTabs((currentTabs) => [
            ...currentTabs,
            duplicatedCommission,
        ]);

        setActiveCommissionId(duplicatedCommission.id);
        }

        showToast("Commission duplicated.", "success");
    } catch (error) {
        console.error(error);
        showToast("Could not duplicate commission.", "error");
    } finally {
        setDuplicatingCommission(false);
    }
    }

  async function handleDeleteCommission() {
    if (!activeCommission) {
        return;
    }

    try {
        setDeletingCommission(true);

        await deleteCommission(activeCommission.id);

        const data = await getCommissions();

        setCommissions(data);
        await loadTagsForCommissions(data);

        setOpenCommissionTabs((currentTabs) =>
        currentTabs.filter((tab) => tab.id !== activeCommission.id),
        );

        setActiveCommissionId(null);
        showToast("Commission deleted.", "success");

        setShowDeleteCommissionModal(false);
    } catch (error) {
        console.error(error);
        showToast("Could not delete commission.", "error");
    } finally {
        setDeletingCommission(false);
    }
    }

  /** Sin `sources` abre el selector; con ellas, vienen de arrastrar y soltar o de Ctrl+V. */
  async function handleAddStageImages(stageId: number, sources?: (string | File)[]) {
    if (!activeCommission || importingStageId !== null) {
      return;
    }

    const items = sources ?? (await pickImagePaths());

    if (items.length === 0) {
      return;
    }

    setImportingStageId(stageId);

    try {
      for (const item of items) {
        const stored = await importImage(item);
        await createCommissionStageImage(activeCommission.id, stageId, stored.path);
      }
    } catch (error) {
      console.error("Could not upload stage image", error);
      showToast(`Could not add image: ${error}`, "error");
    } finally {
      setImportingStageId(null);
    }

    const data = await getCommissions();
    setCommissions(data);
    await loadStageImagesForCommissions(data);
  }

  const dragZoneId = useImageInput({
    onDrop: (zoneId, paths) => {
      const [kind, stageId] = zoneId.split(":");

      if (kind === "stage") {
        handleAddStageImages(Number(stageId), paths);
      }
    },
    // Ctrl+V añade la imagen a la etapa actual de la comisión abierta
    onPaste: (files) => {
      if (activeCommission && viewedStage) {
        handleAddStageImages(viewedStage.id, files);
      }
    },
  });

  async function handleDeleteStageImage(imageId: number) {
    await deleteCommissionStageImage(imageId);

    const data = await getCommissions();
    setCommissions(data);
    await loadStageImagesForCommissions(data);
  }

  function getStageImages(commissionId: number, stageId: number) {
    return (stageImagesByCommissionId[commissionId] ?? []).filter(
      (image) => image.stage_id === stageId,
    );
  }

  function getActiveStageImageIndex(stageId: number, images: CommissionStageImage[]) {
    const index = activeStageImageIndexByStageId[stageId] ?? 0;

    if (images.length === 0) {
      return 0;
    }

    return Math.min(index, images.length - 1);
  }

  const currentStageIndex = workflowStages.findIndex(
    (stage) => stage.id === activeCommission?.current_stage_id,
  );

  const isLastStage =
    workflowStages.length > 0 &&
    currentStageIndex === workflowStages.length - 1;

  const activeDeadlineStatus = activeCommission ? getDeadlineStatus(activeCommission.deadline) : null;
  const activePaymentStatus =
    PAYMENT_STATUS_STYLE[
      activeCommission
        ? paymentSummary(activeCommission.price, paymentsByCommissionId[activeCommission.id] ?? []).status
        : "unpaid"
    ];
  const activeCharacters = activeCommission
    ? Object.values(charactersByClientId)
        .flat()
        .filter((character) => (commissionCharactersById[activeCommission.id] ?? []).includes(character.id))
    : [];

  const viewedStage =
    workflowStages.find((stage) => stage.id === viewedStageId) ??
    workflowStages[currentStageIndex] ??
    workflowStages[0] ??
    null;

  const today = new Date();
  const currentMonth = today.toLocaleString("en-US", {
    month: "long",
  });

  const currentYear = today.getFullYear();

  const firstDayOfMonth = new Date(
    currentYear,
    today.getMonth(),
    1,
  );

  let startingWeekDay = firstDayOfMonth.getDay();

  if (startingWeekDay === 0) {
    startingWeekDay = 7;
  }

  const daysInMonth = new Date(
    currentYear,
    today.getMonth() + 1,
    0,
  ).getDate();

  const calendarDays = [
    ...Array(startingWeekDay - 1).fill(null),
    ...Array.from({ length: daysInMonth }, (_, index) => index + 1),
  ];

  const selectedDeadlineCommission =
    activeCommission?.deadline ? activeCommission : null;

  const daysUntilSelectedDeadline = selectedDeadlineCommission?.deadline
    ? Math.ceil(
        (new Date(selectedDeadlineCommission.deadline).getTime() -
          new Date().getTime()) /
          (1000 * 60 * 60 * 24),
      )
    : null;

  const activeCommissionTags = activeCommission
    ? commissionTagsById[activeCommission.id] ?? []
    : [];

  function isPaymentTag(tag: Tag) {
    return tag.category === "Payment";
  }

  function getNormalTags(tags: Tag[]) {
    return tags.filter((tag) => !isPaymentTag(tag));
  }

  function getCommissionCompletionPercentage(commission: Commission) {
    return getCommissionCompletionPercentageHelper(commission, templateStagesByTemplateId);
  }

  function isCommissionCompleted(commission: Commission) {
    return isCommissionCompletedHelper(commission, templateStagesByTemplateId);
  }

  const activeNormalTags = getNormalTags(activeCommissionTags);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <PageHeader
        label="Main workspace"
        title="Commissions"
        description="Organize your drawings by stages, clients, dates and tags."
        action="+ New commission"
        onAction={() => setShowNewCommissionModal(true)}
      />

      <OpenTabs
        openCommissionTabs={openCommissionTabs}
        activeCommissionId={activeCommissionId}
        clients={clients}
        getPaymentStatus={(commission: Commission) =>
          paymentSummary(commission.price, paymentsByCommissionId[commission.id] ?? []).status
        }
        onSelectCommission={(commissionId) => setActiveCommissionId(commissionId)}
        onShowAllCommissions={() => setActiveCommissionId(null)}
        onCloseCommission={handleCloseCommissionTab}
      />

      <section
        className={`grid min-h-0 flex-1 gap-5 p-5 pb-6 ${
          activeCommission ? "grid-cols-1" : "grid-cols-[minmax(0,1fr)_320px]"
        }`}
      >
        <div className="flex h-full min-h-0 flex-col rounded-3xl border border-line bg-surface p-5 shadow-sm">
          <div className="min-h-0 flex-1 overflow-y-auto px-1">
            {!activeCommission && commissions.length > 0 && (
              <BoardFilters
                tags={allTags}
                searchQuery={searchQuery}
                onSearchQueryChange={setSearchQuery}
                filterTagIds={filterTagIds}
                onFilterTagIdsChange={setFilterTagIds}
                filterStatus={filterStatus}
                onFilterStatusChange={setFilterStatus}
                filterPayment={filterPayment}
                onFilterPaymentChange={setFilterPayment}
              />
            )}

            {activeCommission ? (
              <div className="flex h-full min-h-0 flex-col gap-5">
                {/* Cabecera: todo lo importante en una línea */}
                <div className="flex items-start gap-4">
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate text-2xl font-black">{activeCommission.title}</h3>
                    <p className="mt-1 text-sm text-muted">
                      {[
                        activeCommission.client_name || "No client",
                        activeCommission.platform,
                        templates.find((template) => template.id === activeCommission.template_id)?.name,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                      {activeDeadlineStatus && (
                        <span className={`ml-2 rounded-sm px-2 py-0.5 text-xs font-bold ${activeDeadlineStatus.className}`}>
                          {activeDeadlineStatus.label}
                        </span>
                      )}
                    </p>

                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <span className={`rounded-sm px-2 py-0.5 text-xs font-bold ${activePaymentStatus.className}`}>
                        {activePaymentStatus.label}
                      </span>
                      {activeNormalTags.map((tag) => (
                        <span
                          key={tag.id}
                          className="rounded-sm px-2 py-0.5 text-xs font-bold text-white"
                          style={{ backgroundColor: tag.color }}
                        >
                          {tag.name}
                        </span>
                      ))}
                    </div>
                  </div>

                  <button
                    onClick={handleOpenEditCommission}
                    className="rounded-md border border-line-strong px-3 py-1.5 text-xs font-semibold text-ink transition hover:border-ink"
                  >
                    Edit
                  </button>

                  <div className="relative">
                    <button
                      type="button"
                      title="More actions"
                      onClick={() => setCommissionMenuOpen((open) => !open)}
                      className="rounded-md border border-line-strong px-3 py-1.5 text-xs font-semibold text-ink transition hover:border-ink"
                    >
                      ···
                    </button>

                    {commissionMenuOpen && (
                      <>
                        <div className="fixed inset-0 z-30" onClick={() => setCommissionMenuOpen(false)} />
                        <div className="absolute right-0 top-full z-40 mt-1 w-40 rounded-md border border-line bg-surface p-1 shadow-lg">
                          <button
                            type="button"
                            disabled={duplicatingCommission}
                            onClick={() => {
                              setCommissionMenuOpen(false);
                              handleDuplicateCommission();
                            }}
                            className="block w-full rounded-sm px-3 py-2 text-left text-sm hover:bg-highlight"
                          >
                            {duplicatingCommission ? "Duplicating…" : "Duplicate"}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setCommissionMenuOpen(false);
                              setShowDeleteCommissionModal(true);
                            }}
                            className="block w-full rounded-sm px-3 py-2 text-left text-sm text-red-500 hover:bg-red-50"
                          >
                            Delete
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                <div className="grid min-h-0 flex-1 grid-cols-[290px_minmax(0,1fr)] grid-rows-[auto_minmax(0,1fr)] gap-x-6 gap-y-5 min-[1400px]:grid-cols-[220px_minmax(0,1fr)_340px] min-[1400px]:grid-rows-[minmax(0,1fr)]">
                {workflowStages.length === 0 ? (
                  <p className="col-start-1 row-start-1 rounded-md border border-dashed border-line-strong p-6 text-center text-sm text-faint">
                    This commission has no template, so it has no stages. Edit it to pick one.
                  </p>
                ) : (
                  <>
                    {/* Línea de tiempo: el historial del dibujo */}
                    <div className="col-start-1 row-start-1 min-h-0 overflow-y-auto">
                      <ol>
                        {workflowStages.map((stage, index) => {
                          const stageImages = getStageImages(activeCommission.id, stage.id);
                          const latest = stageImages[stageImages.length - 1] ?? null;
                          const isDone = index < currentStageIndex;
                          const isCurrent = index === currentStageIndex;
                          const isViewed = stage.id === viewedStage?.id;

                          return (
                            <li key={stage.id} className="relative">
                              {index < workflowStages.length - 1 && (
                                <span
                                  className={`absolute left-[19px] top-9 h-[calc(100%-20px)] w-px ${
                                    isDone ? "bg-green-500" : "bg-line-strong"
                                  }`}
                                />
                              )}

                              <button
                                type="button"
                                data-image-drop={`stage:${stage.id}`}
                                onClick={() => setViewedStageId(stage.id)}
                                className={`relative flex w-full items-center gap-3 rounded-md px-2 py-2 text-left transition ${
                                  dragZoneId === `stage:${stage.id}`
                                    ? "bg-highlight ring-1 ring-ink"
                                    : isViewed
                                      ? "bg-highlight"
                                      : "hover:bg-paper"
                                }`}
                              >
                                <span
                                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
                                    isDone
                                      ? "bg-green-600 text-white"
                                      : isCurrent
                                        ? "bg-primary text-on-primary"
                                        : "border border-line-strong text-faint"
                                  }`}
                                >
                                  {isDone ? "✓" : index + 1}
                                </span>

                                {latest ? (
                                  <img
                                    src={thumbUrl(latest.image_data_url)}
                                    loading="lazy" decoding="async"
                                    alt=""
                                    className="h-9 w-9 shrink-0 rounded-sm object-cover"
                                  />
                                ) : (
                                  <span className="h-9 w-9 shrink-0 rounded-sm bg-paper" />
                                )}

                                <span className="min-w-0">
                                  <span className={`block truncate text-sm ${isCurrent ? "font-black" : "font-semibold"} ${!isDone && !isCurrent ? "text-muted" : ""}`}>
                                    {stage.name}
                                  </span>
                                  <span className="block text-[11px] text-faint">
                                    {importingStageId === stage.id
                                      ? "Optimizing…"
                                      : stageImages.length === 0
                                        ? "No images"
                                        : stageImages.length === 1
                                          ? "1 image"
                                          : `${stageImages.length} images`}
                                  </span>
                                </span>
                              </button>
                            </li>
                          );
                        })}
                      </ol>

                      <div className="mt-3 flex gap-2">
                        <button
                          type="button"
                          title="Back to the previous stage"
                          onClick={() => handleMoveStage(-1)}
                          disabled={currentStageIndex <= 0}
                          className="rounded-md border border-line-strong px-3 py-2 text-sm text-muted transition hover:border-ink hover:text-ink disabled:opacity-30"
                        >
                          ‹
                        </button>

                        {isLastStage ? (
                          <span className="flex-1 rounded-md bg-green-600 px-3 py-2 text-center text-sm font-bold text-white">
                            ✓ Finished
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleMoveStage(1)}
                            className="min-w-0 flex-1 truncate rounded-md bg-primary px-3 py-2 text-sm font-bold text-on-primary transition hover:bg-primary-hover"
                          >
                            {currentStageIndex < 0
                              ? `Start ${workflowStages[0].name}`
                              : `${workflowStages[currentStageIndex].name} done →`}
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Visor de la etapa elegida */}
                    {viewedStage && (() => {
                      const stageImages = getStageImages(activeCommission.id, viewedStage.id);
                      const imageIndex = getActiveStageImageIndex(viewedStage.id, stageImages);
                      const mainImage = stageImages[imageIndex] ?? null;
                      const dropId = `stage:${viewedStage.id}`;

                      return (
                        <div className="col-start-2 row-span-2 row-start-1 flex min-h-0 min-w-0 flex-col min-[1400px]:row-span-1">
                          <div className="mb-2 flex items-baseline justify-between gap-3">
                            <p className="text-sm font-black">
                              {viewedStage.name}
                              <span className="ml-2 text-xs font-normal text-faint">
                                Stage {workflowStages.indexOf(viewedStage) + 1} of {workflowStages.length}
                                {mainImage && ` · ${mainImage.label}`}
                              </span>
                            </p>

                            {mainImage && (
                              <button
                                type="button"
                                onClick={() => handleDeleteStageImage(mainImage.id)}
                                className="rounded-sm px-2 py-1 text-xs font-semibold text-red-500 transition hover:bg-red-50"
                              >
                                Remove image
                              </button>
                            )}
                          </div>

                          {mainImage ? (
                            <button
                              type="button"
                              title="View full size"
                              onClick={() => setZoomedImage(imageUrl(mainImage.image_data_url))}
                              className="flex min-h-0 w-full flex-1 cursor-zoom-in items-center justify-center rounded-md bg-paper p-2"
                            >
                              <img
                                src={imageUrl(mainImage.image_data_url)}
                                alt={mainImage.label}
                                className="max-h-full max-w-full rounded-sm object-contain"
                              />
                            </button>
                          ) : (
                            <button
                              type="button"
                              data-image-drop={dropId}
                              disabled={importingStageId !== null}
                              onClick={() => handleAddStageImages(viewedStage.id)}
                              className={`flex min-h-48 w-full flex-1 flex-col items-center justify-center rounded-md border border-dashed text-sm transition ${
                                dragZoneId === dropId
                                  ? "border-ink bg-highlight text-ink"
                                  : "border-line-strong text-muted hover:border-ink hover:text-ink"
                              }`}
                            >
                              <span className="text-2xl">+</span>
                              {importingStageId === viewedStage.id
                                ? "Optimizing…"
                                : "Click, drop images here or paste with Ctrl+V"}
                            </button>
                          )}

                          {stageImages.length > 0 && (
                            <div className="mt-2 flex shrink-0 flex-wrap gap-2 p-1">
                              {stageImages.map((image, index) => (
                                <button
                                  key={image.id}
                                  type="button"
                                  title={image.label}
                                  onClick={() =>
                                    setActiveStageImageIndexByStageId((current) => ({
                                      ...current,
                                      [viewedStage.id]: index,
                                    }))
                                  }
                                  className={`h-14 w-14 overflow-hidden rounded-sm transition ${
                                    index === imageIndex ? "ring-2 ring-ink ring-offset-2 ring-offset-surface" : "opacity-70 hover:opacity-100"
                                  }`}
                                >
                                  <img
                                    src={thumbUrl(image.image_data_url)}
                                    loading="lazy" decoding="async"
                                    alt={image.label}
                                    className="h-full w-full object-cover"
                                  />
                                </button>
                              ))}

                              <button
                                type="button"
                                data-image-drop={`${dropId}:alt`}
                                title="Add images: click, drop or Ctrl+V"
                                disabled={importingStageId !== null}
                                onClick={() => handleAddStageImages(viewedStage.id)}
                                className={`flex h-14 w-14 items-center justify-center rounded-sm border border-dashed text-lg transition ${
                                  dragZoneId === `${dropId}:alt`
                                    ? "border-ink bg-highlight text-ink"
                                    : "border-line-strong text-faint hover:border-ink hover:text-ink"
                                }`}
                              >
                                {importingStageId === viewedStage.id ? "…" : "+"}
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </>
                )}

                {/* Pago, notas y personajes: debajo en ventanas estrechas, columna propia en anchas */}
                <div className="col-start-1 row-start-2 min-h-0 space-y-5 overflow-y-auto min-[1400px]:col-start-3 min-[1400px]:row-start-1">
                <CommissionPayments
                  commission={activeCommission}
                  payments={paymentsByCommissionId[activeCommission.id] ?? []}
                  onChange={loadPayments}
                />

                {(activeCommission.notes || activeCharacters.length > 0) && (
                  <div className="space-y-5">
                    {activeCommission.notes && (
                      <div>
                        <p className="mb-2 text-[11px] font-black uppercase tracking-[0.16em] text-faint">Notes</p>
                        <p className="whitespace-pre-wrap text-sm text-muted">{activeCommission.notes}</p>
                      </div>
                    )}

                    {activeCharacters.length > 0 && (
                      <div>
                        <p className="mb-2 text-[11px] font-black uppercase tracking-[0.16em] text-faint">Characters</p>
                        <div className="space-y-2">
                          {activeCharacters.map((character) => (
                            <div key={character.id} className="flex items-center gap-2">
                              <span className="w-24 shrink-0 truncate text-sm font-semibold">{character.name}</span>
                              <div className="flex flex-wrap gap-1">
                                {(referencesByCharacterId[character.id] ?? []).map((reference) => (
                                  <button
                                    key={reference.id}
                                    type="button"
                                    title={reference.label}
                                    onClick={() => setZoomedImage(imageUrl(reference.image_data_url))}
                                    className="cursor-zoom-in"
                                  >
                                    <img
                                      src={thumbUrl(reference.image_data_url)}
                                      loading="lazy" decoding="async"
                                      alt={reference.label}
                                      className="h-10 w-10 rounded-sm object-cover"
                                    />
                                  </button>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
                </div>
                </div>
              </div>
            ) : commissions.length === 0 ? (
              <div className="flex h-full items-center justify-center">
                <div className="max-w-md text-center">
                  <h4 className="text-xl font-black">No commissions yet</h4>
                  <p className="mt-2 text-sm leading-relaxed text-muted">
                    Create your first commission to start building your workflow.
                  </p>
                </div>
              </div>
            ) : filteredCommissions.length === 0 ? (
              <div className="flex h-full items-center justify-center">
                <div className="max-w-md text-center">
                  <h4 className="text-xl font-black">No matches</h4>
                  <p className="mt-2 text-sm leading-relaxed text-muted">
                    No commissions match your current search or filters.
                  </p>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-4">
                {filteredCommissions.map((commission) => {
                  const tags = commissionTagsById[commission.id] ?? [];
                  const normalTags = getNormalTags(tags);
                  const commissionImages = stageImagesByCommissionId[commission.id] ?? [];
                  const latestImage = commissionImages.length > 0 ? commissionImages[commissionImages.length - 1] : null;
                  const altCount = commissionImages.length;
                  const completionPercentage = getCommissionCompletionPercentage(commission);
                  const deadlineStatus = getDeadlineStatus(commission.deadline);
                  const commissionCharacterIds = commissionCharactersById[commission.id] ?? [];
                  const commissionCharacters = Object.values(charactersByClientId).flat().filter((character) => commissionCharacterIds.includes(character.id), );

                  return (
                    <button
                      key={commission.id}
                      onClick={() => handleOpenCommission(commission)}
                      className="min-w-0 rounded-3xl border border-line bg-paper p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-ink hover:shadow-md"
                    >
                      {latestImage && (
                        <div
                          onClick={(event) => {
                            event.stopPropagation();
                            setZoomedImage(imageUrl(latestImage.image_data_url));
                          }}
                          className="mb-3 cursor-zoom-in overflow-hidden rounded-2xl bg-surface shadow-sm transition hover:scale-[1.02]"
                        >
                          <img
                            src={thumbUrl(latestImage.image_data_url)}
                            loading="lazy" decoding="async"
                            alt={commission.title}
                            className="h-auto w-full object-contain"
                          />
                        </div>
                      )}
                      {(() => {
                        const status = PAYMENT_STATUS_STYLE[
                          paymentSummary(commission.price, paymentsByCommissionId[commission.id] ?? []).status
                        ];

                        return (
                          <span className={`mb-2 inline-flex rounded-sm px-2 py-0.5 text-xs font-bold ${status.className}`}>
                            {status.label}
                          </span>
                        );
                      })()}

                      <h4 className="break-words font-black leading-tight">
                        {commission.title}
                      </h4>

                      {commissionCharacters.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {commissionCharacters.map((character) => (
                            <span
                              key={character.id}
                              className="rounded-sm border border-line-strong bg-surface px-3 py-1 text-xs font-black text-muted shadow-sm"
                            >
                              {character.name}
                            </span>
                          ))}
                        </div>
                      )}

                      {normalTags.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {normalTags.map((tag) => (
                            <span
                              key={tag.id}
                              title={tag.name}
                              className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-xl text-[0px] font-black text-white shadow-sm xl:w-auto xl:max-w-full xl:rounded-sm xl:px-3 xl:text-xs"
                              style={{ backgroundColor: tag.color }}
                            >
                              <span className="hidden truncate xl:block">
                                {tag.name}
                              </span>
                            </span>
                          ))}
                        </div>
                      )}

                      <p className="mt-2 text-sm font-semibold text-muted">
                        {commission.client_name || "No client"}
                      </p>

                      <p className="mt-1 text-xs text-faint">
                        {commission.platform || "No platform"}
                      </p>

                      <div className="mt-3">
                        <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-[0.14em] text-faint">
                          <span>Progress</span>
                          <span>{completionPercentage}%</span>
                        </div>

                        <div className="mt-2 h-2 overflow-hidden rounded-sm bg-surface">
                          <div
                            className={
                              completionPercentage === 100
                                ? "h-full rounded-sm bg-green-500"
                                : "h-full rounded-sm bg-primary"
                            }
                            style={{ width: `${completionPercentage}%` }}
                          />
                        </div>
                      </div>

                      <div className="mt-4 flex flex-wrap items-center gap-2">
                        {altCount > 0 && (
                          <span className="rounded-sm border border-line-strong bg-surface px-3 py-1 text-xs font-black text-muted shadow-sm">
                            📷 {altCount} {altCount === 1 ? "Alt" : "Alts"}
                          </span>
                        )}

                        <span className="rounded-sm bg-surface px-3 py-1 text-xs font-bold text-ink shadow-sm">
                          {commission.price
                            ? formatMoney(commission.price, commission.currency)
                            : "No price"}
                        </span>

                        {deadlineStatus ? (
                          <span
                            className={`rounded-sm px-3 py-1 text-xs font-black shadow-sm ${deadlineStatus.className}`}
                          >
                            {deadlineStatus.label}
                          </span>
                        ) : (
                          <span className="rounded-sm bg-surface px-3 py-1 text-xs font-bold text-ink shadow-sm">
                            No deadline
                          </span>
                        )}
                      </div>

                      {commission.notes && (
                        <p className="mt-4 line-clamp-3 text-sm leading-relaxed text-muted">
                          {commission.notes}
                        </p>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {!activeCommission && (
        <aside className="h-full min-h-0 overflow-hidden rounded-3xl border border-line bg-surface p-5 shadow-sm">
          <div className="max-h-full overflow-y-auto rounded-3xl border border-line bg-paper p-4">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-faint">
              Calendar
            </p>

            <p className="mt-2 text-lg font-black">
              {currentMonth} {currentYear}
            </p>

            {selectedDeadlineCommission && (
              <div className="mt-4 rounded-2xl bg-surface p-4 shadow-sm">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-faint">
                  Next deadline
                </p>

                <p className="mt-2 text-sm font-black">
                  {selectedDeadlineCommission.title}
                </p>

                <p className="mt-1 text-xs text-muted">
                  {selectedDeadlineCommission.deadline}
                </p>

                <p className="mt-3 rounded-sm bg-amber-100 px-3 py-1 text-xs font-bold text-amber-900">
                  {daysUntilSelectedDeadline !== null
                    ? `${daysUntilSelectedDeadline} days left`
                    : "No date"}
                </p>
              </div>
            )}

            <div className="mt-4 grid grid-cols-7 gap-2 text-center text-xs font-bold text-faint">
              <span>Mon</span>
              <span>Tue</span>
              <span>Wed</span>
              <span>Thu</span>
              <span>Fri</span>
              <span>Sat</span>
              <span>Sun</span>
            </div>

            <div className="mt-3 grid grid-cols-7 gap-2">
              {calendarDays.map((day, index) => {
                const deadlineDate = selectedDeadlineCommission?.deadline
                  ? new Date(selectedDeadlineCommission.deadline)
                  : null;

                const cellDate =
                  day !== null
                    ? new Date(currentYear, today.getMonth(), day)
                    : null;

                const isToday =
                  cellDate !== null &&
                  cellDate.toDateString() === today.toDateString();

                const isInDeadlineRange =
                  cellDate !== null &&
                  deadlineDate !== null &&
                  cellDate >= new Date(today.getFullYear(), today.getMonth(), today.getDate()) &&
                  cellDate < deadlineDate;

                const isDeadlineDay =
                  cellDate !== null &&
                  deadlineDate !== null &&
                  cellDate.toDateString() === deadlineDate.toDateString();

                return (
                  <div
                    key={index}
                    className={
                      isDeadlineDay
                        ? "flex aspect-square items-center justify-center rounded-xl bg-red-500 text-xs font-black text-white"
                        : isToday
                          ? "flex aspect-square items-center justify-center rounded-xl bg-primary-hover text-xs font-black text-on-primary shadow-sm"
                          : isInDeadlineRange
                            ? "flex aspect-square items-center justify-center rounded-xl bg-amber-100 text-xs font-bold text-amber-900"
                            : "flex aspect-square items-center justify-center rounded-xl bg-surface text-xs font-bold text-faint"
                    }
                  >
                    {day ?? ""}
                  </div>
                );
              })}
            </div>

            {selectedDeadlineCommission?.deadline && (
              <div className="mt-4 rounded-2xl bg-surface p-4 shadow-sm">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-faint">
                  Deadline summary
                </p>

                <div className="mt-3 space-y-3 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-semibold text-muted">Today</span>
                    <span className="font-bold text-ink">
                      {today.toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                      })}
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-3">
                    <span className="font-semibold text-muted">Deadline</span>
                    <span className="font-bold text-red-600">
                      {new Date(selectedDeadlineCommission.deadline).toLocaleDateString(
                        "en-US",
                        {
                          month: "short",
                          day: "numeric",
                        },
                      )}
                    </span>
                  </div>

                  <div className="rounded-sm bg-amber-100 px-3 py-2 text-center text-xs font-black text-amber-900">
                    {daysUntilSelectedDeadline !== null
                      ? daysUntilSelectedDeadline > 0
                        ? `${daysUntilSelectedDeadline} days left`
                        : daysUntilSelectedDeadline === 0
                          ? "Due today"
                          : `${Math.abs(daysUntilSelectedDeadline)} days overdue`
                      : "No deadline"}
                  </div>
                </div>
              </div>
            )}
          </div>
        </aside>
        )}
      </section>
      {showNewCommissionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
          <div className="flex max-h-[90vh] w-[650px] flex-col rounded-3xl border border-line bg-surface shadow-2xl">
            <div className="shrink-0 px-6 pt-6">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-faint">
                New commission
              </p>

              <h3 className="mt-2 text-2xl font-black text-ink">
                Create commission
              </h3>
            </div>

            <div className="flex-1 overflow-y-auto p-6">

              <div className="mt-6 grid grid-cols-2 gap-4">
                <input
                  value={commissionTitle}
                  onChange={(event) => setCommissionTitle(event.target.value)}
                  placeholder="Commission title"
                  className="col-span-2 rounded-2xl border border-line-strong bg-paper px-4 py-3"
                />

                <div className="col-span-2">
                  <p className="mb-3 text-xs font-bold uppercase tracking-[0.16em] text-faint">
                    Commissioners
                  </p>

                  <div className="flex flex-wrap gap-2">
                    {clients.map((client) => {
                      const selected = selectedClientIds.includes(client.id);

                      return (
                        <button
                          key={client.id}
                          type="button"
                          onClick={() => {
                            setSelectedClientIds((current) => {
                              if (selected) {
                                return current.filter((id) => id !== client.id);
                              }

                              return [...current, client.id];
                            });

                            if (!selectedClientId) {
                              setSelectedClientId(client.id);
                              setClientName(client.name);
                              setPlatform(client.platform || "Discord");
                            }
                          }}
                          className={
                            selected
                              ? "rounded-sm bg-primary px-4 py-2 text-sm font-black text-on-primary"
                              : "rounded-sm border border-line-strong bg-surface px-4 py-2 text-sm font-bold text-muted"
                          }
                        >
                          {client.name}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="col-span-2">
                  <p className="mb-3 text-xs font-bold uppercase tracking-[0.16em] text-faint">
                    Characters
                  </p>

                  {selectedClientIds.length === 0 ? (
                    <p className="rounded-2xl border border-dashed border-line-strong bg-paper px-4 py-3 text-sm text-faint">
                      Select one or more commissioners first.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {selectedClientIds.map((clientId) => {
                        const client = clients.find((item) => item.id === clientId);
                        const characters = charactersByClientId[clientId] ?? [];

                        return (
                          <div
                            key={clientId}
                            className="rounded-2xl border border-line bg-paper p-3"
                          >
                            <p className="mb-2 text-xs font-black uppercase tracking-[0.14em] text-faint">
                              {client?.name || "Client"}
                            </p>

                            {characters.length === 0 ? (
                              <p className="text-sm text-faint">
                                No characters saved for this client.
                              </p>
                            ) : (
                              <div className="flex flex-wrap gap-2">
                                {characters.map((character) => {
                                  const selected = selectedCharacterIds.includes(character.id);

                                  return (
                                    <button
                                      key={character.id}
                                      type="button"
                                      onClick={() => {
                                        const nextIds = selected
                                          ? selectedCharacterIds.filter((id) => id !== character.id)
                                          : [...selectedCharacterIds, character.id];

                                        setSelectedCharacterIds(nextIds);
                                        applyAutoPrice(selectedTemplateId, nextIds.length);
                                      }}
                                      className={
                                        selected
                                          ? "rounded-sm bg-primary px-4 py-2 text-sm font-black text-on-primary"
                                          : "rounded-sm border border-line-strong bg-surface px-4 py-2 text-sm font-bold text-muted"
                                      }
                                    >
                                      {character.name}
                                    </button>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {selectedCharacterIds.length > 0 && (
                  <div className="col-span-2 rounded-3xl border border-line bg-paper p-4">
                    <p className="mb-3 text-xs font-bold uppercase tracking-[0.16em] text-faint">
                      Selected references
                    </p>

                    <div className="space-y-4">
                      {selectedCharacterIds.map((characterId) => {
                        const character = Object.values(charactersByClientId)
                          .flat()
                          .find((item) => item.id === characterId);

                        const references =
                          referencesByCharacterId[characterId] ?? [];

                        return (
                          <div key={characterId}>
                            <p className="mb-2 text-sm font-black text-ink">
                              {character?.name || "Character"}
                            </p>

                            {references.length === 0 ? (
                              <p className="text-sm text-faint">
                                No references saved.
                              </p>
                            ) : (
                              <div className="grid grid-cols-4 gap-2">
                                {references.map((reference) => (
                                  <button
                                    key={reference.id}
                                    type="button"
                                    onClick={() =>
                                      setZoomedImage(imageUrl(reference.image_data_url))
                                    }
                                    className="overflow-hidden rounded-2xl border border-line bg-surface shadow-sm"
                                  >
                                    <img
                                      src={thumbUrl(reference.image_data_url)}
                                      loading="lazy" decoding="async"
                                      alt={reference.label}
                                      className="h-20 w-full object-cover"
                                    />
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                <select
                  value={platform}
                  onChange={(event) => setPlatform(event.target.value)}
                  className="rounded-2xl border border-line-strong bg-paper px-4 py-3"
                >
                  <option>Discord</option>
                  <option>Twitter / X</option>
                  <option>Bluesky</option>
                  <option>Telegram</option>
                  <option>Email</option>
                  <option>Other</option>
                </select>

                <select
                  value={selectedTemplateId ?? ""}
                  onChange={(event) => {
                    const templateId = event.target.value ? Number(event.target.value) : null;
                    setSelectedTemplateId(templateId);
                    applyAutoPrice(templateId, selectedCharacterIds.length);
                  }}
                  className="col-span-2 rounded-2xl border border-line-strong bg-paper px-4 py-3"
                >
                  <option value="">Select template</option>
                  {templates.map((template) => (
                    <option key={template.id} value={template.id}>
                      {template.name}
                    </option>
                  ))}
                </select>

                <div>
                  <input
                    value={commissionPrice}
                    onChange={(event) => setCommissionPrice(event.target.value)}
                    placeholder="Price, e.g. 186,84"
                    inputMode="decimal"
                    className="w-full rounded-2xl border border-line-strong bg-paper px-4 py-3"
                  />
                  {autoPriceHint && <p className="mt-1 px-1 text-[11px] text-faint">{autoPriceHint}</p>}
                </div>

                <select
                  value={currency}
                  onChange={(event) => setCurrency(event.target.value)}
                  className="rounded-2xl border border-line-strong bg-paper px-4 py-3"
                >
                  <option>EUR</option>
                  <option>USD</option>
                  <option>GBP</option>
                </select>

                <label className="col-span-2 flex items-center gap-3 rounded-2xl border border-line-strong bg-paper px-4 py-3 text-sm font-semibold">
                  <input
                    type="checkbox"
                    checked={hasDeadline}
                    onChange={(event) => setHasDeadline(event.target.checked)}
                  />
                  This commission has a deadline
                </label>

                {hasDeadline && (
                  <input
                    type="date"
                    value={commissionDeadline}
                    onChange={(event) => setCommissionDeadline(event.target.value)}
                    className="col-span-2 rounded-2xl border border-line-strong bg-paper px-4 py-3"
                  />
                )}

                <textarea
                  value={commissionNotes}
                  onChange={(event) => setCommissionNotes(event.target.value)}
                  placeholder="Notes"
                  rows={4}
                  className="col-span-2 rounded-2xl border border-line-strong bg-paper px-4 py-3"
                />
                <div className="col-span-2">
                  <p className="mb-3 text-xs font-bold uppercase tracking-[0.16em] text-faint">
                    Tags
                  </p>

                  <div className="flex flex-wrap gap-2">
                    {allTags.map((tag) => {
                      const selected =
                        selectedTagIds.includes(tag.id);

                      return (
                        <button
                          key={tag.id}
                          type="button"
                          onClick={() => {
                            setSelectedTagIds((current) => {
                              if (selected) {
                                return current.filter((id) => id !== tag.id);
                              }

                              const exclusiveCategories = ["Payment", "Characters"];

                              if (exclusiveCategories.includes(tag.category)) {
                                const otherTagsInSameCategory = allTags
                                  .filter((otherTag) => otherTag.category === tag.category)
                                  .map((otherTag) => otherTag.id);

                                return [
                                  ...current.filter(
                                    (id) => !otherTagsInSameCategory.includes(id),
                                  ),
                                  tag.id,
                                ];
                              }

                              return [...current, tag.id];
                            });
                          }}
                          className={
                            selected
                              ? "rounded-sm px-4 py-2 text-sm font-black text-white shadow-sm"
                              : "rounded-sm border border-line-strong bg-surface px-4 py-2 text-sm font-bold text-muted"
                          }
                          style={
                            selected
                              ? {
                                  backgroundColor: tag.color,
                                }
                              : undefined
                          }
                        >
                          {tag.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

            </div>

            <div className="flex shrink-0 justify-end gap-3 border-t border-line p-6">
              <button
                onClick={() => setShowNewCommissionModal(false)}
                className="rounded-2xl border border-line-strong px-4 py-2 font-semibold"
              >
                Cancel
              </button>

              <button
                onClick={handleCreateCommission}
                disabled={creatingCommission}
                className={
                  commissionCreated
                    ? "rounded-2xl bg-green-600 px-4 py-2 font-bold text-white transition-all duration-300"
                    : "rounded-2xl bg-primary px-4 py-2 font-bold text-on-primary transition-all duration-300 hover:-translate-y-0.5"
                }
              >
                {creatingCommission
                  ? "Creating..."
                  : commissionCreated
                    ? "✓ Created"
                    : "Create"}
              </button>
            </div>
          </div>
        </div>
      )}
      {showEditCommissionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
          <div className="w-[650px] rounded-3xl border border-line bg-surface p-6 shadow-2xl">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-faint">
              Edit commission
            </p>

            <h3 className="mt-2 text-2xl font-black text-ink">
              Update commission
            </h3>

            <div className="mt-6 grid grid-cols-2 gap-4">
              <input
                value={commissionTitle}
                onChange={(event) => setCommissionTitle(event.target.value)}
                placeholder="Commission title"
                className="col-span-2 rounded-2xl border border-line-strong bg-paper px-4 py-3"
              />

              <select
                value={selectedClientId ?? ""}
                onChange={(event) => {
                  const clientId = event.target.value
                    ? Number(event.target.value)
                    : null;

                  setSelectedClientId(clientId);

                  const selectedClient =
                    clients.find((client) => client.id === clientId) ?? null;

                  setClientName(selectedClient?.name || "");
                  setPlatform(selectedClient?.platform || "Discord");
                }}
                className="rounded-2xl border border-line-strong bg-paper px-4 py-3"
              >
                <option value="">Select client</option>

                {clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.name}
                    {client.handle ? ` · ${client.handle}` : ""}
                  </option>
                ))}
              </select>

              <select
                value={platform}
                onChange={(event) => setPlatform(event.target.value)}
                className="rounded-2xl border border-line-strong bg-paper px-4 py-3"
              >
                <option>Discord</option>
                <option>Twitter / X</option>
                <option>Bluesky</option>
                <option>Telegram</option>
                <option>Email</option>
                <option>Other</option>
              </select>

              <input
                value={commissionPrice}
                onChange={(event) => setCommissionPrice(event.target.value)}
                placeholder="Price, e.g. 186,84"
                inputMode="decimal"
                className="rounded-2xl border border-line-strong bg-paper px-4 py-3"
              />

              <select
                value={currency}
                onChange={(event) => setCurrency(event.target.value)}
                className="rounded-2xl border border-line-strong bg-paper px-4 py-3"
              >
                <option>EUR</option>
                <option>USD</option>
                <option>GBP</option>
              </select>

              <label className="col-span-2 flex items-center gap-3 rounded-2xl border border-line-strong bg-paper px-4 py-3 text-sm font-semibold">
                <input
                  type="checkbox"
                  checked={hasDeadline}
                  onChange={(event) => setHasDeadline(event.target.checked)}
                />
                This commission has a deadline
              </label>

              {hasDeadline && (
                <input
                  type="date"
                  value={commissionDeadline}
                  onChange={(event) => setCommissionDeadline(event.target.value)}
                  className="col-span-2 rounded-2xl border border-line-strong bg-paper px-4 py-3"
                />
              )}

              <textarea
                value={commissionNotes}
                onChange={(event) => setCommissionNotes(event.target.value)}
                placeholder="Notes"
                rows={4}
                className="col-span-2 rounded-2xl border border-line-strong bg-paper px-4 py-3"
              />
              <div className="col-span-2">
                <p className="mb-3 text-xs font-bold uppercase tracking-[0.16em] text-faint">
                  Tags
                </p>

                <div className="flex flex-wrap gap-2">
                  {allTags.map((tag) => {
                    const selected = selectedTagIds.includes(tag.id);

                    return (
                      <button
                        key={tag.id}
                        type="button"
                        onClick={() => {
                          setSelectedTagIds((current) => {
                            if (selected) {
                              return current.filter((id) => id !== tag.id);
                            }

                            const exclusiveCategories = ["Payment", "Characters"];

                            if (exclusiveCategories.includes(tag.category)) {
                              const otherTagsInSameCategory = allTags
                                .filter((otherTag) => otherTag.category === tag.category)
                                .map((otherTag) => otherTag.id);

                              return [
                                ...current.filter(
                                  (id) => !otherTagsInSameCategory.includes(id),
                                ),
                                tag.id,
                              ];
                            }

                            return [...current, tag.id];
                          });
                        }}
                        className={
                          selected
                            ? "rounded-sm px-4 py-2 text-sm font-black text-white shadow-sm"
                            : "rounded-sm border border-line-strong bg-surface px-4 py-2 text-sm font-bold text-muted"
                        }
                        style={
                          selected
                            ? { backgroundColor: tag.color }
                            : undefined
                        }
                      >
                        {tag.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setShowEditCommissionModal(false)}
                className="rounded-2xl border border-line-strong px-4 py-2 font-semibold"
              >
                Cancel
              </button>

              <button
                onClick={handleSaveCommissionChanges}
                disabled={savingCommission}
                className={
                  commissionSaved
                    ? "rounded-2xl bg-green-600 px-4 py-2 font-bold text-white transition-all duration-300"
                    : "rounded-2xl bg-primary px-4 py-2 font-bold text-on-primary transition-all duration-300 hover:-translate-y-0.5"
                }
              >
                {savingCommission
                  ? "Saving..."
                  : commissionSaved
                    ? "✓ Saved"
                    : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
      {showDeleteCommissionModal && (
        <ConfirmModal
            eyebrow="Delete commission"
            title={activeCommission?.title ?? ""}
            message="This action cannot be undone."
            confirmLabel="Delete"
            confirmingLabel="Deleting..."
            isConfirming={deletingCommission}
            onConfirm={handleDeleteCommission}
            onCancel={() => setShowDeleteCommissionModal(false)}
        />
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
    </div>
  );
}

export default CommissionsPage;