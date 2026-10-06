import { t } from "./i18n";
/**
 * Import Google Form responses (CSV downloaded from the responses sheet).
 * All pure logic: the CSV comes in as text and ready-to-save requests come out.
 */

/** Standard Google CSV: double quotes, quotes escaped as "" and line breaks inside a cell. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;

  // Google separates with commas; Spanish Excel saves with semicolons
  const body = text.replace(/^﻿/, "");
  const firstLine = body.split(/\r?\n/, 1)[0] ?? "";
  const separator = (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ";" : ",";

  for (let index = 0; index < body.length; index++) {
    const char = body[index];

    if (quoted) {
      if (char === '"' && body[index + 1] === '"') {
        cell += '"';
        index++;
      } else if (char === '"') {
        quoted = false;
      } else {
        cell += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === separator) {
      row.push(cell);
      cell = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && body[index + 1] === "\n") index++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }

  if (cell !== "" || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }

  return rows.filter((items) => items.some((item) => item.trim() !== ""));
}

/**
 * "2026/10/04 4:59:22 p. m. CET" (Google's Spanish format), "04/10/2026 16:59:22" or "2026-10-04 16:59".
 * Returns the date as ISO; null if not understood.
 */
export function parseTimestamp(text: string): string | null {
  const time = String.raw`[ T]+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(?:([ap])\.?\s*m\.?)?`;
  const yearFirst = text.trim().match(new RegExp(String.raw`^(\d{4})[/-](\d{1,2})[/-](\d{1,2})${time}`, "i"));
  const dayFirst = text.trim().match(new RegExp(String.raw`^(\d{1,2})/(\d{1,2})/(\d{4})${time}`, "i"));

  const [year, month, day, hours, minutes, seconds, meridiem] = yearFirst
    ? [yearFirst[1], yearFirst[2], yearFirst[3], yearFirst[4], yearFirst[5], yearFirst[6], yearFirst[7]]
    : dayFirst
      ? [dayFirst[3], dayFirst[2], dayFirst[1], dayFirst[4], dayFirst[5], dayFirst[6], dayFirst[7]]
      : [];

  if (!year) {
    return null;
  }

  let hour = Number(hours);

  if (meridiem) {
    hour = (hour % 12) + (meridiem.toLowerCase() === "p" ? 12 : 0);
  }

  return new Date(Number(year), Number(month) - 1, Number(day), hour, Number(minutes), Number(seconds ?? 0)).toISOString();
}

const PLATFORM_WORDS: [RegExp, string][] = [
  [/^(bluesky|bsky)$/i, "Bluesky"],
  [/^(telegram|tg)$/i, "Telegram"],
  [/^discord$/i, "Discord"],
  [/^(twitter|x|tw)$/i, "Twitter / X"],
  [/^(e-?mail|gmail|correo)$/i, "Email"],
];

const platformOf = (word: string) => PLATFORM_WORDS.find(([pattern]) => pattern.test(word))?.[1] ?? null;

/** To compare handles: no @, case-insensitive. */
export function normalizeHandle(handle: string | null | undefined): string {
  return (handle ?? "").trim().replace(/^@/, "").toLowerCase();
}

/**
 * Extracts platform and handle from what people typed:
 * "Telegram @user", "bsky -> @user", "twitter -> user", "user"…
 * If nothing is understood, returns the text as the handle with platform "Other".
 */
