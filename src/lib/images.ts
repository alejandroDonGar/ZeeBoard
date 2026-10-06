import {
  writeFile,
  mkdir,
  remove,
  BaseDirectory,
  readDir,
} from "@tauri-apps/plugin-fs";
import { appDataDir, join } from "@tauri-apps/api/path";
import { convertFileSrc } from "@tauri-apps/api/core";

const IMAGES_FOLDER = "images";

function dataUrlToBytes(dataUrl: string): { bytes: Uint8Array; extension: string } {
  const [header, base64Data] = dataUrl.split(",");
  const mimeMatch = header.match(/data:image\/(\w+);base64/);
  const extension = mimeMatch ? mimeMatch[1] : "png";

  const binaryString = atob(base64Data);
  const bytes = new Uint8Array(binaryString.length);

  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  return { bytes, extension };
}

export async function saveImageFile(dataUrl: string): Promise<string> {
  await mkdir(IMAGES_FOLDER, {
    baseDir: BaseDirectory.AppData,
    recursive: true,
  });

  const { bytes, extension } = dataUrlToBytes(dataUrl);
  const fileName = `${crypto.randomUUID()}.${extension}`;
  const relativePath = `${IMAGES_FOLDER}/${fileName}`;

  await writeFile(relativePath, bytes, {
    baseDir: BaseDirectory.AppData,
  });

  return relativePath;
}

export async function deleteImageFile(relativePath: string): Promise<void> {
  try {
    await remove(relativePath, {
      baseDir: BaseDirectory.AppData,
    });
  } catch (error) {
    console.error("Could not delete image file", relativePath, error);
  }
}

export async function getImageDisplayUrl(pathOrDataUrl: string): Promise<string> {
  if (pathOrDataUrl.startsWith("data:")) {
    return pathOrDataUrl;
  }

  const dataDir = await appDataDir();
  const fullPath = await join(dataDir, pathOrDataUrl);

  return convertFileSrc(fullPath);
}

export async function cleanUpOrphanedImages(
  usedImagePaths: string[],
): Promise<{ deletedCount: number }> {
  const usedFileNames = new Set(
    usedImagePaths
      .filter((path) => !path.startsWith("data:"))
      .map((path) => path.replace(`${IMAGES_FOLDER}/`, "")),
  );

  const entries = await readDir(IMAGES_FOLDER, {
    baseDir: BaseDirectory.AppData,
  });

  let deletedCount = 0;

  for (const entry of entries) {
    if (entry.isFile && !usedFileNames.has(entry.name)) {
      await remove(`${IMAGES_FOLDER}/${entry.name}`, {
        baseDir: BaseDirectory.AppData,
      });

      deletedCount += 1;
    }
  }

  return { deletedCount };
}