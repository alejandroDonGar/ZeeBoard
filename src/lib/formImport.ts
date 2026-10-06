/**
 * Importar las respuestas del formulario de Google (CSV descargado de la hoja de respuestas).
 * Todo aquí es lógica pura: el CSV entra como texto y salen solicitudes listas para guardar.
 */

/** CSV estándar de Google: comillas dobles, comillas escapadas como "" y saltos de línea dentro de una celda. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;

  // Google separa con comas; un Excel en español guarda con punto y coma
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
 * "2026/10/04 4:59:22 p. m. CET" (la de Google en español), "04/10/2026 16:59:22" o "2026-10-04 16:59".
 * Devuelve la fecha en ISO; si no la entiende, null.
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

/** Para comparar usuarios: sin @ y sin mayúsculas. */
export function normalizeHandle(handle: string | null | undefined): string {
  return (handle ?? "").trim().replace(/^@/, "").toLowerCase();
}

/**
 * Saca la plataforma y el usuario de lo que escribió la gente:
 * "Telegram @usuario", "bsky -> @usuario", "twitter -> usuario", "usuario"…
 * Si no entiende nada, devuelve el texto tal cual como usuario y plataforma "Other".
 */
export function parseContact(raw: string): { platform: string; handle: string } {
  const text = raw.trim();
  const email = text.match(/[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+/)?.[0];

  if (email) {
    return { platform: "Email", handle: email };
  }

  // Quita los signos sueltos de los bordes ("->", ":", comillas…), pero deja @ . _ - dentro del usuario
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

  // A los usuarios de redes se les pone @ para que todos queden escritos igual
  const social = platform === "Twitter / X" || platform === "Bluesky" || platform === "Telegram";

  return {
    platform: platform ?? "Other",
    handle: social && !handle.startsWith("@") ? `@${handle}` : handle,
  };
}

/** "Render Full Body + Simple Background" encaja con la plantilla "Rendered Full Body + Simple Background". */
export function matchTemplate<T extends { id: number; name: string }>(text: string, templates: T[]): T | null {
  const normalize = (value: string) => value.toLowerCase().replace(/rendered/g, "render").replace(/[^a-z0-9]/g, "");

  return templates.find((template) => normalize(template.name) === normalize(text)) ?? null;
}

export type ImportedRequest = {
  /** Identifica la respuesta para no importarla dos veces */
  externalId: string;
  created_at: string;
  name: string;
  platform: string;
  contact: string;
  template_id: number | null;
  email: string | null;
  details: string | null;
};

/** Convierte el CSV de la hoja de respuestas en solicitudes. Localiza las columnas por su título. */
export function parseResponses<T extends { id: number; name: string }>(
  csv: string,
  templates: T[],
): { requests: ImportedRequest[]; error: string | null } {
  const [header, ...rows] = parseCsv(csv);

  if (!header) {
    return { requests: [], error: "The file is empty" };
  }

  const find = (pattern: RegExp) => header.findIndex((title) => pattern.test(title));
  const typeColumn = find(/type of commission|tipo de comisi/i);
  const contactColumn = find(/handle|communication|contact|usuario/i);
  const emailColumn = find(/e-?mail|correo/i);
  const timeColumn = Math.max(find(/marca temporal|timestamp/i), 0);

  if (typeColumn < 0 || contactColumn < 0) {
    return {
      requests: [],
      error: "This doesn't look like your commission form: I can't find the type and contact columns",
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
      const notes = [
        template || !typeText ? null : `Type in the form: ${typeText}`,
        emailText && !email ? `Email in the form: ${emailText}` : null,
      ].filter(Boolean);

      return {
        externalId: `${row[timeColumn]}|${typeText}|${(row[contactColumn] ?? "").trim()}`,
        created_at: parseTimestamp(row[timeColumn] ?? "") ?? new Date().toISOString(),
        name: contact.handle.replace(/^@/, ""),
        platform: contact.platform,
        contact: contact.handle,
        template_id: template?.id ?? null,
        email,
        // Lo que no encaja (un tipo desconocido, un correo raro) se conserva tal cual para revisarlo a mano
        details: notes.length > 0 ? notes.join("\n") : null,
      };
    });

  return { requests, error: null };
}
