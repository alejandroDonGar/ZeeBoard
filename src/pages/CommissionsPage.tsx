import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { imageUrl, thumbUrl, importImage, pickImagePaths } from "../lib/images";
import { useImageInput } from "../lib/useImageInput";
import {
  loadStageImagesForCommissions as loadStageImagesForCommissionsHelper,
  getCommissionCompletionPercentage as getCommissionCompletionPercentageHelper,
  isCommissionCompleted as isCommissionCompletedHelper,
  getDeadlineStatus,
} from "../lib/commissionHelpers";
import {
  getTemplateStages,
  getTemplates,
  createCommission,
  getCommissions,
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
  const [commissionDuplicated, setCommissionDuplicated] = useState(false);
  const [showDeleteCommissionModal, setShowDeleteCommissionModal] = useState(false);
  const [deletingCommission, setDeletingCommission] = useState(false);
  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>([]);
  const [commissionTagsById, setCommissionTagsById] = useState<Record<number, Tag[]>>({});
  const [stageImagesByCommissionId, setStageImagesByCommissionId] = useState<Record<number, CommissionStageImage[]>>({});
  const [activeStageImageIndexByStageId, setActiveStageImageIndexByStageId] = useState<Record<number, number>>({});
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);
  const [importingStageId, setImportingStageId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterTagIds, setFilterTagIds] = useState<number[]>([]);
  const [filterStatus, setFilterStatus] = useState<"all" | "active" | "overdue">("all");
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
    const matchesTags =
        filterTagIds.length === 0 ||
        filterTagIds.every((tagId) => tags.some((tag) => tag.id === tagId));

    const isOverdue =
        commission.deadline !== null &&
        new Date(`${commission.deadline}T00:00:00`) < new Date(new Date().toDateString());

    const matchesStatus =
        filterStatus === "all" ||
        (filterStatus === "active" && !isOverdue) ||
        (filterStatus === "overdue" && isOverdue);

    return matchesSearch && matchesTags && matchesStatus;
    });

    const hasActiveFilters =
    searchQuery.trim() !== "" || filterTagIds.length > 0 || filterStatus !== "all";

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
        commissionPrice ? Number(commissionPrice) : null,
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
    showToast(`Commission error: ${error}`, "error");
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

  async function loadTagsForCommissions(data: Commission[]) {
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

  async function handleMoveToNextStage() {
    if (!activeCommission || workflowStages.length === 0) {
      return;
    }

    const currentStageIndex = workflowStages.findIndex(
      (stage) => stage.id === activeCommission.current_stage_id,
    );

    const nextStage = workflowStages[currentStageIndex + 1];

    if (!nextStage) {
      return;
    }

    await updateCommissionStage(activeCommission.id, nextStage.id);

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
        commissionPrice ? Number(commissionPrice) : null,
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

        setCommissionDuplicated(true);
        showToast("Commission duplicated successfully.", "success");

        setTimeout(() => {
        setCommissionDuplicated(false);
        }, 1800);
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
      if (activeCommission?.current_stage_id) {
        handleAddStageImages(activeCommission.current_stage_id, files);
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

  function handlePreviousStageImage(stageId: number, images: CommissionStageImage[]) {
    setActiveStageImageIndexByStageId((current) => {
      const currentIndex = getActiveStageImageIndex(stageId, images);
      const nextIndex =
        currentIndex === 0 ? images.length - 1 : currentIndex - 1;

      return {
        ...current,
        [stageId]: nextIndex,
      };
    });
  }

  function handleNextStageImage(stageId: number, images: CommissionStageImage[]) {
    setActiveStageImageIndexByStageId((current) => {
      const currentIndex = getActiveStageImageIndex(stageId, images);
      const nextIndex =
        currentIndex === images.length - 1 ? 0 : currentIndex + 1;

      return {
        ...current,
        [stageId]: nextIndex,
      };
    });
  }

  const currentStageIndex = workflowStages.findIndex(
    (stage) => stage.id === activeCommission?.current_stage_id,
  );

  const isLastStage =
    workflowStages.length > 0 &&
    currentStageIndex === workflowStages.length - 1;

  const currentStageName =
    currentStageIndex >= 0
      ? workflowStages[currentStageIndex]?.name
      : workflowStages.length > 0
        ? `Working on ${workflowStages[0].name}`
        : "No stage";

  const progressText =
    currentStageIndex >= 0
      ? `${currentStageIndex + 1} / ${workflowStages.length}`
      : workflowStages.length > 0
        ? `0 / ${workflowStages.length}`
        : "No workflow";

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

  function getPaymentTag(tags: Tag[]) {
    return tags.find(isPaymentTag) ?? null;
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

  const activePaymentTag = getPaymentTag(activeCommissionTags);
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
        commissionTagsById={commissionTagsById}
        clients={clients}
        getPaymentTag={getPaymentTag}
        onSelectCommission={(commissionId) => setActiveCommissionId(commissionId)}
        onShowAllCommissions={() => setActiveCommissionId(null)}
        onCloseCommission={handleCloseCommissionTab}
      />

      <section className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_320px] gap-5 p-5 pb-6">
        <div className="h-full min-h-0 rounded-[2rem] border border-[#e1d8ca] bg-white p-5 shadow-sm">
          <div className="mb-5 flex items-center justify-between gap-4">
            <div>
              <h3 className="text-xl font-black">
                {activeCommission ? activeCommission.title : "Commission board"}
              </h3>

              <p className="mt-1 text-sm text-[#7c7163]">
                {activeCommission
                  ? `${activeCommission.client_name || "No client"} · ${
                      activeCommission.platform || "No platform"
                    }`
                  : "Start with a template, then move each commission through its own stages."}
              </p>
            </div>
          </div>

          <div className="h-[calc(100%-76px)] min-h-0 overflow-y-auto px-1 pt-2">
            {!activeCommission && commissions.length > 0 && (
                <div className="mb-4 space-y-3">
                    <div className="flex items-center gap-3">
                    <div className="relative flex-1">
                        <input
                        value={searchQuery}
                        onChange={(event) => setSearchQuery(event.target.value)}
                        placeholder="Search by title or client..."
                        className="w-full rounded-2xl border border-[#d8cec0] bg-[#fffaf2] px-4 py-2 text-sm"
                        />
                    </div>

                    <select
                        value={filterStatus}
                        onChange={(event) =>
                            setFilterStatus(event.target.value as typeof filterStatus)
                        }
                        className="rounded-2xl border border-[#d8cec0] bg-[#fffaf2] px-4 py-2 text-sm font-semibold"
                        >
                        <option value="all">All statuses</option>
                        <option value="active">Active</option>
                        <option value="overdue">Overdue</option>
                    </select>

                    {hasActiveFilters && (
                        <button
                        type="button"
                        onClick={() => {
                            setSearchQuery("");
                            setFilterTagIds([]);
                            setFilterStatus("all");
                        }}
                        className="flex items-center gap-1 rounded-2xl bg-[#1f2933] px-4 py-2 text-xs font-black text-white shadow-sm transition hover:-translate-y-0.5"
                        >
                        ✕ Clear filters
                        </button>
                    )}
                    </div>

                    {(() => {
                    const filterableTags = allTags.filter((tag) => tag.category !== "Characters");

                    const groupedFilterTags = filterableTags.reduce(
                        (groups, tag) => {
                        const category = tag.category || "General";

                        if (!groups[category]) {
                            groups[category] = [];
                        }

                        groups[category].push(tag);

                        return groups;
                        },
                        {} as Record<string, Tag[]>,
                    );

                    const categories = Object.entries(groupedFilterTags);

                    if (categories.length === 0) {
                        return null;
                    }

                    return (
                        <div className="flex flex-col gap-y-3 rounded-2xl border border-[#e6ded2] bg-[#fffaf2] p-3">
                        {categories.map(([category, categoryTags]) => (
                            <div key={category} className="grid w-full grid-cols-[110px_1fr] items-center gap-2">
                                <span className="whitespace-nowrap text-[10px] font-black uppercase tracking-[0.14em] text-[#9a8f82]">
                                {category}
                                </span>

                                <div className="flex flex-wrap gap-2">
                                {categoryTags.map((tag) => {
                                    const selected = filterTagIds.includes(tag.id);

                                    return (
                                    <button
                                        key={tag.id}
                                        type="button"
                                        onClick={() => {
                                        setFilterTagIds((current) =>
                                            selected
                                            ? current.filter((id) => id !== tag.id)
                                            : [...current, tag.id],
                                        );
                                        }}
                                        className={
                                        selected
                                            ? "rounded-full px-3 py-1 text-xs font-black text-white shadow-sm"
                                            : "rounded-full border border-[#d8cec0] bg-white px-3 py-1 text-xs font-bold text-[#7c7163]"
                                        }
                                        style={selected ? { backgroundColor: tag.color } : undefined}
                                    >
                                        {tag.name}
                                    </button>
                                    );
                                })}
                                </div>
                            </div>
                            ))}
                        </div>
                    );
                    })()}
                </div>
                )}
            {activeCommission ? (
              <div className="flex h-full min-h-0 flex-col gap-5">
                <aside className="shrink-0 rounded-[2rem] border border-[#e6ded2] bg-[#fffaf2] p-5">
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#9a8f82]">
                    Commission detail
                  </p>
                  <div className="mt-3 flex gap-2">
                    <button
                      onClick={handleOpenEditCommission}
                      className="rounded-2xl border border-[#d8cec0] bg-white px-4 py-2 text-sm font-bold text-[#1f2933] transition hover:border-[#1f2933]"
                    >
                      Edit
                    </button>

                    <button
                      onClick={handleDuplicateCommission}
                      disabled={duplicatingCommission}
                      className={
                        commissionDuplicated
                          ? "rounded-2xl bg-green-600 px-4 py-2 text-sm font-bold text-white transition-all duration-300"
                          : "rounded-2xl border border-[#d8cec0] bg-white px-4 py-2 text-sm font-bold text-[#1f2933] transition hover:border-[#1f2933] disabled:opacity-70"
                      }
                    >
                      {duplicatingCommission
                        ? "Duplicating..."
                        : commissionDuplicated
                          ? "✓ Duplicated"
                          : "Duplicate"}
                    </button>
                    <button
                      onClick={() => setShowDeleteCommissionModal(true)}
                      className="rounded-2xl border border-red-200 bg-red-50 px-4 py-2 text-sm font-bold text-red-600 transition hover:border-red-400"
                    >
                      Delete
                    </button>
                  </div>

                  <div className="mt-4 flex flex-wrap items-center gap-3">
                    {activePaymentTag && (
                      <div className="rounded-2xl border border-[#e6ded2] bg-white px-3 py-2 shadow-sm">
                        <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#9a8f82]">
                          Payment
                        </p>

                        <span
                          className="mt-1 inline-flex rounded-full px-3 py-1 text-xs font-black text-white"
                          style={{ backgroundColor: activePaymentTag.color }}
                        >
                          {activePaymentTag.name}
                        </span>
                      </div>
                    )}

                    {activeNormalTags.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {activeNormalTags.map((tag) => (
                          <span
                            key={tag.id}
                            className="rounded-full px-4 py-2 text-sm font-black text-white shadow-sm"
                            style={{ backgroundColor: tag.color }}
                          >
                            {tag.name}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="mt-4 grid grid-cols-7 gap-4">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#9a8f82]">
                        Title
                      </p>
                      <p className="mt-2 font-bold">{activeCommission.title}</p>
                    </div>

                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#9a8f82]">
                        Client
                      </p>
                      <p className="mt-2 font-bold">
                        {activeCommission.client_name || "No client"}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#9a8f82]">
                        Platform
                      </p>
                      <p className="mt-2 font-bold">
                        {activeCommission.platform || "No platform"}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#9a8f82]">
                        Price
                      </p>
                      <p className="mt-2 font-bold">
                        {activeCommission.price
                          ? `${activeCommission.price} ${activeCommission.currency || "EUR"}`
                          : "No price"}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#9a8f82]">
                        Deadline
                      </p>
                      <p className="mt-2 font-bold">
                        {activeCommission.deadline || "No deadline"}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#9a8f82]">
                        Current stage
                      </p>
                      <p className="mt-2 font-bold">
                        {currentStageName}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#9a8f82]">
                        Progress
                      </p>
                      <p className="mt-2 font-bold">
                        {progressText}
                      </p>
                    </div>
                  </div>
                </aside>

                <div className="shrink-0 rounded-[2rem] border border-[#e6ded2] bg-[#fffaf2] p-5">
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#9a8f82]">
                    Workflow
                  </p>

                  <div className="mt-4 flex min-h-[220px] items-start gap-3 overflow-x-auto pb-3">
                    {workflowStages.length === 0 ? (
                      <div className="rounded-3xl border border-dashed border-[#d8cec0] bg-white p-4 text-sm text-[#9a8f82]">
                        No template assigned.
                      </div>
                    ) : (
                      workflowStages.map((stage, index) => {
                        const stageImages = activeCommission
                          ? getStageImages(activeCommission.id, stage.id)
                          : [];

                        const activeImageIndex = getActiveStageImageIndex(stage.id, stageImages);
                        const mainStageImage = stageImages[activeImageIndex] ?? null;
                        const previousStageImage =
                          stageImages.length > 1
                            ? stageImages[
                                activeImageIndex === 0
                                  ? stageImages.length - 1
                                  : activeImageIndex - 1
                              ]
                            : null;

                        const nextStageImage =
                          stageImages.length > 1
                            ? stageImages[
                                activeImageIndex === stageImages.length - 1
                                  ? 0
                                  : activeImageIndex + 1
                              ]
                            : null;

                        return (
                          <div
                            key={stage.id}
                            className={
                              index < currentStageIndex
                                ? "min-w-[320px] flex-shrink-0 self-start rounded-3xl border border-green-300 bg-green-100 p-4 text-green-900 shadow-sm"
                                : index === currentStageIndex
                                  ? "min-w-[320px] flex-shrink-0 self-start rounded-3xl border border-amber-300 bg-amber-100 p-4 text-amber-900 shadow-sm"
                                  : "min-w-[320px] flex-shrink-0 self-start rounded-3xl border border-[#e6ded2] bg-white p-4 shadow-sm"
                            }
                          >
                            <div className="flex items-center gap-3">
                              <div
                                className={
                                  index < currentStageIndex
                                    ? "flex h-8 w-8 items-center justify-center rounded-full bg-green-600 text-xs font-black text-white"
                                    : index === currentStageIndex
                                      ? "flex h-8 w-8 items-center justify-center rounded-full bg-amber-500 text-xs font-black text-white"
                                      : "flex h-8 w-8 items-center justify-center rounded-full bg-[#1f2933] text-xs font-black text-white"
                                }
                              >
                                {index < currentStageIndex ? "✓" : index + 1}
                              </div>

                              <div>
                                <p className="font-bold">{stage.name}</p>
                                <p className="text-xs text-[#9a8f82]">Stage {index + 1}</p>
                              </div>
                            </div>

                            {mainStageImage && (
                              <div className="relative mt-4 overflow-hidden rounded-3xl border border-white/60 bg-white p-3 shadow-sm">
                                <div className="relative z-10">
                                  <div className="mb-2 flex items-center justify-between">
                                    <span className="rounded-full bg-white/90 px-3 py-1 text-[10px] font-black text-[#7c7163] shadow-sm">
                                      {mainStageImage.label}
                                    </span>

                                    <span className="rounded-full bg-white/90 px-3 py-1 text-[10px] font-black text-[#9a8f82] shadow-sm">
                                      {activeImageIndex + 1} / {stageImages.length}
                                    </span>
                                  </div>

                                  <div className="relative flex min-h-[220px] items-center justify-center">
                                    {stageImages.length > 1 && (
                                      <button
                                        type="button"
                                        onClick={() => handlePreviousStageImage(stage.id, stageImages)}
                                        className="absolute left-2 z-20 flex h-10 w-10 items-center justify-center rounded-full bg-[#1f2933] text-lg font-black text-white shadow-lg transition hover:scale-105"
                                      >
                                        ‹
                                      </button>
                                    )}
                                    {previousStageImage && (
                                      <img
                                        src={thumbUrl(previousStageImage.image_data_url)}
                                        loading="lazy" decoding="async"
                                        alt=""
                                        className="
                                          absolute
                                          left-4
                                          z-0
                                          max-h-[260px]
                                          scale-75
                                          rounded-2xl
                                          opacity-20
                                          blur-sm
                                          object-contain
                                          pointer-events-none
                                        "
                                      />
                                    )}

                                    {nextStageImage && (
                                      <img
                                        src={thumbUrl(nextStageImage.image_data_url)}
                                        loading="lazy" decoding="async"
                                        alt=""
                                        className="
                                          absolute
                                          right-4
                                          z-0
                                          max-h-[260px]
                                          scale-75
                                          rounded-2xl
                                          opacity-20
                                          blur-sm
                                          object-contain
                                          pointer-events-none
                                        "
                                      />
                                    )}
                                    <AnimatePresence mode="wait">
                                      <motion.img
                                        key={mainStageImage.id}
                                        src={imageUrl(mainStageImage.image_data_url)}
                                        alt={mainStageImage.label}
                                        initial={{
                                          opacity: 0,
                                          scale: 0.96,
                                          filter: "blur(6px)",
                                          x: 20,
                                        }}
                                        animate={{
                                          opacity: 1,
                                          scale: 1,
                                          filter: "blur(0px)",
                                          x: 0,
                                        }}
                                        exit={{
                                          opacity: 0,
                                          scale: 0.96,
                                          filter: "blur(6px)",
                                          x: -20,
                                        }}
                                        transition={{
                                          duration: 0.15,
                                          ease: "easeOut",
                                        }}
                                        className="mx-auto max-h-[360px] w-auto rounded-2xl object-contain shadow-sm"
                                      />
                                    </AnimatePresence>

                                    {stageImages.length > 1 && (
                                      <button
                                        type="button"
                                        onClick={() => handleNextStageImage(stage.id, stageImages)}
                                        className="absolute right-2 z-20 flex h-10 w-10 items-center justify-center rounded-full bg-[#1f2933] text-lg font-black text-white shadow-lg transition hover:scale-105"
                                      >
                                        ›
                                      </button>
                                    )}
                                  </div>

                                  <div className="mt-3 flex items-center justify-between">
                                    <p className="text-xs font-bold text-[#7c7163]">
                                      {stageImages.length === 1 ? "1 alt" : `${stageImages.length} alts`}
                                    </p>

                                    <button
                                      type="button"
                                      onClick={() => handleDeleteStageImage(mainStageImage.id)}
                                      className="rounded-full bg-red-50 px-3 py-1 text-xs font-black text-red-500 transition hover:bg-red-100"
                                    >
                                      Remove current
                                    </button>
                                  </div>
                                </div>
                              </div>
                            )}

                            <button
                              type="button"
                              data-image-drop={`stage:${stage.id}`}
                              title={
                                stage.id === activeCommission?.current_stage_id
                                  ? "Click, drop images here or paste with Ctrl+V"
                                  : "Click or drop images here"
                              }
                              disabled={importingStageId !== null}
                              onClick={() => handleAddStageImages(stage.id)}
                              className={`mt-4 block w-full cursor-pointer rounded-2xl border border-dashed px-3 py-3 text-center text-xs font-black transition hover:border-[#1f2933] disabled:cursor-wait disabled:opacity-60 ${
                                dragZoneId === `stage:${stage.id}`
                                  ? "scale-[1.02] border-[#1f2933] bg-[#f1e8da] text-[#1f2933]"
                                  : "border-[#d8cec0] bg-white text-[#7c7163]"
                              }`}
                            >
                              {importingStageId === stage.id
                                ? "Optimizing…"
                                : dragZoneId === `stage:${stage.id}`
                                  ? "Drop to add"
                                  : stageImages.length === 0
                                    ? "Add image"
                                    : "Add alt"}
                            </button>
                          </div>
                        );
                      })
                    )}
                  </div>
                  <button
                    onClick={handleMoveToNextStage}
                    disabled={isLastStage}
                    className={
                      isLastStage
                        ? "mt-5 rounded-2xl bg-green-600 px-5 py-3 text-sm font-bold text-white shadow-md"
                        : "mt-5 rounded-2xl bg-[#1f2933] px-5 py-3 text-sm font-bold text-white shadow-md transition hover:-translate-y-0.5 hover:shadow-lg"
                    }
                  >
                    {isLastStage ? "✓ Finished" : "Move to next stage"}
                  </button>
                </div>
              </div>
            ) : commissions.length === 0 ? (
              <div className="flex h-full items-center justify-center">
                <div className="max-w-md text-center">
                  <h4 className="text-xl font-black">No commissions yet</h4>
                  <p className="mt-2 text-sm leading-relaxed text-[#7c7163]">
                    Create your first commission to start building your workflow.
                  </p>
                </div>
              </div>
            ) : filteredCommissions.length === 0 ? (
              <div className="flex h-full items-center justify-center">
                <div className="max-w-md text-center">
                  <h4 className="text-xl font-black">No matches</h4>
                  <p className="mt-2 text-sm leading-relaxed text-[#7c7163]">
                    No commissions match your current search or filters.
                  </p>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-4">
                {filteredCommissions.map((commission) => {
                  const tags = commissionTagsById[commission.id] ?? [];
                  const paymentTag = getPaymentTag(tags);
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
                      className="min-w-0 rounded-3xl border border-[#e6ded2] bg-[#fffaf2] p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-[#1f2933] hover:shadow-md"
                    >
                      {latestImage && (
                        <div
                          onClick={(event) => {
                            event.stopPropagation();
                            setZoomedImage(imageUrl(latestImage.image_data_url));
                          }}
                          className="mb-3 cursor-zoom-in overflow-hidden rounded-2xl bg-white shadow-sm transition hover:scale-[1.02]"
                        >
                          <img
                            src={thumbUrl(latestImage.image_data_url)}
                            loading="lazy" decoding="async"
                            alt={commission.title}
                            className="h-auto w-full object-contain"
                          />
                        </div>
                      )}
                      {paymentTag && (
                        <div className="mt-3">
                          <p className="mb-1 text-[10px] font-black uppercase tracking-[0.16em] text-[#9a8f82]">
                            Payment
                          </p>

                          <span
                            className="inline-flex rounded-full px-3 py-1 text-xs font-black text-white shadow-sm"
                            style={{ backgroundColor: paymentTag.color }}
                          >
                            {paymentTag.name}
                          </span>
                        </div>
                      )}

                      <h4 className="break-words font-black leading-tight">
                        {commission.title}
                      </h4>

                      {commissionCharacters.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {commissionCharacters.map((character) => (
                            <span
                              key={character.id}
                              className="rounded-full border border-[#d8cec0] bg-white px-3 py-1 text-xs font-black text-[#7c7163] shadow-sm"
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
                              className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-xl text-[0px] font-black text-white shadow-sm xl:w-auto xl:max-w-full xl:rounded-full xl:px-3 xl:text-xs"
                              style={{ backgroundColor: tag.color }}
                            >
                              <span className="hidden truncate xl:block">
                                {tag.name}
                              </span>
                            </span>
                          ))}
                        </div>
                      )}

                      <p className="mt-2 text-sm font-semibold text-[#6f665c]">
                        {commission.client_name || "No client"}
                      </p>

                      <p className="mt-1 text-xs text-[#9a8f82]">
                        {commission.platform || "No platform"}
                      </p>

                      <div className="mt-3">
                        <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-[0.14em] text-[#9a8f82]">
                          <span>Progress</span>
                          <span>{completionPercentage}%</span>
                        </div>

                        <div className="mt-2 h-2 overflow-hidden rounded-full bg-white">
                          <div
                            className={
                              completionPercentage === 100
                                ? "h-full rounded-full bg-green-500"
                                : "h-full rounded-full bg-[#1f2933]"
                            }
                            style={{ width: `${completionPercentage}%` }}
                          />
                        </div>
                      </div>

                      <div className="mt-4 flex flex-wrap items-center gap-2">
                        {altCount > 0 && (
                          <span className="rounded-full border border-[#d8cec0] bg-white px-3 py-1 text-xs font-black text-[#7c7163] shadow-sm">
                            📷 {altCount} {altCount === 1 ? "Alt" : "Alts"}
                          </span>
                        )}

                        <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-[#1f2933] shadow-sm">
                          {commission.price
                            ? `${commission.price} ${commission.currency || "EUR"}`
                            : "No price"}
                        </span>

                        {deadlineStatus ? (
                          <span
                            className={`rounded-full px-3 py-1 text-xs font-black shadow-sm ${deadlineStatus.className}`}
                          >
                            {deadlineStatus.label}
                          </span>
                        ) : (
                          <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-[#1f2933] shadow-sm">
                            No deadline
                          </span>
                        )}
                      </div>

                      {commission.notes && (
                        <p className="mt-4 line-clamp-3 text-sm leading-relaxed text-[#7c7163]">
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

        <aside className="h-full min-h-0 overflow-hidden rounded-[2rem] border border-[#e1d8ca] bg-white p-5 shadow-sm">
          <div className="max-h-full overflow-y-auto rounded-3xl border border-[#e6ded2] bg-[#f9f4ec] p-4">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#9a8f82]">
              Calendar
            </p>

            <p className="mt-2 text-lg font-black">
              {currentMonth} {currentYear}
            </p>

            {selectedDeadlineCommission && (
              <div className="mt-4 rounded-2xl bg-white p-4 shadow-sm">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#9a8f82]">
                  Next deadline
                </p>

                <p className="mt-2 text-sm font-black">
                  {selectedDeadlineCommission.title}
                </p>

                <p className="mt-1 text-xs text-[#7c7163]">
                  {selectedDeadlineCommission.deadline}
                </p>

                <p className="mt-3 rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-900">
                  {daysUntilSelectedDeadline !== null
                    ? `${daysUntilSelectedDeadline} days left`
                    : "No date"}
                </p>
              </div>
            )}

            <div className="mt-4 grid grid-cols-7 gap-2 text-center text-xs font-bold text-[#9a8f82]">
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
                          ? "flex aspect-square items-center justify-center rounded-xl bg-[#2c3947] text-xs font-black text-[#fffaf2] shadow-sm"
                          : isInDeadlineRange
                            ? "flex aspect-square items-center justify-center rounded-xl bg-amber-100 text-xs font-bold text-amber-900"
                            : "flex aspect-square items-center justify-center rounded-xl bg-white text-xs font-bold text-[#9a8f82]"
                    }
                  >
                    {day ?? ""}
                  </div>
                );
              })}
            </div>

            {selectedDeadlineCommission?.deadline && (
              <div className="mt-4 rounded-2xl bg-white p-4 shadow-sm">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#9a8f82]">
                  Deadline summary
                </p>

                <div className="mt-3 space-y-3 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-semibold text-[#7c7163]">Today</span>
                    <span className="font-bold text-[#1f2933]">
                      {today.toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                      })}
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-3">
                    <span className="font-semibold text-[#7c7163]">Deadline</span>
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

                  <div className="rounded-full bg-amber-100 px-3 py-2 text-center text-xs font-black text-amber-900">
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
      </section>
      {showNewCommissionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
          <div className="flex max-h-[90vh] w-[650px] flex-col rounded-[2rem] border border-[#e1d8ca] bg-white shadow-2xl">
            <div className="shrink-0 px-6 pt-6">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#9a8f82]">
                New commission
              </p>

              <h3 className="mt-2 text-2xl font-black text-[#1f2933]">
                Create commission
              </h3>
            </div>

            <div className="flex-1 overflow-y-auto p-6">

              <div className="mt-6 grid grid-cols-2 gap-4">
                <input
                  value={commissionTitle}
                  onChange={(event) => setCommissionTitle(event.target.value)}
                  placeholder="Commission title"
                  className="col-span-2 rounded-2xl border border-[#d8cec0] bg-[#fffaf2] px-4 py-3"
                />

                <div className="col-span-2">
                  <p className="mb-3 text-xs font-bold uppercase tracking-[0.16em] text-[#9a8f82]">
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
                              ? "rounded-full bg-[#1f2933] px-4 py-2 text-sm font-black text-white"
                              : "rounded-full border border-[#d8cec0] bg-white px-4 py-2 text-sm font-bold text-[#7c7163]"
                          }
                        >
                          {client.name}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="col-span-2">
                  <p className="mb-3 text-xs font-bold uppercase tracking-[0.16em] text-[#9a8f82]">
                    Characters
                  </p>

                  {selectedClientIds.length === 0 ? (
                    <p className="rounded-2xl border border-dashed border-[#d8cec0] bg-[#fffaf2] px-4 py-3 text-sm text-[#9a8f82]">
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
                            className="rounded-2xl border border-[#e6ded2] bg-[#fffaf2] p-3"
                          >
                            <p className="mb-2 text-xs font-black uppercase tracking-[0.14em] text-[#9a8f82]">
                              {client?.name || "Client"}
                            </p>

                            {characters.length === 0 ? (
                              <p className="text-sm text-[#9a8f82]">
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
                                        setSelectedCharacterIds((current) =>
                                          selected
                                            ? current.filter((id) => id !== character.id)
                                            : [...current, character.id],
                                        );
                                      }}
                                      className={
                                        selected
                                          ? "rounded-full bg-[#1f2933] px-4 py-2 text-sm font-black text-white"
                                          : "rounded-full border border-[#d8cec0] bg-white px-4 py-2 text-sm font-bold text-[#7c7163]"
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
                  <div className="col-span-2 rounded-3xl border border-[#e6ded2] bg-[#fffaf2] p-4">
                    <p className="mb-3 text-xs font-bold uppercase tracking-[0.16em] text-[#9a8f82]">
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
                            <p className="mb-2 text-sm font-black text-[#1f2933]">
                              {character?.name || "Character"}
                            </p>

                            {references.length === 0 ? (
                              <p className="text-sm text-[#9a8f82]">
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
                                    className="overflow-hidden rounded-2xl border border-[#e6ded2] bg-white shadow-sm"
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
                  className="rounded-2xl border border-[#d8cec0] bg-[#fffaf2] px-4 py-3"
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
                  onChange={(event) =>
                    setSelectedTemplateId(
                      event.target.value ? Number(event.target.value) : null,
                    )
                  }
                  className="col-span-2 rounded-2xl border border-[#d8cec0] bg-[#fffaf2] px-4 py-3"
                >
                  <option value="">Select template</option>
                  {templates.map((template) => (
                    <option key={template.id} value={template.id}>
                      {template.name}
                    </option>
                  ))}
                </select>

                <input
                  value={commissionPrice}
                  onChange={(event) => setCommissionPrice(event.target.value)}
                  placeholder="Price"
                  className="rounded-2xl border border-[#d8cec0] bg-[#fffaf2] px-4 py-3"
                />

                <select
                  value={currency}
                  onChange={(event) => setCurrency(event.target.value)}
                  className="rounded-2xl border border-[#d8cec0] bg-[#fffaf2] px-4 py-3"
                >
                  <option>EUR</option>
                  <option>USD</option>
                  <option>GBP</option>
                </select>

                <label className="col-span-2 flex items-center gap-3 rounded-2xl border border-[#d8cec0] bg-[#fffaf2] px-4 py-3 text-sm font-semibold">
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
                    className="col-span-2 rounded-2xl border border-[#d8cec0] bg-[#fffaf2] px-4 py-3"
                  />
                )}

                <textarea
                  value={commissionNotes}
                  onChange={(event) => setCommissionNotes(event.target.value)}
                  placeholder="Notes"
                  rows={4}
                  className="col-span-2 rounded-2xl border border-[#d8cec0] bg-[#fffaf2] px-4 py-3"
                />
                <div className="col-span-2">
                  <p className="mb-3 text-xs font-bold uppercase tracking-[0.16em] text-[#9a8f82]">
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
                              ? "rounded-full px-4 py-2 text-sm font-black text-white shadow-sm"
                              : "rounded-full border border-[#d8cec0] bg-white px-4 py-2 text-sm font-bold text-[#7c7163]"
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

            <div className="flex shrink-0 justify-end gap-3 border-t border-[#e6ded2] p-6">
              <button
                onClick={() => setShowNewCommissionModal(false)}
                className="rounded-2xl border border-[#d8cec0] px-4 py-2 font-semibold"
              >
                Cancel
              </button>

              <button
                onClick={handleCreateCommission}
                disabled={creatingCommission}
                className={
                  commissionCreated
                    ? "rounded-2xl bg-green-600 px-4 py-2 font-bold text-white transition-all duration-300"
                    : "rounded-2xl bg-[#1f2933] px-4 py-2 font-bold text-white transition-all duration-300 hover:-translate-y-0.5"
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
          <div className="w-[650px] rounded-[2rem] border border-[#e1d8ca] bg-white p-6 shadow-2xl">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#9a8f82]">
              Edit commission
            </p>

            <h3 className="mt-2 text-2xl font-black text-[#1f2933]">
              Update commission
            </h3>

            <div className="mt-6 grid grid-cols-2 gap-4">
              <input
                value={commissionTitle}
                onChange={(event) => setCommissionTitle(event.target.value)}
                placeholder="Commission title"
                className="col-span-2 rounded-2xl border border-[#d8cec0] bg-[#fffaf2] px-4 py-3"
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
                className="rounded-2xl border border-[#d8cec0] bg-[#fffaf2] px-4 py-3"
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
                className="rounded-2xl border border-[#d8cec0] bg-[#fffaf2] px-4 py-3"
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
                placeholder="Price"
                className="rounded-2xl border border-[#d8cec0] bg-[#fffaf2] px-4 py-3"
              />

              <select
                value={currency}
                onChange={(event) => setCurrency(event.target.value)}
                className="rounded-2xl border border-[#d8cec0] bg-[#fffaf2] px-4 py-3"
              >
                <option>EUR</option>
                <option>USD</option>
                <option>GBP</option>
              </select>

              <label className="col-span-2 flex items-center gap-3 rounded-2xl border border-[#d8cec0] bg-[#fffaf2] px-4 py-3 text-sm font-semibold">
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
                  className="col-span-2 rounded-2xl border border-[#d8cec0] bg-[#fffaf2] px-4 py-3"
                />
              )}

              <textarea
                value={commissionNotes}
                onChange={(event) => setCommissionNotes(event.target.value)}
                placeholder="Notes"
                rows={4}
                className="col-span-2 rounded-2xl border border-[#d8cec0] bg-[#fffaf2] px-4 py-3"
              />
              <div className="col-span-2">
                <p className="mb-3 text-xs font-bold uppercase tracking-[0.16em] text-[#9a8f82]">
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
                            ? "rounded-full px-4 py-2 text-sm font-black text-white shadow-sm"
                            : "rounded-full border border-[#d8cec0] bg-white px-4 py-2 text-sm font-bold text-[#7c7163]"
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
                className="rounded-2xl border border-[#d8cec0] px-4 py-2 font-semibold"
              >
                Cancel
              </button>

              <button
                onClick={handleSaveCommissionChanges}
                disabled={savingCommission}
                className={
                  commissionSaved
                    ? "rounded-2xl bg-green-600 px-4 py-2 font-bold text-white transition-all duration-300"
                    : "rounded-2xl bg-[#1f2933] px-4 py-2 font-bold text-white transition-all duration-300 hover:-translate-y-0.5"
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