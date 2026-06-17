import "./App.css";
import { useEffect, useState } from "react";
import {
  createTemplate,
  deleteTemplate,
  duplicateTemplate,
  getTemplateStages,
  getTemplates,
  initializeDatabase,
  replaceTemplateStages,
  updateTemplateName,
  createCommission,
  getCommissions,
  updateCommissionStage,
  updateCommission,
  duplicateCommission,
  deleteCommission,
  createTag,
  deleteTag,
  getTags,
  getCommissionTags,
  replaceCommissionTags,
  getClients,
  createClient,
  deleteClient,
  updateClient,
  updateClientAvatar,
  getCommissionStageImages,
  createCommissionStageImage,
  deleteCommissionStageImage,
  type CommissionStageImage,
  type Client,
  type Tag,
  type Commission,
  type Template,
  type TemplateStage,
} from "./lib/database";
import { motion, AnimatePresence } from "framer-motion";

type Page = "commissions" | "clients" | "tags" | "templates" | "finished" | "settings";

const navigationItems: { id: Page; label: string }[] = [
  { id: "commissions", label: "Commissions" },
  { id: "clients", label: "Clients" },
  { id: "tags", label: "Tags" },
  { id: "templates", label: "Templates" },
  { id: "finished", label: "Finished" },
  { id: "settings", label: "Settings" },
];

function App() {
  const [currentPage, setCurrentPage] = useState<Page>("commissions");

  useEffect(() => {
    initializeDatabase()
      .then(() => console.log("Database initialized"))
      .catch(console.error);
  }, []);

  return (
    <div className="h-screen overflow-hidden bg-[#f6f3ee] text-[#1f2933]">
      <div className="flex h-full">
        <aside className="flex w-72 flex-col border-r border-[#ded7cc] bg-[#fffaf2] px-5 py-6">
          <div className="mb-10">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#1f2933] text-2xl shadow-md">
                🦓
              </div>

              <div>
                <h1 className="text-2xl font-black tracking-tight">ZeeBoard</h1>
                <p className="text-xs font-medium text-[#7c7163]">
                  Commission workspace
                </p>
              </div>
            </div>
          </div>

          <nav className="space-y-2">
            {navigationItems.map((item) => {
              const isActive = currentPage === item.id;

              return (
                <button
                  key={item.id}
                  onClick={() => setCurrentPage(item.id)}
                  className={
                    isActive
                      ? "w-full rounded-2xl bg-[#1f2933] px-4 py-3 text-left text-sm font-bold text-white shadow-md"
                      : "w-full rounded-2xl px-4 py-3 text-left text-sm font-semibold text-[#6f665c] transition hover:bg-[#f1e8da] hover:text-[#1f2933]"
                  }
                >
                  {item.label}
                </button>
              );
            })}
          </nav>

          <div className="mt-auto rounded-3xl border border-[#e6ded2] bg-white p-4 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#9a8f82]">
              Current theme
            </p>
            <p className="mt-2 text-sm font-bold">Zebra Light</p>
            <p className="mt-1 text-xs leading-relaxed text-[#7c7163]">
              A soft workspace for tracking commissions, clients and deadlines.
            </p>
          </div>
        </aside>

        <main className="flex-1 overflow-hidden">
          {currentPage === "commissions" && <CommissionsPage />}
          {currentPage === "clients" && (
            <ClientsPage onOpenCommissionsPage={() => setCurrentPage("commissions")} />
          )}
          {currentPage === "tags" && <TagsPage />}
          {currentPage === "templates" && <TemplatesPage />}
          {currentPage === "finished" && <FinishedPage />}
          {currentPage === "settings" && <SettingsPage />}
        </main>
      </div>
    </div>
  );
}

