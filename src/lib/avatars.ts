import { invoke } from "@tauri-apps/api/core";
import { importImageFromFile } from "./images";

export type Account = { platform: string | null; handle: string | null };

/** El usuario de Bluesky como lo espera su API ("name" → "name.bsky.social"), o null si no parece uno. */
export function blueskyActor(handle: string): string | null {
  const actor = handle.trim().replace(/^@/, "").toLowerCase();

  if (!/^[a-z0-9.-]+$/.test(actor) || /^[.-]|[.-]$/.test(actor)) {
    return null;
  }

  return actor.includes(".") ? actor : `${actor}.bsky.social`;
}

/** El usuario de Telegram (5 a 32 letras, números o _), o null. */
export function telegramUser(handle: string): string | null {
  const user = handle.trim().replace(/^@/, "");

  return /^[A-Za-z0-9_]{5,32}$/.test(user) ? user : null;
}

/**
 * La foto que muestra la página pública t.me/usuario (meta og:image).
 * Sin foto pública Telegram pone su propio logo, así que solo vale una dirección de su CDN de fotos.
 */
export function telegramImageFromHtml(html: string): string | null {
  const url = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)?.[1]?.replace(/&amp;/g, "&");

  return url && /^https:\/\/[^/]*(?:cdn-telegram\.org|telesco\.pe)\//.test(url) ? url : null;
}

// Las descargas las hace Rust (src-tauri/src/avatars.rs): solo habla con Bluesky y Telegram
const download = (url: string) => invoke<ArrayBuffer>("fetch_avatar_resource", { url });
const asText = (bytes: ArrayBuffer) => new TextDecoder().decode(bytes);

async function blueskyPhotoUrl(handle: string): Promise<string | null> {
  const actor = blueskyActor(handle);

  if (!actor) {
    return null;
  }

  const profile = JSON.parse(
    asText(await download(`https://public.api.bsky.app/xrpc/app.bsky.actor.getProfile?actor=${encodeURIComponent(actor)}`)),
  );

  return typeof profile.avatar === "string" ? profile.avatar : null;
}

async function telegramPhotoUrl(handle: string): Promise<string | null> {
  const user = telegramUser(handle);

  return user ? telegramImageFromHtml(asText(await download(`https://t.me/${user}`))) : null;
}

/**
 * Busca la foto de un cliente probando sus cuentas por orden (Bluesky y Telegram; Twitter no se puede de forma fiable).
 * La primera que sirve se guarda en tu disco una sola vez y se devuelve su ruta; si ninguna, null.
 */
export async function fetchAvatar(accounts: Account[]): Promise<string | null> {
  for (const account of accounts) {
    if (!account.handle) {
      continue;
    }

    try {
      const photoUrl =
        account.platform === "Bluesky"
          ? await blueskyPhotoUrl(account.handle)
          : account.platform === "Telegram"
            ? await telegramPhotoUrl(account.handle)
            : null;

      if (photoUrl) {
        return (await importImageFromFile(new Blob([await download(photoUrl)]))).path;
      }
    } catch (error) {
      // Cuenta privada, sin conexión, página que cambió… se pasa a la siguiente
      console.error(`No photo from ${account.platform}`, error);
    }
  }

  return null;
}
