/**
 * Detecta enlaces en un texto escrito por otra persona (referencias que envía un cliente).
 * Sirve cualquier enlace con https://, y también los escritos sin él, pero solo de estos servicios:
 * así "e.g." o "foto.png" no se convierten en enlaces.
 */
const BARE_HOSTS = [
  "drive.google.com",
  "docs.google.com",
  "photos.app.goo.gl",
  "dropbox.com",
  "onedrive.live.com",
  "1drv.ms",
  "icloud.com",
  "mega.nz",
  "wetransfer.com",
  "we.tl",
  "imgur.com",
  "catbox.moe",
  "toyhou.se",
  "pixiv.net",
  "furaffinity.net",
  "e621.net",
  "deviantart.com",
  "artstation.com",
  "twitter.com",
  "x.com",
  "bsky.app",
  "t.me",
  "discord.gg",
  "discord.com",
  "pastebin.com",
];

const BODY = String.raw`[^\s<>"')]*`;
// Termina en una letra o número, para no llevarse el punto o la coma de la frase
const END = String.raw`[^\s<>"')\.,;:!?]`;
const hosts = BARE_HOSTS.map((host) => host.replace(/\./g, String.raw`\.`)).join("|");

// Un solo grupo de captura: al partir el texto, los enlaces quedan en las posiciones impares.
// (?<![\w.@/-]) evita enganchar un servicio dentro de otra palabra ("notdropbox.com/x").
const LINK = new RegExp(
  String.raw`((?:https?:\/\/|www\.)${BODY}${END}|(?<![\w.@/-])(?:${hosts})\/${BODY}${END})`,
  "gi",
);

export type TextPart = { text: string; href: string | null };

export function splitLinks(text: string): TextPart[] {
  return text
    .split(LINK)
    .map((part, index): TextPart => {
      if (index % 2 === 0) {
        return { text: part, href: null };
      }

      return { text: part, href: /^https?:\/\//i.test(part) ? part : `https://${part}` };
    })
    .filter((part) => part.text !== "");
}
