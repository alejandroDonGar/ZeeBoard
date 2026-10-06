/**
 * Detects links in text written by someone else (references a client sends).
 * Any https:// link works, plus ones without it but only for these services,
 * so "e.g." or "photo.png" don't become links.
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
// Ends in a letter or digit, so it doesn't swallow the sentence's period or comma
const END = String.raw`[^\s<>"')\.,;:!?]`;
const hosts = BARE_HOSTS.map((host) => host.replace(/\./g, String.raw`\.`)).join("|");

// A single capture group: when splitting the text, links land at the odd positions.
// (?<![\w.@/-]) avoids matching a service inside another word ("notdropbox.com/x").
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
