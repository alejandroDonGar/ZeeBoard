import { es } from "./es";

export type Language = "en" | "es";

const STORAGE_KEY = "zeeboard-language";

export function getLanguage(): Language {
  try {
    return localStorage.getItem(STORAGE_KEY) === "es" ? "es" : "en";
  } catch {
    return "en";
  }
}

export function setLanguage(language: Language): void {
  try {
    localStorage.setItem(STORAGE_KEY, language);
  } catch {
    return;
  }

  window.location.reload();
}

const language = getLanguage();

export const locale = language === "es" ? "es-ES" : "en-US";

/** The English text is the key; `{name}` placeholders are filled from `vars`. */
export function t(text: string, vars?: Record<string, string | number>): string {
  const translated = (language === "es" && es[text]) || text;

  return vars ? translated.replace(/\{(\w+)\}/g, (match, name) => String(vars[name] ?? match)) : translated;
}
