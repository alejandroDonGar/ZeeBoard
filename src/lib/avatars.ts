import { invoke } from "@tauri-apps/api/core";
import { importImageFromFile } from "./images";

export type Account = { platform: string | null; handle: string | null };

/** Bluesky handle as its API expects it ("name" → "name.bsky.social"), or null if invalid. */
export function blueskyActor(handle: string): string | null {
  const actor = handle.trim().replace(/^@/, "").toLowerCase();

  if (!/^[a-z0-9.-]+$/.test(actor) || /^[.-]|[.-]$/.test(actor)) {
    return null;
  }

  return actor.includes(".") ? actor : `${actor}.bsky.social`;
}

/** Telegram username (5–32 letters, digits or _), or null. */
export function telegramUser(handle: string): string | null {
  const user = handle.trim().replace(/^@/, "");

  return /^[A-Za-z0-9_]{5,32}$/.test(user) ? user : null;
}

/**
 * The photo shown on the public t.me/user page (og:image meta).
 * Without a public photo Telegram shows its own logo, so only its photo CDN addresses count.
 */
export function telegramImageFromHtml(html: string): string | null {
  const url = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)?.[1]?.replace(/&amp;/g, "&");

  return url && /^https:\/\/[^/]*(?:cdn-telegram\.org|telesco\.pe)\//.test(url) ? url : null;
}

// Downloads happen in Rust (src-tauri/src/avatars.rs), which only talks to Bluesky and Telegram.
// The installed app can get the bytes back as a plain number array instead of an ArrayBuffer.
async function download(url: string): Promise<Uint8Array> {
  const reply = await invoke<ArrayBuffer | number[]>("fetch_avatar_resource", { url });

  return reply instanceof ArrayBuffer ? new Uint8Array(reply) : Uint8Array.from(reply);
}

const asText = (bytes: Uint8Array) => new TextDecoder().decode(bytes);

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
 * Looks up a client's photo trying their accounts in order (Bluesky and Telegram; Twitter can't be done reliably).
 * The first hit is saved to disk once and its path returned; null if none.
 */
export async function fetchAvatar(accounts: Account[]): Promise<string | null> {
  const errors: string[] = [];

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
      // Private account, offline, page changed… try the next one
      console.error(`No photo from ${account.platform}`, error);
      errors.push(`${account.platform}: ${error}`);
    }
  }

  if (errors.length > 0) {
    throw new Error(errors.join(" | "));
  }

  return null;
}
