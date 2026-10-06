import { open } from "@tauri-apps/plugin-dialog";
import { appDataDir, join } from "@tauri-apps/api/path";
import { invoke } from "@tauri-apps/api/core";
import { appSettings, closeDatabase, getDatabase, updateSettings } from "./database";

const DB_FILE_NAME = "zeeboard.db";

function getTimestampFolderName(): string {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, "0");

  return `zeeboard-backup-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(
    now.getDate(),
  )}-${pad(now.getHours())}${pad(now.getMinutes())}`;
}

/**
 * Hace una copia (base de datos + imágenes) en una carpeta con fecha dentro de `root`.
 * Con `keep`, deja solo las `keep` copias más recientes de `root`.
 * La base de datos se copia con VACUUM INTO (coherente aunque la app esté escribiendo);
 * las imágenes y la rotación van en Rust, que no depende de los permisos del selector de carpetas.
 */
export async function createBackup(root: string, keep?: number): Promise<string> {
  const backupPath = await join(root, getTimestampFolderName());

  await invoke("prepare_backup", { dir: backupPath });

  try {
    const database = await getDatabase();
    await database.execute("VACUUM INTO ?;", [await join(backupPath, DB_FILE_NAME)]);
  } catch (error) {
    // finish_backup borra la carpeta a medias cuando falta la base de datos
    await invoke("finish_backup", { dir: backupPath, keep: null }).catch(() => {});
    throw error;
  }

  await invoke("finish_backup", { dir: backupPath, keep: keep ?? null });

  return backupPath;
}

export async function exportBackup(): Promise<string | null> {
  const destinationRoot = await pickFolder("Choose a folder to save the backup");

  return destinationRoot ? await createBackup(destinationRoot) : null;
}

/** Copia automática: la primera vez que se abre la app cada día, si está activada y con carpeta. */
export async function runAutoBackup(force = false): Promise<string | null> {
  const settings = appSettings();

  if (!settings.auto_backup_folder) {
    if (force) throw new Error("Choose a folder for automatic backups first");
    return null;
  }

  const doneToday =
    settings.last_auto_backup !== null &&
    new Date(settings.last_auto_backup).toDateString() === new Date().toDateString();

  if (!force && (!settings.auto_backup_enabled || doneToday)) {
    return null;
  }

  const path = await createBackup(settings.auto_backup_folder, settings.auto_backup_keep);
  await updateSettings({ last_auto_backup: new Date().toISOString() });

  return path;
}

/** Antes de borrar imágenes sin usar: copia completa en la carpeta de la app (se guardan las 2 últimas). */
export async function backupBeforeCleanup(): Promise<void> {
  await createBackup(await join(await appDataDir(), "before-cleanup"), 2);
}

export async function pickFolder(title: string): Promise<string | null> {
  const folder = await open({ directory: true, title });
  return !folder || Array.isArray(folder) ? null : folder;
}

/** Pide la carpeta de un backup hecho con "Export backup". */
export function pickBackupFolder(): Promise<string | null> {
  return pickFolder("Choose the backup folder to restore");
}

/**
 * Sustituye los datos actuales por los del backup y recarga la app.
 * Antes guarda una copia de los datos actuales (en la carpeta de la app, "before-restore").
 */
export async function restoreBackup(folder: string): Promise<void> {
  await closeDatabase();

  // Si falla (por ejemplo, la carpeta no es un backup) no se ha tocado nada:
  // el error sube y la base de datos se vuelve a abrir sola en el siguiente uso
  await invoke<string>("restore_backup", {
    backupDir: folder,
    stamp: getTimestampFolderName().replace("zeeboard-backup-", ""),
  });

  // La app arranca de nuevo con los datos restaurados (y las migraciones los ponen al día)
  window.location.reload();
}
