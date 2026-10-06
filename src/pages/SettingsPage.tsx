import PageHeader from "../components/PageHeader";
import { Segmented } from "../components/BoardFilters";
import { useEffect, useState } from "react";
import { exportBackup, pickBackupFolder, restoreBackup } from "../lib/backup";
import { applyTheme, getTheme, type ThemeChoice } from "../lib/theme";
import { appSettings, getAllUsedImagePaths, updateSettings } from "../lib/database";
import { revealItemInDir } from "@tauri-apps/plugin-opener";
import { appDataDir, join } from "@tauri-apps/api/path";
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
  const [currency, setCurrency] = useState(appSettings().default_currency);
  const [ratePercent, setRatePercent] = useState(String(Math.round(appSettings().extra_character_rate * 100)));
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
  const [restoreFolder, setRestoreFolder] = useState<string | null>(null);
  const [restoring, setRestoring] = useState(false);

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

  const totalBytes = storage ? storage.imagesBytes + storage.thumbsBytes + storage.databaseBytes : 0;
  const share = (bytes: number) => `${totalBytes > 0 ? (bytes / totalBytes) * 100 : 0}%`;

  const section = "mb-2 mt-8 text-[11px] font-black uppercase tracking-[0.16em] text-faint first:mt-0";
  const panel = "divide-y divide-line rounded-3xl border border-line bg-surface shadow-sm";
  const row = "flex items-center gap-4 px-5 py-4";
  const ghostButton =
    "rounded-md border border-line-strong px-3 py-1.5 text-sm font-semibold text-ink transition hover:border-ink disabled:cursor-not-allowed disabled:opacity-60";

  return (
    <>
      <PageHeader label="Preferences" title="Settings" description="Appearance, pricing, backups and storage." />

      <section className="h-[calc(100vh-117px)] overflow-y-auto p-5 pb-10">
        <div className="mx-auto max-w-2xl">
          <h3 className={section}>Appearance</h3>
          <div className={panel}>
            <div className={row}>
              <div className="flex-1">
                <p className="font-semibold">Theme</p>
                <p className="text-sm text-muted">Light, dark, or follow your Windows setting.</p>
              </div>
              <Segmented<ThemeChoice>
                options={[
                  { value: "light", label: "Light" },
                  { value: "dark", label: "Dark" },
                  { value: "system", label: "System" },
                ]}
                value={theme}
                onChange={(option) => {
                  applyTheme(option);
                  setTheme(option);
                }}
              />
            </div>
          </div>

          <h3 className={section}>Pricing</h3>
          <div className={panel}>
            <div className={row}>
              <div className="flex-1">
                <p className="font-semibold">Default currency</p>
                <p className="text-sm text-muted">New commissions start with this one.</p>
              </div>
              <Segmented
                options={["EUR", "USD", "GBP"].map((code) => ({ value: code, label: code }))}
                value={currency}
                onChange={(code) => {
                  setCurrency(code);
                  updateSettings({ default_currency: code }).catch(console.error);
                }}
              />
            </div>

            <div className={row}>
              <div className="flex-1">
                <p className="font-semibold">Extra character</p>
                <p className="text-sm text-muted">
                  Added to the base price for each character after the first. Commissions you already
                  created keep their price.
                </p>
              </div>
              <label className="flex items-center gap-1 text-sm font-semibold">
                <input
                  type="number"
                  min={0}
                  value={ratePercent}
                  onChange={(event) => setRatePercent(event.target.value)}
                  onBlur={() => {
                    const value = Math.max(0, Number(ratePercent) || 0);
                    setRatePercent(String(value));
                    updateSettings({ extra_character_rate: value / 100 }).catch(console.error);
                  }}
                  className="w-20 rounded-md border border-line-strong bg-paper px-2 py-1.5 text-right font-bold outline-none focus:border-ink"
                />
                %
              </label>
            </div>
          </div>

          <h3 className={section}>Backups</h3>
          <div className={panel}>
            <div className={row}>
              <div className="flex-1">
                <p className="font-semibold">Back up your data</p>
                <p className="text-sm text-muted">
                  Database and images, to any folder. Restoring saves a copy of your current data first.
                </p>
                {backupMessage && <p className="mt-1 text-xs text-muted">{backupMessage}</p>}
              </div>
              <button
                type="button"
                onClick={handleExportBackup}
                disabled={exporting}
                className="rounded-md bg-primary px-3 py-1.5 text-sm font-bold text-on-primary transition hover:bg-primary-hover disabled:opacity-60"
              >
                {exporting ? "Exporting…" : "Export"}
              </button>
              <button
                type="button"
                onClick={async () => setRestoreFolder(await pickBackupFolder())}
                disabled={restoring}
                className={ghostButton}
              >
                {restoring ? "Restoring…" : "Restore…"}
              </button>
            </div>
          </div>

          <h3 className={section}>Storage</h3>
          <div className={panel}>
            <div className={row}>
              <div className="flex-1">
                <p className="font-semibold">{storage ? `${formatBytes(totalBytes)} used` : "Storage"}</p>
                {storage && (
                  <>
                    <div className="mt-2 flex h-1.5 gap-0.5 overflow-hidden rounded-sm bg-paper">
                      <span className="bg-primary" style={{ width: share(storage.imagesBytes) }} />
                      <span className="bg-faint" style={{ width: share(storage.thumbsBytes) }} />
                      <span className="bg-line-strong" style={{ width: share(storage.databaseBytes) }} />
                    </div>
                    <p className="mt-1.5 text-xs text-muted">
                      Images {formatBytes(storage.imagesBytes)} ({imagesInUse} in use · {storage.imageCount} files) ·
                      Thumbnails {formatBytes(storage.thumbsBytes)} · Database {formatBytes(storage.databaseBytes)}
                    </p>
                  </>
                )}
              </div>
              <button
                type="button"
                onClick={async () => revealItemInDir(await join(await appDataDir(), "zeeboard.db"))}
                className={ghostButton}
              >
                Open folder
              </button>
            </div>

            <div className={row}>
              <div className="flex-1">
                <p className="font-semibold">Unused images</p>
                <p className="text-sm text-muted">Files that no commission or character uses anymore.</p>
                {cleanUpMessage && <p className="mt-1 text-xs text-muted">{cleanUpMessage}</p>}
              </div>
              <button
                type="button"
                onClick={() => setShowCleanUpConfirmModal(true)}
                disabled={cleaningUp}
                className={ghostButton}
              >
                {cleaningUp ? "Cleaning up…" : "Clean up"}
              </button>
            </div>
          </div>
        </div>
      </section>

      {restoreFolder && (
        <ConfirmModal
          eyebrow="Replace your data"
          eyebrowTone="danger"
          title="Restore this backup?"
          message={`Your current commissions, clients and settings will be replaced by the ones in:
${restoreFolder}

A copy of your current data is saved first (in the app folder, "before-restore"), and no images are deleted. The app reloads when it's done.`}
          confirmLabel="Restore backup"
          onConfirm={async () => {
            setRestoring(true);
            try {
              await restoreBackup(restoreFolder);
            } catch (error) {
              console.error(error);
              setBackupMessage(`Could not restore: ${error}`);
              setRestoreFolder(null);
              setRestoring(false);
            }
          }}
          onCancel={() => setRestoreFolder(null)}
        />
      )}

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