export function parseContact(raw: string): { platform: string; handle: string } {
  const text = raw.trim();
  const email = text.match(/[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+/)?.[0];

  if (email) {
    return { platform: "Email", handle: email };
  }

  // Strips stray symbols at the edges ("->", ":", quotes…) but keeps @ . _ - inside the handle
  const tokens = text
    .split(/[\s,;|/]+/)
    .map((token) => token.replace(/^[^\w@]+|[^\w]+$/g, ""))
    .filter(Boolean);

  const platform = tokens.map(platformOf).find(Boolean) ?? null;
  const candidates = tokens.filter((token) => !platformOf(token));
  const handle = candidates.find((token) => token.startsWith("@")) ?? candidates[candidates.length - 1];

  if (!handle) {
    return { platform: platform ?? "Other", handle: text };
  }

  // Social handles get an @ so they're all written the same way
  const social = platform === "Twitter / X" || platform === "Bluesky" || platform === "Telegram";

  return {
    platform: platform ?? "Other",
    handle: social && !handle.startsWith("@") ? `@${handle}` : handle,
  };
}

/**
 * The account to tag when posting: "Twitter @name", "bsky -> name"…
 * "none" (or empty) = no tag; "same" = the contact's account. An email isn't a taggable account.
 */
export function parseTagAccount(
  text: string,
  contact: { platform: string; handle: string },
): { platform: string; handle: string } | null {
  const clean = text.trim();

  if (clean === "" || /^(none|no|nobody|n\/a|na|no tag|don'?t tag( me)?|-+)$/i.test(clean)) {
    return null;
  }

  if (/^(same|same as above|the same|igual|el mismo)$/i.test(clean)) {
    return contact.platform === "Email" || contact.platform === "Other" ? null : contact;
  }

  const account = parseContact(clean);

  return account.platform === "Email" ? null : account;
}

/** "Render Full Body + Simple Background" encaja con la plantilla "Rendered Full Body + Simple Background". */
export function matchTemplate<T extends { id: number; name: string }>(text: string, templates: T[]): T | null {
  const normalize = (value: string) => value.toLowerCase().replace(/rendered/g, "render").replace(/[^a-z0-9]/g, "");

  return templates.find((template) => normalize(template.name) === normalize(text)) ?? null;
}

const tagWords = (text: string) =>
  new Set(text.toLowerCase().replace(/rendered/g, "render").split(/[^a-z0-9]+/).filter(Boolean));

/**
 * Las etiquetas que le tocan a una comisión recién aceptada:
 * - tipo ("Commission Type"): la más específica cuyas palabras están todas en el nombre de la plantilla
 *   ("Render + Complex Background" encaja con "Rendered Full Body + Complex Background"; "Sketch" no, si hay "Sketch + Background")
 * - personajes ("Characters"): la que dice "3 Characters" si pidió 3.
 */
export function autoTagIds(
  templateName: string | null,
  characters: number,
  tags: { id: number; name: string; category: string }[],
): number[] {
  const words = tagWords(templateName ?? "");
  const types = tags
    .filter((tag) => tag.category === "Commission Type")
    .map((tag) => ({ tag, size: tagWords(tag.name).size, fits: [...tagWords(tag.name)].every((word) => words.has(word)) }))
    .filter((item) => item.fits);
  const best = Math.max(0, ...types.map((item) => item.size));
  const count = tags.filter(
    (tag) => tag.category === "Characters" && Number(tag.name.match(/^\s*(\d+)\s*characters?\s*$/i)?.[1]) === characters,
  );

  return [...types.filter((item) => item.size === best).map((item) => item.tag), ...count].map((tag) => tag.id);
}

export type ImportedRequest = {
  /** Identifica la respuesta para no importarla dos veces */
  externalId: string;
  created_at: string;
  name: string;
  platform: string;
  contact: string;
  template_id: number | null;
  characters: number;
  email: string | null;
  /** A quién etiquetar al publicar (null = a nadie) */
  tag_platform: string | null;
  tag_handle: string | null;
  details: string | null;
};

/** Convierte el CSV de la hoja de respuestas en solicitudes. Localiza las columnas por su título. */
export function parseResponses<T extends { id: number; name: string }>(
  csv: string,
  templates: T[],
): { requests: ImportedRequest[]; error: string | null } {
  const [header, ...rows] = parseCsv(csv);

  if (!header) {
    return { requests: [], error: t("The file is empty") };
  }

  const find = (pattern: RegExp) => header.findIndex((title) => pattern.test(title));
  const typeColumn = find(/type of commission|tipo de comisi/i);
  const contactColumn = find(/handle|communication|contact|usuario/i);
  const emailColumn = find(/e-?mail|correo/i);
  const tagColumn = find(/\btag\b|posting|etiquet/i);
  const referencesColumn = find(/reference|referencia/i);
  const charactersColumn = find(/how many characters|number of characters|cu[aá]ntos personajes/i);
  const timeColumn = Math.max(find(/marca temporal|timestamp/i), 0);

  if (typeColumn < 0 || contactColumn < 0) {
    return {
      requests: [],
      error: t("This doesn't look like your commission form: I can't find the type and contact columns"),
    };
  }

  const requests = rows
    .filter((row) => (row[contactColumn] ?? "").trim() !== "")
    .map((row): ImportedRequest => {
      const typeText = (row[typeColumn] ?? "").trim();
      const contact = parseContact(row[contactColumn] ?? "");
      const template = matchTemplate(typeText, templates);
      const emailText = emailColumn >= 0 ? (row[emailColumn] ?? "").trim() : "";
      // Solo se guarda como correo si lo parece (y en minúsculas, para poder emparejarlo luego); si no, queda en los detalles
      const email = /^\S+@\S+\.\S+$/.test(emailText) ? emailText.toLowerCase() : null;
      const tag = tagColumn >= 0 ? parseTagAccount(row[tagColumn] ?? "", contact) : null;
      const referencesText = referencesColumn >= 0 ? (row[referencesColumn] ?? "").trim() : "";
      const notes = [
        template || !typeText ? null : `Type in the form: ${typeText}`,
        referencesText ? `References: ${referencesText}` : null,
        emailText && !email ? `Email in the form: ${emailText}` : null,
      ].filter(Boolean);

      return {
        externalId: `${row[timeColumn]}|${typeText}|${(row[contactColumn] ?? "").trim()}`,
        created_at: parseTimestamp(row[timeColumn] ?? "") ?? new Date().toISOString(),
        name: contact.handle.replace(/^@/, ""),
        platform: contact.platform,
        contact: contact.handle,
        template_id: template?.id ?? null,
        // "3 Characters" → 3; sin esa pregunta (o sin número), 1
        characters: Math.max(1, Number((charactersColumn >= 0 ? row[charactersColumn] ?? "" : "").match(/\d+/)?.[0]) || 1),
        email,
        tag_platform: tag?.platform ?? null,
        tag_handle: tag?.handle ?? null,
        // Lo que no encaja (un tipo desconocido, un correo raro) se conserva tal cual para revisarlo a mano
        details: notes.length > 0 ? notes.join("\n") : null,
      };
    });

  return { requests, error: null };
}
