import { open } from "@tauri-apps/plugin-dialog";
import {
  mkdir,
  copyFile,
  readDir,
  exists,
  BaseDirectory,
} from "@tauri-apps/plugin-fs";
import { join } from "@tauri-apps/api/path";

const DB_FILE_NAME = "zeeboard.db";
const IMAGES_FOLDER = "images";

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

  await copyFile(DB_FILE_NAME, await join(backupPath, DB_FILE_NAME), {
    fromPathBaseDir: BaseDirectory.AppData,
  });

  const imagesFolderExists = await exists(IMAGES_FOLDER, {
    baseDir: BaseDirectory.AppData,
  });

  if (imagesFolderExists) {
    const entries = await readDir(IMAGES_FOLDER, {
      baseDir: BaseDirectory.AppData,
    });

    for (const entry of entries) {
      if (entry.isFile) {
        await copyFile(
          `${IMAGES_FOLDER}/${entry.name}`,
          await join(backupImagesPath, entry.name),
          { fromPathBaseDir: BaseDirectory.AppData },
        );
      }
    }
  }

  return backupPath;
}