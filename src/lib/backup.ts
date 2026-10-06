import { open } from "@tauri-apps/plugin-dialog";
import {
  mkdir,
  copyFile,
  readDir,
  exists,
  BaseDirectory,
} from "@tauri-apps/plugin-fs";
import { join } from "@tauri-apps/api/path";
import { invoke } from "@tauri-apps/api/core";
import { closeDatabase, getDatabase } from "./database";

const DB_FILE_NAME = "zeeboard.db";
const IMAGES_FOLDER = "images";
const THUMBS_FOLDER = "images/thumbs";

async function copyFolderFiles(folder: string, destination: string): Promise<void> {
  const folderExists = await exists(folder, {
    baseDir: BaseDirectory.AppData,
  });

  if (!folderExists) {
    return;
  }

  await mkdir(destination, { recursive: true });

  const entries = await readDir(folder, {
    baseDir: BaseDirectory.AppData,
  });

  for (const entry of entries) {
    if (entry.isFile) {
      await copyFile(
        `${folder}/${entry.name}`,
        await join(destination, entry.name),
        { fromPathBaseDir: BaseDirectory.AppData },
      );
    }
  }
}

function getTimestampFolderName(): string {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, "0");

  return `zeeboard-backup-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(
    now.getDate(),
  )}-${pad(now.getHours())}${pad(now.getMinutes())}`;
}

export async function exportBackup(): Promise<string | null> {
  const destinationRoot = await open({
    directory: true,
    recursive: true,
    title: "Choose a folder to save the backup",
  });

  if (!destinationRoot || Array.isArray(destinationRoot)) {
    return null;
  }

  const backupFolderName = getTimestampFolderName();
  const backupPath = await join(destinationRoot, backupFolderName);
  const backupImagesPath = await join(backupPath, IMAGES_FOLDER);

  await mkdir(backupPath, { recursive: true });
  await mkdir(backupImagesPath, { recursive: true });

  // VACUUM INTO escribe una copia coherente aunque la app esté usando la base de datos
  const database = await getDatabase();
  await database.execute("VACUUM INTO ?;", [await join(backupPath, DB_FILE_NAME)]);

  await copyFolderFiles(IMAGES_FOLDER, backupImagesPath);
  await copyFolderFiles(THUMBS_FOLDER, await join(backupImagesPath, "thumbs"));

  return backupPath;
}
/** Pide la carpeta de un backup hecho con "Export backup". */
export async function pickBackupFolder(): Promise<string | null> {
  const folder = await open({ directory: true, title: "Choose the backup folder to restore" });
  return !folder || Array.isArray(folder) ? null : folder;
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
