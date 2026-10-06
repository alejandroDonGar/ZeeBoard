export type ThemeChoice = "light" | "dark" | "system";

const STORAGE_KEY = "zeeboard-theme";

export function getTheme(): ThemeChoice {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved === "light" || saved === "dark" ? saved : "system";
  } catch {
    return "system";
  }
}

/** "system" quita el atributo y deja que App.css siga a Windows (prefers-color-scheme). */
export function applyTheme(theme: ThemeChoice): void {
  if (theme === "system") {
    delete document.documentElement.dataset.theme;
  } else {
    document.documentElement.dataset.theme = theme;
  }

  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // Sin almacenamiento el tema solo dura esta sesión
  }
}
