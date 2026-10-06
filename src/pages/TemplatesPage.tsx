import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  createTemplate,
  deleteTemplate,
  duplicateTemplate,
  getTemplateStages,
  getTemplates,
  replaceTemplateStages,
  updateTemplateName,
  type Template,
} from "../lib/database";
import PageHeader from "../components/PageHeader";
import ConfirmModal from "../components/ConfirmModal";
import { useToast } from "../context/ToastContext";

function TemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
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
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [creatingTemplate, setCreatingTemplate] = useState(false);
  const { showToast } = useToast();

  async function loadTemplates() {
    const data = await getTemplates();
    setTemplates(data);

    if (!selectedTemplate && data.length > 0) {
      setSelectedTemplate(data[0]);
      const stageData = await getTemplateStages(data[0].id);
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
        setEditTemplateName(updatedTemplate.name);
        setEditStages(stageData.map((stage) => stage.name));
      }

      setTemplateSaved(true);

      setTimeout(() => {
        setTemplateSaved(false);
      }, 1800);
    } catch (error) {
    console.error(error);
    showToast(`Save error: ${error}`, "error");
    } finally {
      setSavingTemplate(false);
    }
  }

  async function handleSelectTemplate(template: Template) {
    setSelectedTemplate(template);

    const stageData = await getTemplateStages(template.id);

    console.log("Template:", template);
    console.log("Stages:", stageData);

    setEditTemplateName(template.name);
    setEditStages(stageData.map((stage) => stage.name));
  }

  async function handleCreateTemplate() {
    if (creatingTemplate) {
        return;
    }

    try {
        setCreatingTemplate(true);

        await createTemplate(templateName, newStages);

        setTemplateName("");
        setStageName("");
        setNewStages([]);

        const data = await getTemplates();
        setTemplates(data);

        if (data.length > 0) {
        setSelectedTemplate(data[0]);
        }
    } catch (error) {
    console.error(error);
    showToast(`Template error: ${error}`, "error");
    } finally {
        setCreatingTemplate(false);
    }
    }
  async function handleDuplicateTemplate(templateId: number) {
    try {
      await duplicateTemplate(templateId);

      const data = await getTemplates();
      setTemplates(data);

      if (data.length > 0) {
        setSelectedTemplate(data[0]);
      }
    } catch (error) {
    console.error(error);
    showToast(`Duplicate error: ${error}`, "error");
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
      } else {
        setSelectedTemplate(null);
      }
    } catch (error) {
      console.error(error);
      setShowDeleteModal(false);
      setErrorMessage(
        error instanceof Error ? error.message : "Could not delete template.",
      );
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
        <div className="flex h-full min-h-0 flex-col rounded-3xl border border-line bg-surface p-5 shadow-sm">
          <div className="mb-5">
            <h3 className="text-xl font-black">New template</h3>
            <p className="mt-1 text-sm text-muted">
              Create a workflow with one stage per line.
            </p>
          </div>

          <input
            value={templateName}
            onChange={(event) => setTemplateName(event.target.value)}
            placeholder="Template name"
            className="rounded-2xl border border-line-strong bg-paper px-4 py-3 text-sm font-semibold outline-none transition focus:border-ink"
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
              className="min-w-0 flex-1 rounded-2xl border border-line-strong bg-paper px-4 py-3 text-sm font-semibold outline-none transition focus:border-ink"
            />

            <button
              onClick={handleAddStage}
              className="rounded-2xl border border-line-strong bg-paper px-4 py-3 text-sm font-bold text-ink transition hover:border-ink"
            >
              Add
            </button>
          </div>

          <div className="mt-3 min-h-28 rounded-2xl border border-line-strong bg-paper p-3">
            {newStages.length === 0 ? (
              <p className="text-sm text-faint">
                No stages added yet.
              </p>
            ) : (
              <div className="space-y-2">
                {newStages.map((stage, index) => (
                  <div
                    key={`${stage}-${index}`}
                    className="flex items-center justify-between gap-3 rounded-2xl bg-surface px-3 py-2 text-sm font-semibold shadow-sm"
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
            disabled={creatingTemplate}
            className="mt-3 rounded-2xl bg-primary px-4 py-3 text-sm font-bold text-on-primary shadow-md transition hover:-translate-y-0.5 hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-70"
            >
            {creatingTemplate ? "Creating..." : "Create template"}
            </button>

          <div className="mt-6 min-h-0 flex-1 overflow-y-auto pr-1">
            <p className="mb-3 text-xs font-bold uppercase tracking-[0.2em] text-faint">
              Templates
            </p>

            {templates.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-line-strong bg-paper p-4 text-center text-sm text-faint">
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
                          ? "w-full rounded-3xl border border-ink bg-primary px-4 py-4 text-left font-bold text-on-primary shadow-sm"
                          : "w-full rounded-3xl border border-line bg-paper px-4 py-4 text-left font-semibold text-ink transition hover:border-ink"
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

        <div className="flex h-full min-h-0 flex-col rounded-3xl border border-line bg-surface p-5 shadow-sm">
          {selectedTemplate ? (
            <>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-faint">
                Selected template
              </p>

              <h3 className="mt-2 text-2xl font-black">
                {selectedTemplate.name}
              </h3>
              <div className="mt-4 flex gap-3">
                <button
                  onClick={() => handleDuplicateTemplate(selectedTemplate.id)}
                  className="rounded-2xl border border-line-strong bg-paper px-4 py-2 text-sm font-bold text-ink transition hover:border-ink"
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
                  className="w-full rounded-2xl border border-line-strong bg-paper px-4 py-3 text-sm font-bold outline-none focus:border-ink"
                />

                <div className="flex gap-2">
                  <input
                    value={editStageName}
                    onChange={(event) => setEditStageName(event.target.value)}
                    placeholder="New stage"
                    className="min-w-0 flex-1 rounded-2xl border border-line-strong bg-paper px-4 py-3 text-sm font-semibold outline-none focus:border-ink"
                  />

                  <button
                    onClick={handleAddEditStage}
                    className="rounded-2xl border border-line-strong bg-paper px-4 py-3 text-sm font-bold"
                  >
                    Add
                  </button>
                </div>

                <AnimatePresence mode="popLayout">
                   <div className="min-h-0 flex-1 overflow-y-auto space-y-2 pr-2">
                    {editStages.length === 0 ? (
                      <div className="rounded-3xl border border-dashed border-line-strong bg-paper p-5 text-sm text-faint">
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
                            className="flex items-center gap-3 rounded-3xl border border-line bg-paper p-4"
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
                            className="flex-1 rounded-xl border border-line-strong bg-surface px-3 py-2 text-sm font-semibold outline-none focus:border-ink"
                          />

                          <div className="flex gap-1">
                            <button
                              onClick={() => handleMoveEditStageUp(index)}
                              disabled={index === 0}
                              className="rounded-xl px-2 py-1 text-xs font-bold text-muted transition hover:bg-surface disabled:cursor-not-allowed disabled:opacity-30"
                            >
                              ↑
                            </button>

                            <button
                              onClick={() => handleMoveEditStageDown(index)}
                              disabled={index === editStages.length - 1}
                              className="rounded-xl px-2 py-1 text-xs font-bold text-muted transition hover:bg-surface disabled:cursor-not-allowed disabled:opacity-30"
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
                      : "rounded-2xl bg-primary px-5 py-3 text-sm font-bold text-on-primary shadow-md transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-70"
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

                <p className="mt-2 text-sm text-muted">
                  Create or select a template to view its stages.
                </p>
              </div>
            </div>
          )}
        </div>
      </section>
      {showDeleteModal && (
        <ConfirmModal
            eyebrow="Delete template"
            title={templateToDelete?.name ?? ""}
            message={"This action cannot be undone.\nAll stages inside this template will be deleted permanently."}
            confirmLabel="Delete"
            onConfirm={confirmDeleteTemplate}
            onCancel={() => {
            setShowDeleteModal(false);
            setTemplateToDelete(null);
            }}
        />
        )}
      {errorMessage && (
        <ConfirmModal
            eyebrow="Action not allowed"
            eyebrowTone="danger"
            title="Cannot delete template"
            message={errorMessage}
            confirmLabel="Understood"
            confirmVariant="primary"
            onConfirm={() => setErrorMessage(null)}
        />
        )}
    </>
  );
}

export default TemplatesPage;