import { invoke, convertFileSrc } from "@tauri-apps/api/core";
import { appDataDir, join } from "@tauri-apps/api/path";
import { open } from "@tauri-apps/plugin-dialog";

// El procesado pesado (decodificar, reducir, comprimir a WebP) se hace en Rust: src-tauri/src/images.rs

export type StoredImage = {
  /** Ruta relativa a la carpeta de datos, p. ej. `images/ab12….webp` */
  path: string;
  thumbPath: string;
  width: number;
  height: number;
  bytes: number;
  reused: boolean;
};

export type StorageStats = {
  imageCount: number;
  imagesBytes: number;
  thumbsBytes: number;
  databaseBytes: number;
};

export const IMAGE_EXTENSIONS = ["png", "jpg", "jpeg", "webp", "gif", "bmp", "tif", "tiff"];

// Se rellena una vez al arrancar (initImageUrls) para poder construir las URLs sin await
let dataDir = "";

export async function initImageUrls(): Promise<void> {
  dataDir = await appDataDir();
}

/** Las imágenes nuevas guardan su miniatura en `images/thumbs/` con el mismo nombre. */
export function getThumbPath(path: string): string {
  return isProcessedImage(path) ? path.replace("images/", "images/thumbs/") : path;
}

/** `true` si la imagen ya pasó por el procesado nuevo (WebP con nombre por contenido). */
export function isProcessedImage(path: string): boolean {
  return /^images\/[0-9a-f]{24}\.webp$/.test(path);
}

function toAssetUrl(path: string): string {
  if (!path || path.startsWith("data:")) {
    return path;
  }

  const separator = dataDir.includes("\\") ? "\\" : "/";
  return convertFileSrc(`${dataDir}${separator}${path.replace(/\//g, separator)}`);
}

/** Versión para ver a tamaño grande (zoom, carrusel principal). */
export function imageUrl(path: string): string {
  return toAssetUrl(path);
}

/** Miniatura para tarjetas, listas y rejillas. */
export function thumbUrl(path: string): string {
  return toAssetUrl(getThumbPath(path));
}

/** La foto de un cliente: si es un archivo nuestro, su miniatura; si es una dirección antigua (Bluesky), tal cual. */
export function avatarSrc(avatar: string): string {
  return isProcessedImage(avatar) ? thumbUrl(avatar) : avatar;
}

export async function importImageFromPath(path: string): Promise<StoredImage> {
  return await invoke<StoredImage>("import_image_from_path", { path });
}

/** Ruta del disco (selector, arrastrar) o archivo en memoria (Ctrl+V). */
export async function importImage(source: string | Blob): Promise<StoredImage> {
  return typeof source === "string"
    ? await importImageFromPath(source)
    : await importImageFromFile(source);
}

/** Para imágenes pegadas con Ctrl+V: los bytes viajan en binario, sin base64. */
export async function importImageFromFile(file: Blob): Promise<StoredImage> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  return await invoke<StoredImage>("import_image_from_bytes", bytes);
}

export async function importImageFromDataDir(relativePath: string): Promise<StoredImage> {
  return await importImageFromPath(await join(dataDir, relativePath));
}

/** Abre el selector de archivos del sistema; devuelve las rutas elegidas. */
export async function pickImagePaths(): Promise<string[]> {
  const selection = await open({
    multiple: true,
    title: "Choose images",
    filters: [{ name: "Images", extensions: IMAGE_EXTENSIONS }],
  });

  if (!selection) {
    return [];
  }

  return Array.isArray(selection) ? selection : [selection];
}

export async function deleteImageFiles(paths: string[]): Promise<void> {
  const processed = paths.filter(isProcessedImage);

  if (processed.length > 0) {
    await invoke("delete_image_files", {
      paths: processed.flatMap((path) => [path, getThumbPath(path)]),
    });
  }
}

/** Borra todo lo que hay en `images/` y `images/thumbs/` que no esté en `usedPaths`. */
export async function cleanUpOrphanedImages(usedPaths: string[]): Promise<{ deletedCount: number }> {
  const keep = usedPaths.flatMap((path) => [path, getThumbPath(path)]);
  const deletedCount = await invoke<number>("cleanup_orphan_images", { usedPaths: keep });

  return { deletedCount };
}

export async function getStorageStats(): Promise<StorageStats> {
  return await invoke<StorageStats>("storage_stats");
}
