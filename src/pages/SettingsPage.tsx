import PageHeader from "../components/PageHeader";
import SettingsCard from "../components/SettingsCard";
import { useEffect, useState } from "react";
import { exportBackup } from "../lib/backup";
import { applyTheme, getTheme, type ThemeChoice } from "../lib/theme";
import { getAllUsedImagePaths } from "../lib/database";
import { cleanUpOrphanedImages, getStorageStats, type StorageStats } from "../lib/images";
import ConfirmModal from "../components/ConfirmModal";

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function SettingsPage() {
  const [theme, setTheme] = useState<ThemeChoice>(getTheme);
  const [storage, setStorage] = useState<StorageStats | null>(null);
  const [imagesInUse, setImagesInUse] = useState(0);

  async function loadStorage() {
    const [stats, usedPaths] = await Promise.all([getStorageStats(), getAllUsedImagePaths()]);

    setStorage(stats);
    // Varias filas pueden compartir el mismo archivo
    setImagesInUse(new Set(usedPaths).size);
  }

  useEffect(() => {
    loadStorage().catch(console.error);
  }, []);

  const [exporting, setExporting] = useState(false);
  const [backupMessage, setBackupMessage] = useState<string | null>(null);
  const [showCleanUpConfirmModal, setShowCleanUpConfirmModal] = useState(false);

  async function handleExportBackup() {
    try {
      setExporting(true);
      setBackupMessage(null);

      const backupPath = await exportBackup();

      if (backupPath) {
        setBackupMessage(`Backup saved to: ${backupPath}`);
      }
    } catch (error) {
      console.error(error);
      setBackupMessage("Could not create backup. Please try again.");
    } finally {
      setExporting(false);
    }
  }

  const [cleaningUp, setCleaningUp] = useState(false);
  const [cleanUpMessage, setCleanUpMessage] = useState<string | null>(null);

  async function handleCleanUpOrphanedImages() {
    try {
      setCleaningUp(true);
      setCleanUpMessage(null);

      const before = await getStorageStats();
      const usedPaths = await getAllUsedImagePaths();
      const { deletedCount } = await cleanUpOrphanedImages(usedPaths);
      const after = await getStorageStats();
      const freedBytes =
        before.imagesBytes + before.thumbsBytes - after.imagesBytes - after.thumbsBytes;

      setCleanUpMessage(
        deletedCount === 0
          ? "No unused images found."
          : `Deleted ${deletedCount} unused file${deletedCount === 1 ? "" : "s"} · freed ${formatBytes(freedBytes)}.`,
      );
    } catch (error) {
      console.error(error);
      setCleanUpMessage("Could not clean up images. Please try again.");
    } finally {
      setCleaningUp(false);
      loadStorage().catch(console.error);
    }
  }

  return (
    <>
      <PageHeader
        label="Preferences"
        title="Settings"
        description="Configure language, themes, storage and default workflows."
      />

      <section className="grid h-[calc(100vh-117px)] min-h-0 grid-cols-2 gap-5 p-5 pb-6">
        <SettingsCard title="Language" description="English is the default language. Spanish will be available later." />
        <SettingsCard title="Appearance" description="Light, dark, or follow your Windows setting.">
          <div className="mt-4 inline-flex rounded-2xl border border-line bg-paper p-1">
            {(["light", "dark", "system"] as const).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => {
                  applyTheme(option);
                  setTheme(option);
                }}
                className={
                  theme === option
                    ? "rounded-xl bg-primary px-4 py-2 text-sm font-bold capitalize text-on-primary shadow-sm"
                    : "rounded-xl px-4 py-2 text-sm font-semibold capitalize text-muted transition hover:text-ink"
                }
              >
                {option}
              </button>
            ))}
          </div>
        </SettingsCard>
        <SettingsCard
          title="Storage"
          description="Your data stays on this computer. Images are kept as light copies; your original canvases stay wherever you keep them."
        >
          {storage && (
            <dl className="mt-4 grid grid-cols-3 gap-3">
              {[
                ["Images", formatBytes(storage.imagesBytes), `${imagesInUse} in use · ${storage.imageCount} files`],
                ["Thumbnails", formatBytes(storage.thumbsBytes), "For cards and lists"],
                ["Database", formatBytes(storage.databaseBytes), "Commissions, clients…"],
              ].map(([label, value, detail]) => (
                <div key={label} className="rounded-2xl bg-paper p-3">
                  <dt className="text-[10px] font-black uppercase tracking-[0.16em] text-faint">
                    {label}
                  </dt>
                  <dd className="mt-1 text-lg font-black text-ink">{value}</dd>
                  <dd className="text-[11px] text-muted">{detail}</dd>
                </div>
              ))}
            </dl>
          )}

          <div className="mt-4 flex flex-col gap-3">
            <button
              onClick={handleExportBackup}
              disabled={exporting}
              className="rounded-2xl bg-primary px-4 py-2 text-sm font-bold text-on-primary shadow-md transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {exporting ? "Exporting..." : "Export backup"}
            </button>

            <button
              onClick={() => setShowCleanUpConfirmModal(true)}
              disabled={cleaningUp}
              className="rounded-2xl border border-line-strong bg-surface px-4 py-2 text-sm font-bold text-ink transition hover:border-ink disabled:cursor-not-allowed disabled:opacity-70"
            >
              {cleaningUp ? "Cleaning up..." : "Clean up unused images"}
            </button>
          </div>

          {backupMessage && (
            <p className="mt-3 text-xs text-muted">{backupMessage}</p>
          )}

          {cleanUpMessage && (
            <p className="mt-1 text-xs text-muted">{cleanUpMessage}</p>
          )}
        </SettingsCard>
      </section>

      {showCleanUpConfirmModal && (
        <ConfirmModal
          eyebrow="Permanent action"
          eyebrowTone="danger"
          title="Clean up unused images"
          message="This permanently deletes image files that are no longer linked to any commission or character. This cannot be undone. We recommend exporting a backup first."
          confirmLabel="Delete unused images"
          onConfirm={() => {
            setShowCleanUpConfirmModal(false);
            handleCleanUpOrphanedImages();
          }}
          onCancel={() => setShowCleanUpConfirmModal(false)}
        />
      )}
    </>
  );
}

export default SettingsPage;