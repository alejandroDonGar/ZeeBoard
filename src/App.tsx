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

const openCommissions: {
  client: string;
  stage: string;
  payment: string;
}[] = [];

const starterColumns: string[] = [];

const templates: {
  name: string;
  stages: string[];
}[] = [];

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
            <PlaceholderPage
              title="Clients"
              subtitle="Manage the people who request your commissions."
              emptyTitle="No clients yet"
              emptyText="Client profiles will store contact info, notes and commission history."
            />
          )}
          {currentPage === "tags" && (
            <PlaceholderPage
              title="Tags"
              subtitle="Create reusable tags with custom colours."
              emptyTitle="No tags yet"
              emptyText="Global tags will appear as suggestions when editing a commission."
            />
          )}
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

  useEffect(() => {
    getTemplates()
      .then(setTemplates)
      .catch(console.error);

    getCommissions()
      .then(setCommissions)
      .catch(console.error);
  }, []);
  async function handleCreateCommission() {
    try {
      setCreatingCommission(true);

      await createCommission(
        commissionTitle,
        clientName,
        platform,
        selectedTemplateId,
        commissionPrice ? Number(commissionPrice) : null,
        currency,
        hasDeadline ? commissionDeadline : null,
        commissionNotes,
      );

      const data = await getCommissions();
      setCommissions(data);

      setCommissionTitle("");
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
  const activeCommission = commissions.find((commission) => commission.id === activeCommissionId) ?? null;
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
              <div className="grid h-full grid-cols-[minmax(0,1fr)_420px] gap-5">
                <div className="rounded-[2rem] border border-[#e6ded2] bg-[#fffaf2] p-5">
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#9a8f82]">
                    Workflow
                  </p>

                  <div className="mt-4 rounded-3xl border border-dashed border-[#d8cec0] bg-white p-4 text-sm text-[#9a8f82]">
                    Workflow stages will appear here once we connect commissions to template
                    stages.
                  </div>
                </div>

                <aside className="rounded-[2rem] border border-[#e6ded2] bg-[#fffaf2] p-5">
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#9a8f82]">
                    Commission detail
                  </p>

                  <h4 className="mt-2 text-2xl font-black">
                    {activeCommission.title}
                  </h4>

                  <div className="mt-6 space-y-4">
                    <div className="rounded-3xl bg-white p-4 shadow-sm">
                      <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#9a8f82]">
                        Client
                      </p>
                      <p className="mt-2 font-bold">
                        {activeCommission.client_name || "No client"}
                      </p>
                    </div>

                    <div className="rounded-3xl bg-white p-4 shadow-sm">
                      <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#9a8f82]">
                        Platform
                      </p>
                      <p className="mt-2 font-bold">
                        {activeCommission.platform || "No platform"}
                      </p>
                    </div>

                    <div className="rounded-3xl bg-white p-4 shadow-sm">
                      <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#9a8f82]">
                        Price
                      </p>
                      <p className="mt-2 font-bold">
                        {activeCommission.price
                          ? `${activeCommission.price} ${activeCommission.currency || "EUR"}`
                          : "No price"}
                      </p>
                    </div>

                    <div className="rounded-3xl bg-white p-4 shadow-sm">
                      <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#9a8f82]">
                        Deadline
                      </p>
                      <p className="mt-2 font-bold">
                        {activeCommission.deadline || "No deadline"}
                      </p>
                    </div>

                    <div className="rounded-3xl bg-white p-4 shadow-sm">
                      <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#9a8f82]">
                        Notes
                      </p>

                      <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-[#6f665c]">
                        {activeCommission.notes || "No notes added."}
                      </p>
                    </div>
                  </div>
                </aside>
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
              <div className="grid grid-cols-3 gap-4">
                {commissions.map((commission) => (
                  <button
                    key={commission.id}
                    onClick={() => handleOpenCommission(commission)}
                    className="rounded-3xl border border-[#e6ded2] bg-[#fffaf2] p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-[#1f2933] hover:shadow-md"
                  >
                    <h4 className="font-black">{commission.title}</h4>

                    <p className="mt-2 text-sm font-semibold text-[#6f665c]">
                      {commission.client_name || "No client"}
                    </p>

                    <p className="mt-1 text-xs text-[#9a8f82]">
                      {commission.platform || "No platform"}
                    </p>

                    <div className="mt-4 flex items-center justify-between">
                      <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-[#1f2933] shadow-sm">
                        {commission.price
                          ? `${commission.price} ${commission.currency || "EUR"}`
                          : "No price"}
                      </span>

                      <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-[#9a8f82] shadow-sm">
                        {commission.deadline || "No deadline"}
                      </span>
                    </div>

                    {commission.notes && (
                      <p className="mt-4 line-clamp-3 text-sm leading-relaxed text-[#7c7163]">
                        {commission.notes}
                      </p>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <aside className="h-full min-h-0 rounded-[2rem] border border-[#e1d8ca] bg-white p-5 shadow-sm">
          <h3 className="text-xl font-black">Deadlines</h3>
          <p className="mt-1 text-sm text-[#7c7163]">
            Upcoming deliveries and client revisions.
          </p>

          <div className="mt-6 rounded-3xl border border-[#e6ded2] bg-[#fffaf2] p-4">
            <p className="text-sm font-black">No deadlines yet</p>
            <p className="mt-1 text-xs leading-relaxed text-[#7c7163]">
              Deadlines will appear automatically once commissions are created.
            </p>
          </div>

          <div className="mt-6 rounded-3xl border border-[#e6ded2] bg-[#f9f4ec] p-4">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#9a8f82]">
              Default workflow
            </p>
            <div className="mt-3 rounded-2xl border border-dashed border-[#d8cec0] bg-white p-4 text-sm text-[#9a8f82]">
              No templates available
            </div>
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

              <input
                value={clientName}
                onChange={(event) => setClientName(event.target.value)}
                placeholder="Client name"
                className="rounded-2xl border border-[#d8cec0] bg-[#fffaf2] px-4 py-3"
              />

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
    </div>
  );
}

function OpenTabs({
  openCommissionTabs,
  activeCommissionId,
  onSelectCommission,
  onCloseCommission,
  onShowAllCommissions,
}: {
  openCommissionTabs: Commission[];
  activeCommissionId: number | null;
  onSelectCommission: (commissionId: number) => void;
  onCloseCommission: (commissionId: number) => void;
  onShowAllCommissions: () => void;
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
            const isActive = activeCommissionId === commission.id;

            return (
              <div
                key={commission.id}
                className={
                  isActive
                    ? "flex shrink-0 items-center gap-2 rounded-2xl border border-[#1f2933] bg-[#1f2933] px-4 py-2 text-sm font-bold text-white shadow-sm"
                    : "flex shrink-0 items-center gap-2 rounded-2xl border border-[#e6ded2] bg-[#fffaf2] px-4 py-2 text-sm font-semibold text-[#1f2933] shadow-sm"
                }
              >
                <button
                  onClick={() => onSelectCommission(commission.id)}
                  className="max-w-52 truncate"
                >
                  {commission.client_name || "No client"} · {commission.title}
                </button>

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

      <section className="grid h-[calc(100vh-117px)] min-h-0 grid-cols-[380px_minmax(0,1fr)] gap-5 p-5 pb-6">
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

        <div className="h-full min-h-0 rounded-[2rem] border border-[#e1d8ca] bg-white p-5 shadow-sm">
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

              <div className="mt-6 space-y-4">
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
                  <div className="space-y-2">
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
  emptyTitle,
  emptyText,
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