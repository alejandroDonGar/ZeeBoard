import "./App.css";
import { useEffect, useState } from "react";
import {
  createTemplate,
  getTemplateStages,
  getTemplates,
  initializeDatabase,
  type Template,
  type TemplateStage,
} from "./lib/database";

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
  return (
    <div className="flex h-full min-h-0 flex-col">
      <PageHeader
        label="Main workspace"
        title="Commissions"
        description="Organize your drawings by stages, clients, dates and tags."
        action="+ New commission"
      />

      <OpenTabs />

      <section className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_320px] gap-5 p-5 pb-6">
        <div className="h-full min-h-0 rounded-[2rem] border border-[#e1d8ca] bg-white p-5 shadow-sm">
          <div className="mb-5 flex items-center justify-between gap-4">
            <div>
              <h3 className="text-xl font-black">Commission board</h3>
              <p className="mt-1 text-sm text-[#7c7163]">
                Start with a template, then move each commission through its own stages.
              </p>
            </div>

            <button className="rounded-2xl border border-[#d8cec0] bg-[#fffaf2] px-4 py-2 text-sm font-bold text-[#1f2933] transition hover:border-[#1f2933]">
              + Add column
            </button>
          </div>

          <div className="flex h-[calc(100%-76px)] min-h-0 items-center justify-center">
            <div className="max-w-md text-center">
              <h4 className="text-xl font-black">No commissions yet</h4>
              <p className="mt-2 text-sm leading-relaxed text-[#7c7163]">
                Create your first commission to start building your workflow.
              </p>
            </div>
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
    </div>
  );
}

function OpenTabs() {
  return (
    <section className="border-b border-[#ded7cc] bg-white px-8 py-3">
      <div className="flex items-center gap-3">
        <span className="mr-1 text-xs font-bold uppercase tracking-[0.18em] text-[#9a8f82]">
          Open
        </span>

        <div className="rounded-2xl border border-dashed border-[#d8cec0] px-4 py-2 text-sm text-[#9a8f82]">
          No commissions open
        </div>
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

  async function loadTemplates() {
    const data = await getTemplates();
    setTemplates(data);

    if (!selectedTemplate && data.length > 0) {
      setSelectedTemplate(data[0]);
      const stageData = await getTemplateStages(data[0].id);
      setStages(stageData);
    }
  }

  async function handleSelectTemplate(template: Template) {
    setSelectedTemplate(template);
    const stageData = await getTemplateStages(template.id);
    setStages(stageData);
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

              <div className="mt-6 space-y-3">
                {stages.length === 0 ? (
                  <div className="rounded-3xl border border-dashed border-[#d8cec0] bg-[#fffaf2] p-5 text-sm text-[#9a8f82]">
                    This template has no stages.
                  </div>
                ) : (
                  stages.map((stage, index) => (
                    <div
                      key={stage.id}
                      className="flex items-center gap-4 rounded-3xl border border-[#e6ded2] bg-[#fffaf2] p-4"
                    >
                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-sm font-black shadow-sm">
                        {index + 1}
                      </span>
                      <span className="font-bold">{stage.name}</span>
                    </div>
                  ))
                )}
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
}: {
  label: string;
  title: string;
  description: string;
  action?: string;
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
          <button className="rounded-2xl bg-[#1f2933] px-5 py-3 text-sm font-bold text-white shadow-md transition hover:-translate-y-0.5 hover:shadow-lg">
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