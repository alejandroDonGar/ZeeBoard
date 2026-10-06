import PageHeader from "../components/PageHeader";
import { Segmented } from "../components/BoardFilters";
import { useEffect, useState } from "react";
import { backupBeforeCleanup, exportBackup, pickBackupFolder, pickFolder, restoreBackup, runAutoBackup } from "../lib/backup";
import { applyTheme, getTheme, type ThemeChoice } from "../lib/theme";
import {
  appSettings,
  getAllUsedImagePaths,
  getLastImportedPaymentDate,
  getPaymentPlatforms,
  savePaymentPlatforms,
  updateSettings,
  type PaymentPlatform,
} from "../lib/database";
import { formatMoney, isoDay, receivedAfterFees } from "../lib/commissionHelpers";
import { exportCsv, type ExportKind } from "../lib/export";
import { revealItemInDir } from "@tauri-apps/plugin-opener";
import { appDataDir, join } from "@tauri-apps/api/path";
import { cleanUpOrphanedImages, getStorageStats, type StorageStats } from "../lib/images";
import ConfirmModal from "../components/ConfirmModal";
import PaypalImport, { pickPaypalFile, type PaypalPreview } from "../components/PaypalImport";

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
  const [platforms, setPlatforms] = useState<Omit<PaymentPlatform, "id">[]>([]);
  const [exportingKind, setExportingKind] = useState<ExportKind | null>(null);
  const [exportMessage, setExportMessage] = useState<string | null>(null);
  const [auto, setAuto] = useState(appSettings());
  const [paypal, setPaypal] = useState<PaypalPreview | null>(null);
  const [lastImport, setLastImport] = useState<string | null>(null);

  useEffect(() => {
    getLastImportedPaymentDate().then(setLastImport).catch(console.error);
  }, []);

  // Descarga desde 2 días antes del último cobro: los repetidos se saltan solos y no se escapa ninguno por el borde
  const downloadFrom = lastImport ? isoDay(new Date(new Date(`${lastImport}T12:00:00`).getTime() - 2 * 86400000)) : null;

  async function handleImportPaypal() {
    try {
      setExportMessage(null);
      setPaypal(await pickPaypalFile());
    } catch (error) {
      console.error(error);
      setExportMessage(`${error}`);
    }
  }

  async function handleExport(kind: ExportKind) {
    try {
      setExportingKind(kind);
      setExportMessage(null);
      const path = await exportCsv(kind);

      if (path) {
        setExportMessage(`Saved to: ${path}`);
      }
    } catch (error) {
      console.error(error);
      setExportMessage(`Could not export: ${error}`);
    } finally {
      setExportingKind(null);
    }
  }
  const [autoMessage, setAutoMessage] = useState<string | null>(null);
  const [autoRunning, setAutoRunning] = useState(false);

  // Guarda cualquier ajuste y refresca `auto`, que es una copia de todos
  async function saveAuto(changes: Parameters<typeof updateSettings>[0]) {
    await updateSettings(changes);
    setAuto({ ...appSettings() });
  }

  async function handleToggleAuto(enabled: boolean) {
    // Sin carpeta no hay dónde copiar: se pide al activarla
    const folder = auto.auto_backup_folder ?? (enabled ? await pickFolder("Choose a folder for automatic backups") : null);

    if (enabled && !folder) {
      return;
    }

    await saveAuto({ auto_backup_enabled: enabled, auto_backup_folder: folder });
  }

  async function handleBackUpNow() {
    try {
      setAutoRunning(true);
      setAutoMessage(null);
      const path = await runAutoBackup(true);
      setAutoMessage(`Backup saved to: ${path}`);
      setAuto({ ...appSettings() });
    } catch (error) {
      console.error(error);
      setAutoMessage(`Could not back up: ${error}`);
    } finally {
      setAutoRunning(false);
    }
  }

  useEffect(() => {
    getPaymentPlatforms().then(setPlatforms).catch(console.error);
  }, []);

  function updatePlatform(index: number, changes: Partial<Omit<PaymentPlatform, "id">>) {
    setPlatforms((current) => current.map((item, i) => (i === index ? { ...item, ...changes } : item)));
  }

  function savePlatforms() {
    // Se guarda al salir de cada campo; las filas sin nombre no se guardan
    savePaymentPlatforms(platforms).catch(console.error);
  }
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

      // Si la copia previa falla no se borra nada
      try {
        await backupBeforeCleanup();
      } catch (error) {
        console.error(error);
        setCleanUpMessage(`Could not back up first, so nothing was deleted: ${error}`);
        return;
      }

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

  const positive = (text: string) => Math.max(1, Math.round(Number(text)) || 1);
  const numberField =
    "w-16 rounded-md border border-line-strong bg-paper px-2 py-1.5 text-right font-bold outline-none focus:border-ink";

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

            <div className="px-5 py-4">
              <p className="font-semibold">Payment platforms</p>
              <p className="text-sm text-muted">
                Their fees, so "received" fills itself when you log a payment. Use your real rates.
              </p>

              {platforms.length > 0 && (
                <div className="mt-3 space-y-2">
                  {platforms.map((platform, index) => (
                    <div key={index} className="flex items-center gap-2 text-sm">
                      <input
                        value={platform.name}
                        onChange={(event) => updatePlatform(index, { name: event.target.value })}
                        onBlur={savePlatforms}
                        placeholder="PayPal"
                        className="min-w-0 flex-1 rounded-md border border-line-strong bg-paper px-2 py-1.5 outline-none focus:border-ink"
                      />
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        value={platform.percent}
                        onChange={(event) => updatePlatform(index, { percent: Number(event.target.value) || 0 })}
                        onBlur={savePlatforms}
                        className="w-20 rounded-md border border-line-strong bg-paper px-2 py-1.5 text-right outline-none focus:border-ink"
                      />
                      <span className="text-muted">% +</span>
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        value={platform.fixed}
                        onChange={(event) => updatePlatform(index, { fixed: Number(event.target.value) || 0 })}
                        onBlur={savePlatforms}
                        className="w-20 rounded-md border border-line-strong bg-paper px-2 py-1.5 text-right outline-none focus:border-ink"
                      />
                      <span className="w-24 text-xs text-faint">
                        200 → {formatMoney(receivedAfterFees(200, platform), currency)}
                      </span>
                      <button
                        type="button"
                        title="Remove platform"
                        onClick={() => {
                          const next = platforms.filter((_, i) => i !== index);
                          setPlatforms(next);
                          savePaymentPlatforms(next).catch(console.error);
                        }}
                        className="px-1 text-faint transition hover:text-red-500"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <button
                type="button"
                onClick={() => setPlatforms([...platforms, { name: "", percent: 0, fixed: 0 }])}
                className="mt-3 text-sm font-semibold text-muted transition hover:text-ink"
              >
                + Add platform
              </button>
            </div>
          </div>

          <h3 className={section}>Delivery</h3>
          <div className={panel}>
            <div className={row}>
              <div className="flex-1">
                <p className="font-semibold">Promised delivery time</p>
                <p className="text-sm text-muted">
                  The longest you tell clients it can take. A commission without a deadline counts from the day you
                  accept it.
                </p>
              </div>
              <label className="flex items-center gap-1.5 text-sm font-semibold">
                <input
                  type="number"
                  min={1}
                  value={auto.promise_max_days}
                  onChange={(event) => saveAuto({ promise_max_days: positive(event.target.value) }).catch(console.error)}
                  className={numberField}
                />
                days
              </label>
            </div>

            <div className={row}>
              <div className="flex-1">
                <p className="font-semibold">Delivery reminders</p>
                <p className="text-sm text-muted">
                  A Windows notification {auto.reminder_days_before} days before and on the day, while ZeeBoard is open.
                </p>
              </div>
              {auto.reminders_enabled && (
                <label className="flex items-center gap-1.5 text-sm font-semibold">
                  <input
                    type="number"
                    min={1}
                    value={auto.reminder_days_before}
                    onChange={(event) =>
                      saveAuto({ reminder_days_before: positive(event.target.value) }).catch(console.error)
                    }
                    className={numberField}
                  />
                  days before
                </label>
              )}
              <Segmented
                options={[
                  { value: "off", label: "Off" },
                  { value: "on", label: "On" },
                ]}
                value={auto.reminders_enabled ? "on" : "off"}
                onChange={(value) => saveAuto({ reminders_enabled: value === "on" }).catch(console.error)}
              />
            </div>

            <div className={row}>
              <div className="flex-1">
                <p className="font-semibold">Stalled commissions</p>
                <p className="text-sm text-muted">
                  Warns you when a commission has had no new image, correction, payment or stage change for a while.
                </p>
              </div>
              {auto.stalled_enabled && (
                <label className="flex items-center gap-1.5 text-sm font-semibold">
                  <input
                    type="number"
                    min={1}
                    value={auto.stalled_days}
                    onChange={(event) => saveAuto({ stalled_days: positive(event.target.value) }).catch(console.error)}
                    className={numberField}
                  />
                  days
                </label>
              )}
              <Segmented
                options={[
                  { value: "off", label: "Off" },
                  { value: "on", label: "On" },
                ]}
                value={auto.stalled_enabled ? "on" : "off"}
                onChange={(value) => saveAuto({ stalled_enabled: value === "on" }).catch(console.error)}
              />
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

            <div className="px-5 py-4">
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <p className="font-semibold">Automatic backups</p>
                  <p className="text-sm text-muted">
                    A copy the first time you open ZeeBoard each day. Older copies are removed automatically.
                  </p>
                </div>
                <Segmented
                  options={[
                    { value: "off", label: "Off" },
                    { value: "on", label: "On" },
                  ]}
                  value={auto.auto_backup_enabled ? "on" : "off"}
                  onChange={(value) => handleToggleAuto(value === "on").catch(console.error)}
                />
              </div>

              {auto.auto_backup_folder && (
                <div className="mt-3 space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="text-muted">Folder</span>
                    <span className="min-w-0 flex-1 truncate font-semibold" title={auto.auto_backup_folder}>
                      {auto.auto_backup_folder}
                    </span>
                    <button
                      type="button"
                      onClick={async () => {
                        const folder = await pickFolder("Choose a folder for automatic backups");
                        if (folder) await saveAuto({ auto_backup_folder: folder });
                      }}
                      className={ghostButton}
                    >
                      Change…
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-muted">Keep the last</span>
                    <input
                      type="number"
                      min={1}
                      value={auto.auto_backup_keep}
                      onChange={(event) =>
                        saveAuto({ auto_backup_keep: Math.max(1, Math.round(Number(event.target.value)) || 1) }).catch(
                          console.error,
                        )
                      }
                      className="w-16 rounded-md border border-line-strong bg-paper px-2 py-1 text-right font-bold outline-none focus:border-ink"
                    />
                    <span className="text-muted">copies</span>

                    <span className="ml-auto text-xs text-faint">
                      {auto.last_auto_backup
                        ? `Last backup: ${new Date(auto.last_auto_backup).toLocaleString()}`
                        : "No automatic backup yet"}
                    </span>
                    <button type="button" onClick={handleBackUpNow} disabled={autoRunning} className={ghostButton}>
                      {autoRunning ? "Backing up…" : "Back up now"}
                    </button>
                  </div>

                  {autoMessage && <p className="text-xs text-muted">{autoMessage}</p>}
                </div>
              )}
            </div>
          </div>

          <h3 className={section}>Import payments</h3>
          <div className={panel}>
            <div className={row}>
              <div className="flex-1">
                <p className="font-semibold">PayPal activity (CSV)</p>
                <p className="text-sm text-muted">
                  Matches each payment with a client by their email and adds it to their commission, with what you
                  actually received. Payments already imported are skipped.
                </p>
                <p className="mt-1 text-sm font-semibold">
                  {lastImport ? `Last imported payment: ${lastImport}. Download from ${downloadFrom}.` : "Nothing imported yet."}
                </p>
              </div>
              <button type="button" onClick={handleImportPaypal} className={ghostButton}>
                Choose CSV
              </button>
            </div>
          </div>

          <h3 className={section}>Export data</h3>
          <div className={panel}>
            {(
              [
                ["commissions", "Commissions", "One row per commission: client, type, stage, price and what has been paid."],
                ["payments", "Payments", "One row per payment: date, what the client paid, what you received and the platform fee."],
                [
                  "quarterly",
                  "Quarterly summary",
                  "Payments grouped by quarter and currency, by the day you received them. Currencies are never added together.",
                ],
              ] as const
            ).map(([kind, title, description]) => (
              <div key={kind} className={row}>
                <div className="flex-1">
                  <p className="font-semibold">{title}</p>
                  <p className="text-sm text-muted">{description}</p>
                </div>
                <button type="button" onClick={() => handleExport(kind)} disabled={exportingKind !== null} className={ghostButton}>
                  {exportingKind === kind ? "Exporting…" : "Export CSV"}
                </button>
              </div>
            ))}

            <p className="px-5 py-3 text-xs text-muted">
              Opens in Excel and Google Sheets (semicolon-separated, decimal comma). Exports always contain the real
              names and prices, even in private mode.
              {exportMessage && <span className="mt-1 block">{exportMessage}</span>}
            </p>
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

      {paypal && <PaypalImport preview={paypal} onClose={() => setPaypal(null)} />}

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
          message="This permanently deletes image files that are no longer linked to any commission or character. A full backup is saved first (in the app folder, 'before-cleanup', keeping the last 2), so you can restore from it if something was needed."
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