function CommissionsPage() {
  const [showNewCommissionModal, setShowNewCommissionModal] = useState(false);
  const [commissionTitle, setCommissionTitle] = useState("");
  const [commissionPrice, setCommissionPrice] = useState("");
  const [commissionDeadline, setCommissionDeadline] = useState("");
  const [commissionNotes, setCommissionNotes] = useState("");
  const [clientName, setClientName] = useState("");
  const [selectedClientId, setSelectedClientId] = useState<number | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
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
  const activeCommission = commissions.find((commission) => commission.id === activeCommissionId) ?? null;
  const [showEditCommissionModal, setShowEditCommissionModal] = useState(false);
  const [savingCommission, setSavingCommission] = useState(false);
  const [commissionSaved, setCommissionSaved] = useState(false);
  const [duplicatingCommission, setDuplicatingCommission] = useState(false);
  const [commissionDuplicated, setCommissionDuplicated] = useState(false);
  const [showDeleteCommissionModal, setShowDeleteCommissionModal] = useState(false);
  const [deletingCommission, setDeletingCommission] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [toastType, setToastType] = useState<"success" | "error">("success");
  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>([]);
  const [commissionTagsById, setCommissionTagsById] = useState<Record<number, Tag[]>>({});
  const [stageImagesByCommissionId, setStageImagesByCommissionId] = useState<Record<number, CommissionStageImage[]>>({});
  const [activeStageImageIndexByStageId, setActiveStageImageIndexByStageId] = useState<Record<number, number>>({});

  useEffect(() => {
    getTemplates()
      .then(setTemplates)
      .catch(console.error);

    getCommissions()
      .then(async (data) => {
        setCommissions(data);
        await loadTagsForCommissions(data);
        await loadStageImagesForCommissions(data);
      })
      .catch(console.error);

    getClients()
      .then(setClients)
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

      setCommissionCreated(true);

      setTimeout(() => {
        setCommissionCreated(false);
        setShowNewCommissionModal(false);
      }, 1500);
    } catch (error) {
      console.error(error);
      alert(`Commission error: ${error}`);
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
    const entries = await Promise.all(
      data.map(async (commission) => {
        const images = await getCommissionStageImages(commission.id);
        return [commission.id, images] as const;
      }),
    );

    setStageImagesByCommissionId(Object.fromEntries(entries));
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
      setToastType("success");
      setToastMessage("Commission duplicated successfully.");

      setTimeout(() => {
        setCommissionDuplicated(false);
        setToastMessage("");
      }, 1800);
    } catch (error) {
      console.error(error);
      setToastType("error");
      setToastMessage("Could not duplicate commission.");
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
        currentTabs.filter(
          (tab) => tab.id !== activeCommission.id,
        ),
      );

      setActiveCommissionId(null);

      setToastType("success");
      setToastMessage("Commission deleted.");

      setTimeout(() => {
        setToastMessage("");
      }, 1800);

      setShowDeleteCommissionModal(false);
    } catch (error) {
      console.error(error);

      setToastType("error");
      setToastMessage("Could not delete commission.");
    } finally {
      setDeletingCommission(false);
    }
  }

  async function handleUploadStageImage(stageId: number, file: File) {
    if (!activeCommission) {
      console.error("No active commission");
      return;
    }

    const reader = new FileReader();

    reader.onload = async () => {
      try {
        const imageDataUrl = String(reader.result);

        console.log("Uploading stage image", {
          commissionId: activeCommission.id,
          stageId,
          size: imageDataUrl.length,
        });

        await createCommissionStageImage(
          activeCommission.id,
          stageId,
          imageDataUrl,
        );

        const data = await getCommissions();
        setCommissions(data);
        await loadStageImagesForCommissions(data);

        console.log("Stage image uploaded");
      } catch (error) {
        console.error("Could not upload stage image", error);
      }
    };

    reader.onerror = () => {
      console.error("Could not read image file");
    };

    reader.readAsDataURL(file);
  }

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
                                        src={previousStageImage.image_data_url}
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
                                        src={nextStageImage.image_data_url}
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
                                        src={mainStageImage.image_data_url}
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

                            <label className="mt-4 block cursor-pointer rounded-2xl border border-dashed border-[#d8cec0] bg-white px-3 py-3 text-center text-xs font-black text-[#7c7163] transition hover:border-[#1f2933]">
                              {stageImages.length === 0 ? "Add image" : "Add alt"}

                              <input
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={(event) => {
                                  const file = event.target.files?.[0];

                                  if (file) {
                                    handleUploadStageImage(stage.id, file);
                                  }
                                }}
                              />
                            </label>
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
            ) : (
              <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-4">
                {commissions.map((commission) => {
                  const tags = commissionTagsById[commission.id] ?? [];
                  const paymentTag = getPaymentTag(tags);
                  const normalTags = getNormalTags(tags);
                  const commissionImages = stageImagesByCommissionId[commission.id] ?? [];
                  const latestImage = commissionImages.length > 0 ? commissionImages[commissionImages.length - 1] : null;
                  
                  return (
                    <button
                      key={commission.id}
                      onClick={() => handleOpenCommission(commission)}
                      className="min-w-0 rounded-3xl border border-[#e6ded2] bg-[#fffaf2] p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-[#1f2933] hover:shadow-md"
                    >
                      {latestImage && (
                        <div className="mb-3 overflow-hidden rounded-2xl bg-white shadow-sm">
                          <img
                            src={latestImage.image_data_url}
                            alt={commission.title}
                            className="w-full h-auto object-contain"
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

                      <div className="mt-4 flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-[#1f2933] shadow-sm">
                          {commission.price
                            ? `${commission.price} ${commission.currency || "EUR"}`
                            : "No price"}
                        </span>

                        <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-[#1f2933] shadow-sm">
                          {commission.deadline || "No deadline"}
                        </span>
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
          <div className="w-[650px] rounded-[2rem] border border-[#e1d8ca] bg-white p-6 shadow-2xl">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#9a8f82]">
              New commission
            </p>

            <h3 className="mt-2 text-2xl font-black text-[#1f2933]">
              Create commission
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

            <div className="mt-6 flex justify-end gap-3">
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
          <div className="w-[450px] rounded-[2rem] border border-[#e1d8ca] bg-white p-6 shadow-2xl">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#9a8f82]">
              Delete commission
            </p>

            <h3 className="mt-2 text-2xl font-black text-[#1f2933]">
              {activeCommission?.title}
            </h3>

            <p className="mt-4 text-sm text-[#7c7163]">
              This action cannot be undone.
            </p>

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setShowDeleteCommissionModal(false)}
                className="rounded-2xl border border-[#d8cec0] px-4 py-2 font-semibold"
              >
                Cancel
              </button>

              <button
                onClick={handleDeleteCommission}
                disabled={deletingCommission}
                className="rounded-2xl bg-red-500 px-4 py-2 font-bold text-white"
              >
                {deletingCommission ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
      {toastMessage && (
        <div
          className={
            toastType === "success"
              ? "fixed bottom-6 right-6 z-[60] rounded-2xl bg-green-600 px-5 py-3 text-sm font-bold text-white shadow-xl"
              : "fixed bottom-6 right-6 z-[60] rounded-2xl bg-red-500 px-5 py-3 text-sm font-bold text-white shadow-xl"
          }
        >
          {toastMessage}
        </div>
      )}
    </div>
  );
}

function OpenTabs({
  openCommissionTabs,
  activeCommissionId,
  commissionTagsById,
  getPaymentTag,
  onSelectCommission,
  onCloseCommission,
  onShowAllCommissions,
  clients,
}: {
  openCommissionTabs: Commission[];
  activeCommissionId: number | null;
  commissionTagsById: Record<number, Tag[]>;
  getPaymentTag: (tags: Tag[]) => Tag | null;
  onSelectCommission: (commissionId: number) => void;
  onCloseCommission: (commissionId: number) => void;
  onShowAllCommissions: () => void;
  clients: Client[];
}) {
  return (
    <section className="border-b border-[#ded7cc] bg-white px-8 py-3">
      <div className="flex items-center gap-3 overflow-x-auto">
        <span className="mr-1 text-xs font-bold uppercase tracking-[0.18em] text-[#9a8f82]">
          Open
        </span>
        <button
          onClick={onShowAllCommissions}
          className={
            activeCommissionId === null
              ? "shrink-0 rounded-2xl border border-[#1f2933] bg-[#1f2933] px-4 py-2 text-sm font-bold text-white shadow-sm"
              : "shrink-0 rounded-2xl border border-[#e6ded2] bg-[#fffaf2] px-4 py-2 text-sm font-semibold text-[#1f2933] shadow-sm"
          }
        >
          All commissions
        </button>
        {openCommissionTabs.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[#d8cec0] px-4 py-2 text-sm text-[#9a8f82]">
            No commissions open
          </div>
        ) : (
          openCommissionTabs.map((commission) => {
            const client = clients.find((client) => client.id === commission.client_id) ?? null;
            const isActive = activeCommissionId === commission.id;
            const paymentTag = getPaymentTag(commissionTagsById[commission.id] ?? [],);

            return (
              <div
                key={commission.id}
                className={
                  isActive
                    ? "flex shrink-0 items-center gap-2 rounded-2xl border border-[#1f2933] bg-[#1f2933] px-4 py-2 text-sm font-bold text-white shadow-sm"
                    : "flex shrink-0 items-center gap-2 rounded-2xl border border-[#e6ded2] bg-[#fffaf2] px-4 py-2 text-sm font-semibold text-[#1f2933] shadow-sm"
                }
              >
                {client?.avatar_url && (
                  <img
                    src={client.avatar_url}
                    alt={client.name}
                    className="h-6 w-6 rounded-full object-cover"
                  />
                )}
                <button
                  onClick={() => onSelectCommission(commission.id)}
                  className="max-w-52 truncate"
                >
                  {commission.client_name || "No client"} · {commission.title}
                </button>

                {paymentTag && (
                  <span
                    className="rounded-full px-2 py-0.5 text-[10px] font-black text-white"
                    style={{ backgroundColor: paymentTag.color }}
                  >
                    {paymentTag.name}
                  </span>
                )}

                <button
                  onClick={() => onCloseCommission(commission.id)}
                  className={
                    isActive
                      ? "rounded-full px-2 text-white/70 hover:bg-white/10 hover:text-white"
                      : "rounded-full px-2 text-[#9a8f82] hover:bg-[#f1e8da] hover:text-[#1f2933]"
                  }
                >
                  ×
                </button>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}

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
    }
  }

  async function handleDeleteClient(clientId: number) {
    try {
      await deleteClient(clientId);
      await loadClients();
    } catch (error) {
      console.error(error);
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

  useEffect(() => {
    loadClients().catch(console.error);

    getCommissions()
      .then(async (data) => {
        setCommissions(data);
        await loadClientCommissionTags(data);
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
  const selectedClientCommissions = selectedClient
  ? commissions.filter(
      (commission) => commission.client_id === selectedClient.id,
    )
  : [];
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

  const lastCommission =
    selectedClientCommissions.length > 0
      ? [...selectedClientCommissions].sort(
          (a, b) =>
            new Date(b.created_at).getTime() -
            new Date(a.created_at).getTime(),
        )[0]
      : null;
    
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
          <div className="w-[560px] rounded-[2rem] border border-[#e1d8ca] bg-white p-6 shadow-2xl">
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
                <div className="mt-6 grid grid-cols-4 gap-3 overflow-hidden">
                  <div className="rounded-3xl bg-[#fffaf2] p-4">
                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#9a8f82]">
                      Total earned
                    </p>

                    <p className="mt-2 text-xl font-black text-[#1f2933]">
                      {totalEarned} EUR
                    </p>
                  </div>

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
                      Last commission
                    </p>

                    <p
                      title={lastCommission?.title || "None"}
                      className="mt-2 line-clamp-2 break-words text-sm font-black leading-tight text-[#1f2933]"
                    >
                      {lastCommission?.title || "None"}
                    </p>
                  </div>

                  <div className="rounded-3xl bg-[#fffaf2] p-4">
                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#9a8f82]">
                      Payment
                    </p>

                    <p className="mt-2 text-sm font-black text-green-700">
                      {paidCommissionsCount} paid
                    </p>

                    <p className="mt-1 text-sm font-black text-red-600">
                      {unpaidCommissionsCount} unpaid
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
                  {selectedClientCommissions.map((commission) => (
                    <div
                      key={commission.id}
                      className="flex items-center justify-between gap-3 rounded-2xl bg-white px-4 py-3 shadow-sm"
                    >
                      <div>
                        <p className="text-sm font-black text-[#1f2933]">
                          {commission.title}
                        </p>

                        <p className="mt-1 text-xs text-[#7c7163]">
                          {commission.price
                            ? `${commission.price} ${commission.currency || "EUR"}`
                            : "No price"}
                          {" · "}
                          {commission.deadline || "No deadline"}
                        </p>
                      </div>

                      <button
                        onClick={() => handleOpenCommissionFromClient(commission)}
                        className="rounded-full bg-[#1f2933] px-3 py-1 text-xs font-black text-white shadow-sm"
                      >
                        Open
                      </button>
                    </div>
                  ))}
                </div>
              )}
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
          <div className="w-[450px] rounded-[2rem] border border-[#e1d8ca] bg-white p-6 shadow-2xl">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#9a8f82]">
              Delete client
            </p>

            <h3 className="mt-2 text-2xl font-black text-[#1f2933]">
              {clientToDelete.name}
            </h3>

            <p className="mt-4 text-sm text-[#7c7163]">
              This action cannot be undone.
            </p>

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setClientToDelete(null)}
                className="rounded-2xl border border-[#d8cec0] px-4 py-2 font-semibold"
              >
                Cancel
              </button>

              <button
                onClick={async () => {
                  await handleDeleteClient(clientToDelete.id);
                  setClientToDelete(null);
                }}
                className="rounded-2xl bg-red-500 px-4 py-2 font-bold text-white"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function TagsPage() {
  const [tags, setTags] = useState<Tag[]>([]);
  const [tagName, setTagName] = useState("");
  const [tagColor, setTagColor] = useState("#f59e0b");
  const [tagCategory, setTagCategory] = useState("General");
  const [creatingTag, setCreatingTag] = useState(false);
  const [tagCreated, setTagCreated] = useState(false);
  const [tagToDelete, setTagToDelete] = useState<Tag | null>(null);

  async function loadTags() {
    const data = await getTags();
    setTags(data);
  }

  async function handleCreateTag() {
    try {
      setCreatingTag(true);

      await createTag(tagName, tagColor, tagCategory);

      setTagName("");
      setTagColor("#f59e0b");

      await loadTags();

      setTagCreated(true);

      setTimeout(() => {
        setTagCreated(false);
      }, 1500);
    } catch (error) {
      console.error(error);
    } finally {
      setCreatingTag(false);
    }
  }

  async function handleDeleteTag(tagId: number) {
    try {
      await deleteTag(tagId);
      await loadTags();
    } catch (error) {
      console.error(error);
      alert(`Delete tag error: ${error}`);
    }
  }

  useEffect(() => {
    loadTags().catch(console.error);
  }, []);

  const groupedTags = tags.reduce(
    (groups, tag) => {
      const category =
        tag.category || "General";

      if (!groups[category]) {
        groups[category] = [];
      }

      groups[category].push(tag);

      return groups;
    },
    {} as Record<string, Tag[]>,
  );

  return (
    <>
      <PageHeader
        label="Label library"
        title="Tags"
        description="Create reusable tags to classify commissions."
      />

      <section className="grid h-[calc(100vh-117px)] min-h-0 grid-cols-[340px_minmax(0,1fr)] gap-5 overflow-hidden p-5 pb-6">
        <div className="flex min-h-0 flex-col rounded-[2rem] border border-[#e1d8ca] bg-white p-5 shadow-sm">
          <div className="mb-5">
            <h3 className="text-xl font-black">New tag</h3>
            <p className="mt-1 text-sm text-[#7c7163]">
              Use tags like urgent, commercial or personal.
            </p>
          </div>

          <input
            value={tagName}
            onChange={(event) => setTagName(event.target.value)}
            placeholder="Tag name"
            className="rounded-2xl border border-[#d8cec0] bg-[#fffaf2] px-4 py-3 text-sm font-semibold outline-none transition focus:border-[#1f2933]"
          />

          

          <div className="mt-3 flex items-center gap-3 rounded-2xl border border-[#d8cec0] bg-[#fffaf2] px-4 py-3">
            <label
              className="flex h-14 w-14 cursor-pointer items-center justify-center rounded-2xl border border-[#d8cec0] bg-white shadow-sm"
              style={{ backgroundColor: tagColor }}
            >
              <input
                type="color"
                value={tagColor}
                onChange={(event) => setTagColor(event.target.value)}
                className="h-full w-full cursor-pointer opacity-0"
              />
            </label>

            <div>
              <p className="text-sm font-bold">
                Selected colour
              </p>

              <p className="text-xs text-[#9a8f82]">
                Click to change
              </p>
            </div>
            <select
              value={tagCategory}
              onChange={(event) =>
                setTagCategory(event.target.value)
              }
              className="mt-3 rounded-2xl border border-[#d8cec0] bg-[#fffaf2] px-4 py-3"
            >
              <option>Payment</option>
              <option>Characters</option>
              <option>Commission Type</option>
              <option>Reference</option>
              <option>General</option>
            </select>
          </div>

          <div className="mt-4 rounded-3xl border border-[#e6ded2] bg-[#fffaf2] p-4">
            <div className="mt-3">
              <span
                className="inline-flex rounded-full px-4 py-2 text-sm font-black text-white shadow-sm"
                style={{ backgroundColor: tagColor }}
              >
                {tagName || "Example tag"}
              </span>
            </div>
            
          </div>

          <button
            onClick={handleCreateTag}
            disabled={creatingTag}
            className={
              tagCreated
                ? "mt-3 rounded-2xl bg-green-600 px-4 py-3 text-sm font-bold text-white shadow-md transition-all duration-300"
                : "mt-3 rounded-2xl bg-[#1f2933] px-4 py-3 text-sm font-bold text-white shadow-md transition hover:-translate-y-0.5 hover:shadow-lg"
            }
          >
            {creatingTag
              ? "Creating..."
              : tagCreated
                ? "✓ Created"
                : "Create tag"}
          </button>
        </div>

        <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-[2rem] border border-[#e1d8ca] bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <h3 className="text-xl font-black">Saved tags</h3>

            <span className="rounded-full bg-[#fffaf2] px-3 py-1 text-xs font-bold text-[#9a8f82]">
              {tags.length} tags
            </span>
          </div>

          <div className="mt-5 min-h-0 flex-1 overflow-y-auto overflow-x-hidden pr-2">
            {tags.length === 0 ? (
              <div className="flex h-[300px] items-center justify-center rounded-3xl border border-dashed border-[#d8cec0] bg-[#fffaf2] text-sm text-[#9a8f82]">
                No tags yet
              </div>
            ) : (
              <div className="mt-5 min-h-0 flex-1 overflow-y-auto pr-2">
                {Object.entries(groupedTags).map(
                  ([category, categoryTags]) => (
                    <div key={category} className="pb-7">
                      <h4 className="mb-3 text-sm font-black uppercase tracking-[0.16em] text-[#9a8f82]">
                        {category}
                      </h4>

                      <div className="flex flex-wrap gap-x-4 gap-y-3">
                        {categoryTags.map((tag) => (
                          <div
                            key={tag.id}
                            className="flex items-center gap-2 rounded-full border border-[#e6ded2] bg-[#fffaf2] p-1 shadow-sm"
                          >
                            <span
                              className="rounded-full px-4 py-2 text-sm font-black text-white"
                              style={{ backgroundColor: tag.color }}
                            >
                              {tag.name}
                            </span>

                            <button
                              onClick={() => setTagToDelete(tag)}
                              className="rounded-full px-2 text-xs font-black text-red-500 transition hover:bg-red-50"
                            >
                              ×
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  ),
                )}
              </div>
            )}
          </div>
        </div>
      </section>
      {tagToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
          <div className="w-[450px] rounded-[2rem] border border-[#e1d8ca] bg-white p-6 shadow-2xl">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#9a8f82]">
              Delete tag
            </p>

            <h3 className="mt-2 text-2xl font-black text-[#1f2933]">
              {tagToDelete.name}
            </h3>

            <p className="mt-4 text-sm text-[#7c7163]">
              This action cannot be undone.
            </p>

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setTagToDelete(null)}
                className="rounded-2xl border border-[#d8cec0] px-4 py-2 font-semibold"
              >
                Cancel
              </button>

              <button
                onClick={async () => {
                  await handleDeleteTag(tagToDelete.id);
                  setTagToDelete(null);
                }}
                className="rounded-2xl bg-red-500 px-4 py-2 font-bold text-white"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
function TemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [stages, setStages] = useState<TemplateStage[]>([]);
  const [templateName, setTemplateName] = useState("");
  const [stageName, setStageName] = useState("");
  const [newStages, setNewStages] = useState<string[]>([]);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [templateToDelete, setTemplateToDelete] = useState<Template | null>(null);
  const [editTemplateName, setEditTemplateName] = useState("");
  const [editStages, setEditStages] = useState<string[]>([]);
  const [editStageName, setEditStageName] = useState("");
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [templateSaved, setTemplateSaved] = useState(false);

  async function loadTemplates() {
    const data = await getTemplates();
    setTemplates(data);

    if (!selectedTemplate && data.length > 0) {
      setSelectedTemplate(data[0]);
      const stageData = await getTemplateStages(data[0].id);
      setStages(stageData);
      setEditTemplateName(data[0].name);
      setEditStages(stageData.map((stage) => stage.name));
    }
  }

  function handleAddEditStage() {
    const cleanStage = editStageName.trim();

    if (!cleanStage) {
      return;
    }

    setEditStages((currentStages) => [...currentStages, cleanStage]);
    setEditStageName("");
  }

  function handleRemoveEditStage(indexToRemove: number) {
    setEditStages((currentStages) =>
      currentStages.filter((_, index) => index !== indexToRemove),
    );
  }

  function handleMoveEditStageUp(index: number) {
    if (index === 0) {
      return;
    }

    setEditStages((currentStages) => {
      const updatedStages = [...currentStages];

      [updatedStages[index - 1], updatedStages[index]] = [
        updatedStages[index],
        updatedStages[index - 1],
      ];

      return updatedStages;
    });
  }

  function handleMoveEditStageDown(index: number) {
    if (index === editStages.length - 1) {
      return;
    }

    setEditStages((currentStages) => {
      const updatedStages = [...currentStages];

      [updatedStages[index], updatedStages[index + 1]] = [
        updatedStages[index + 1],
        updatedStages[index],
      ];

      return updatedStages;
    });
  }

  async function handleSaveTemplateChanges() {
    if (!selectedTemplate) {
      return;
    }

    try {
      setSavingTemplate(true);

      await updateTemplateName(selectedTemplate.id, editTemplateName);
      await replaceTemplateStages(selectedTemplate.id, editStages);

      const data = await getTemplates();
      setTemplates(data);

      const updatedTemplate =
        data.find((template) => template.id === selectedTemplate.id) ?? null;

      setSelectedTemplate(updatedTemplate);

      if (updatedTemplate) {
        const stageData = await getTemplateStages(updatedTemplate.id);
        setStages(stageData);
        setEditTemplateName(updatedTemplate.name);
        setEditStages(stageData.map((stage) => stage.name));
      }

      setTemplateSaved(true);

      setTimeout(() => {
        setTemplateSaved(false);
      }, 1800);
    } catch (error) {
      console.error(error);
      alert(`Save error: ${error}`);
    } finally {
      setSavingTemplate(false);
    }
  }

  async function handleSelectTemplate(template: Template) {
    setSelectedTemplate(template);

    const stageData = await getTemplateStages(template.id);

    console.log("Template:", template);
    console.log("Stages:", stageData);

    setStages(stageData);
    setEditTemplateName(template.name);
    setEditStages(stageData.map((stage) => stage.name));
  }

  async function handleCreateTemplate() {
    try {
      await createTemplate(templateName, newStages);
      

      setTemplateName("");
      setStageName("");
      setNewStages([]);

      const data = await getTemplates();
      setTemplates(data);

      if (data.length > 0) {
        setSelectedTemplate(data[0]);
        const stageData = await getTemplateStages(data[0].id);
        setStages(stageData);
      }
    } catch (error) {
      console.error(error);
      alert(`Template error: ${error}`);
    }
  }
  async function handleDuplicateTemplate(templateId: number) {
    try {
      await duplicateTemplate(templateId);

      const data = await getTemplates();
      setTemplates(data);

      if (data.length > 0) {
        setSelectedTemplate(data[0]);
        const stageData = await getTemplateStages(data[0].id);
        setStages(stageData);
      }
    } catch (error) {
      console.error(error);
      alert(`Duplicate error: ${error}`);
    }
  }
  async function confirmDeleteTemplate() {
    if (!templateToDelete) {
      return;
    }

    try {
      await deleteTemplate(templateToDelete.id);

      setShowDeleteModal(false);
      setTemplateToDelete(null);

      const data = await getTemplates();
      setTemplates(data);

      if (data.length > 0) {
        setSelectedTemplate(data[0]);

        const stageData = await getTemplateStages(data[0].id);
        setStages(stageData);
      } else {
        setSelectedTemplate(null);
        setStages([]);
      }
    } catch (error) {
      console.error(error);
    }
  }
  useEffect(() => {
    loadTemplates().catch(console.error);
  }, []);

  function handleAddStage() {
    const cleanStage = stageName.trim();

    if (!cleanStage) {
      return;
    }

    setNewStages((currentStages) => [...currentStages, cleanStage]);
    setStageName("");
  }

  function handleRemoveStage(indexToRemove: number) {
    setNewStages((currentStages) =>
      currentStages.filter((_, index) => index !== indexToRemove),
    );
  }

  return (
    <>
      <PageHeader
        label="Workflow library"
        title="Templates"
        description="Create reusable commission workflows and arrange their stages."
      />

      <section className="grid h-[calc(100vh-117px)] min-h-0 grid-cols-[380px_minmax(0,1fr)] gap-5 p-5 pb-6 overflow-hidden">
        <div className="flex h-full min-h-0 flex-col rounded-[2rem] border border-[#e1d8ca] bg-white p-5 shadow-sm">
          <div className="mb-5">
            <h3 className="text-xl font-black">New template</h3>
            <p className="mt-1 text-sm text-[#7c7163]">
              Create a workflow with one stage per line.
            </p>
          </div>

          <input
            value={templateName}
            onChange={(event) => setTemplateName(event.target.value)}
            placeholder="Template name"
            className="rounded-2xl border border-[#d8cec0] bg-[#fffaf2] px-4 py-3 text-sm font-semibold outline-none transition focus:border-[#1f2933]"
          />

          <div className="mt-3 flex gap-2">
            <input
              value={stageName}
              onChange={(event) => setStageName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  handleAddStage();
                }
              }}
              placeholder="Stage name"
              className="min-w-0 flex-1 rounded-2xl border border-[#d8cec0] bg-[#fffaf2] px-4 py-3 text-sm font-semibold outline-none transition focus:border-[#1f2933]"
            />

            <button
              onClick={handleAddStage}
              className="rounded-2xl border border-[#d8cec0] bg-[#fffaf2] px-4 py-3 text-sm font-bold text-[#1f2933] transition hover:border-[#1f2933]"
            >
              Add
            </button>
          </div>

          <div className="mt-3 min-h-28 rounded-2xl border border-[#d8cec0] bg-[#fffaf2] p-3">
            {newStages.length === 0 ? (
              <p className="text-sm text-[#9a8f82]">
                No stages added yet.
              </p>
            ) : (
              <div className="space-y-2">
                {newStages.map((stage, index) => (
                  <div
                    key={`${stage}-${index}`}
                    className="flex items-center justify-between gap-3 rounded-2xl bg-white px-3 py-2 text-sm font-semibold shadow-sm"
                  >
                    <span>
                      {index + 1}. {stage}
                    </span>

                    <button
                      onClick={() => handleRemoveStage(index)}
                      className="rounded-xl px-2 py-1 text-xs font-bold text-red-500 transition hover:bg-red-50"
                    >
                      Delete
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <button
            onClick={handleCreateTemplate}
            className="mt-3 rounded-2xl bg-[#1f2933] px-4 py-3 text-sm font-bold text-white shadow-md transition hover:-translate-y-0.5 hover:shadow-lg"
          >
            Create template
          </button>

          <div className="mt-6 min-h-0 flex-1 overflow-y-auto pr-1">
            <p className="mb-3 text-xs font-bold uppercase tracking-[0.2em] text-[#9a8f82]">
              Templates
            </p>

            {templates.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-[#d8cec0] bg-[#fffaf2] p-4 text-center text-sm text-[#9a8f82]">
                No templates yet
              </div>
            ) : (
              <div className="space-y-3">
                {templates.map((template) => {
                  const isSelected = selectedTemplate?.id === template.id;

                  return (
                    <button
                      key={template.id}
                      onClick={() => handleSelectTemplate(template)}
                      className={
                        isSelected
                          ? "w-full rounded-3xl border border-[#1f2933] bg-[#1f2933] px-4 py-4 text-left font-bold text-white shadow-sm"
                          : "w-full rounded-3xl border border-[#e6ded2] bg-[#fffaf2] px-4 py-4 text-left font-semibold text-[#1f2933] transition hover:border-[#1f2933]"
                      }
                    >
                      {template.name}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="flex h-full min-h-0 flex-col rounded-[2rem] border border-[#e1d8ca] bg-white p-5 shadow-sm">
          {selectedTemplate ? (
            <>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#9a8f82]">
                Selected template
              </p>

              <h3 className="mt-2 text-2xl font-black">
                {selectedTemplate.name}
              </h3>
              <div className="mt-4 flex gap-3">
                <button
                  onClick={() => handleDuplicateTemplate(selectedTemplate.id)}
                  className="rounded-2xl border border-[#d8cec0] bg-[#fffaf2] px-4 py-2 text-sm font-bold text-[#1f2933] transition hover:border-[#1f2933]"
                >
                  Duplicate
                </button>

                <button
                  onClick={() => {
                    setTemplateToDelete(selectedTemplate);
                    setShowDeleteModal(true);
                  }}
                  className="rounded-2xl border border-red-200 bg-red-50 px-4 py-2 text-sm font-bold text-red-600 transition hover:border-red-400"
                >
                  Delete
                </button>
              </div>

              <div className="mt-6 flex min-h-0 flex-1 flex-col space-y-4">
                <input
                  value={editTemplateName}
                  onChange={(event) => setEditTemplateName(event.target.value)}
                  className="w-full rounded-2xl border border-[#d8cec0] bg-[#fffaf2] px-4 py-3 text-sm font-bold outline-none focus:border-[#1f2933]"
                />

                <div className="flex gap-2">
                  <input
                    value={editStageName}
                    onChange={(event) => setEditStageName(event.target.value)}
                    placeholder="New stage"
                    className="min-w-0 flex-1 rounded-2xl border border-[#d8cec0] bg-[#fffaf2] px-4 py-3 text-sm font-semibold outline-none focus:border-[#1f2933]"
                  />

                  <button
                    onClick={handleAddEditStage}
                    className="rounded-2xl border border-[#d8cec0] bg-[#fffaf2] px-4 py-3 text-sm font-bold"
                  >
                    Add
                  </button>
                </div>

                <AnimatePresence mode="popLayout">
                   <div className="min-h-0 flex-1 overflow-y-auto space-y-2 pr-2">
                    {editStages.length === 0 ? (
                      <div className="rounded-3xl border border-dashed border-[#d8cec0] bg-[#fffaf2] p-5 text-sm text-[#9a8f82]">
                        This template has no stages.
                      </div>
                    ) : (
                      editStages.map((stage, index) => (
                        <motion.div
                          key={`${stage}-${index}`}
                          layout="position"
                          transition={{
                            layout: {
                              duration: 0.35,
                              ease: "easeInOut",
                            },
                          }}
                            className="flex items-center gap-3 rounded-3xl border border-[#e6ded2] bg-[#fffaf2] p-4"
                          >
                          <span className="font-black">
                            {index + 1}
                          </span>

                          <input
                            value={stage}
                            onChange={(event) => {
                              const updatedStages = [...editStages];
                              updatedStages[index] = event.target.value;
                              setEditStages(updatedStages);
                            }}
                            className="flex-1 rounded-xl border border-[#d8cec0] bg-white px-3 py-2 text-sm font-semibold outline-none focus:border-[#1f2933]"
                          />

                          <div className="flex gap-1">
                            <button
                              onClick={() => handleMoveEditStageUp(index)}
                              disabled={index === 0}
                              className="rounded-xl px-2 py-1 text-xs font-bold text-[#6f665c] transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-30"
                            >
                              ↑
                            </button>

                            <button
                              onClick={() => handleMoveEditStageDown(index)}
                              disabled={index === editStages.length - 1}
                              className="rounded-xl px-2 py-1 text-xs font-bold text-[#6f665c] transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-30"
                            >
                              ↓
                            </button>

                            <button
                              onClick={() => handleRemoveEditStage(index)}
                              className="rounded-xl px-2 py-1 text-xs font-bold text-red-500 transition hover:bg-red-50"
                            >
                              Delete
                            </button>
                          </div>
                        </motion.div>
                      ))
                    )}
                  </div>
                </AnimatePresence>



                <button
                  onClick={handleSaveTemplateChanges}
                  disabled={savingTemplate}
                  className={
                    templateSaved
                      ? "rounded-2xl bg-green-600 px-5 py-3 text-sm font-bold text-white shadow-md transition-all duration-300"
                      : "rounded-2xl bg-[#1f2933] px-5 py-3 text-sm font-bold text-white shadow-md transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-70"
                  }
                >
                  {savingTemplate
                    ? "Saving..."
                    : templateSaved
                      ? "✓ Saved"
                      : "Save changes"}
                </button>
              </div>
            </>
          ) : (
            <div className="flex h-full items-center justify-center">
              <div className="text-center">
                <h3 className="text-xl font-black">No template selected</h3>

                <p className="mt-2 text-sm text-[#7c7163]">
                  Create or select a template to view its stages.
                </p>
              </div>
            </div>
          )}
        </div>
      </section>
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
          <div className="w-[450px] rounded-[2rem] border border-[#e1d8ca] bg-white p-6 shadow-2xl">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#9a8f82]">
              Delete template
            </p>

            <h3 className="mt-2 text-2xl font-black text-[#1f2933]">
              {templateToDelete?.name}
            </h3>

            <p className="mt-4 text-sm text-[#7c7163]">
              This action cannot be undone.
              All stages inside this template will be deleted permanently.
            </p>

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowDeleteModal(false);
                  setTemplateToDelete(null);
                }}
                className="rounded-2xl border border-[#d8cec0] px-4 py-2 font-semibold"
              >
                Cancel
              </button>

              <button
                onClick={confirmDeleteTemplate}
                className="rounded-2xl bg-red-500 px-4 py-2 font-bold text-white"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function FinishedPage() {
  return (
    <>
      <PageHeader
        label="Archive"
        title="Finished commissions"
        description="Browse completed commissions grouped by year and month."
      />

      <section className="h-[calc(100vh-117px)] p-5 pb-6">
        <div className="h-full rounded-[2rem] border border-[#e1d8ca] bg-white p-5 shadow-sm">
          <div className="flex h-full items-center justify-center">
            <div className="text-center">
              <h3 className="text-2xl font-black">
                No completed commissions
              </h3>

              <p className="mt-2 text-sm text-[#7c7163]">
                Finished commissions will be archived here automatically.
              </p>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

function SettingsPage() {
  return (
    <>
      <PageHeader
        label="Preferences"
        title="Settings"
        description="Configure language, themes, storage and default workflows."
      />

      <section className="grid h-[calc(100vh-117px)] min-h-0 grid-cols-2 gap-5 p-5 pb-6">
        <SettingsCard title="Language" description="English is the default language. Spanish will be available later." />
        <SettingsCard title="Themes" description="Zebra Light, Sakura, Ocean, Forest and Midnight will be available." />
        <SettingsCard title="Storage" description="ZeeBoard will store data locally using SQLite." />
        <SettingsCard title="Backups" description="Backup and restore options will be added in a future sprint." />
      </section>
    </>
  );
}

function PlaceholderPage({
  title,
  subtitle,
}: {
  title: string;
  subtitle: string;
  emptyTitle: string;
  emptyText: string;
}) {
  return (
    <>
      <PageHeader label="Workspace" title={title} description={subtitle} />

      <section className="h-[calc(100vh-117px)] p-5 pb-6">
        <div className="flex h-full items-center justify-center rounded-[2rem] border border-[#e1d8ca] bg-white p-5 shadow-sm">
          <div className="max-w-md text-center">
            <h4 className="text-xl font-black">
              No commissions yet
            </h4>
            <p className="mt-2 text-sm leading-relaxed text-[#7c7163]">
              Create your first commission to start building your workflow.
            </p>
          </div>
        </div>
      </section>
    </>
  );
}

function PageHeader({
  label,
  title,
  description,
  action,
  onAction,
}: {
  label: string;
  title: string;
  description: string;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <header className="border-b border-[#ded7cc] bg-[#fffaf2]/80 px-8 py-5 backdrop-blur">
      <div className="flex items-center justify-between gap-6">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-[#9a8f82]">
            {label}
          </p>
          <h2 className="mt-1 text-3xl font-black">{title}</h2>
          <p className="mt-1 text-sm text-[#7c7163]">{description}</p>
        </div>

        {action && (
          <button
            onClick={onAction}
            className="rounded-2xl bg-[#1f2933] px-5 py-3 text-sm font-bold text-white shadow-md transition hover:-translate-y-0.5 hover:shadow-lg"
          >
            {action}
          </button>
        )}
      </div>
    </header>
  );
}

function SettingsCard({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="h-full rounded-[2rem] border border-[#e1d8ca] bg-white p-5 shadow-sm">
      <h3 className="text-xl font-black">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-[#7c7163]">
        {description}
      </p>
    </div>
  );
}

export default App;