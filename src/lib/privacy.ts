import { useSyncExternalStore } from "react";

/**
 * Private mode for streams: hides client names and prices.
 * Text is replaced (`hide`, and `formatMoney` for amounts); text fields,
 * which can't be masked, are blurred with CSS when marked `data-private`.
 */
const STORAGE_KEY = "zeeboard-private-mode";

export const HIDDEN = "•••••";

function readSaved(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

// Remembered across launches: if you restart the app mid-stream, it stays hidden
let on = readSaved();
const listeners = new Set<() => void>();

function reflect() {
  if (typeof document !== "undefined") {
    document.documentElement.dataset.private = on ? "on" : "off";
  }
}

reflect();

export function isPrivate(): boolean {
  return on;
}

export function setPrivate(value: boolean): void {
  on = value;
  reflect();

  try {
    localStorage.setItem(STORAGE_KEY, value ? "1" : "0");
  } catch {
    // Without storage the mode lasts only this session
  }

  listeners.forEach((listener) => listener());
}

/** A high-level component (App) uses it so everything repaints on toggle. */
export function usePrivacy(): boolean {
  return useSyncExternalStore((listener) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }, isPrivate);
}

export function hide(text: string): string {
  return on ? HIDDEN : text;
}
