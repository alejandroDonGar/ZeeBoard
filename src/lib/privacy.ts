import { useSyncExternalStore } from "react";

/**
 * Modo privado para directos: oculta nombres de clientes y precios.
 * Los textos se sustituyen (`hide`, y `formatMoney` para los importes); los campos de texto,
 * que no se pueden enmascarar, se difuminan con CSS marcándolos con `data-private`.
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

// Se recuerda entre arranques: si reinicias la app en pleno directo, sigue oculto
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
    // Sin almacenamiento el modo solo dura esta sesión
  }

  listeners.forEach((listener) => listener());
}

/** Un componente alto (App) lo usa para que todo se vuelva a pintar al activar o desactivar. */
export function usePrivacy(): boolean {
  return useSyncExternalStore((listener) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }, isPrivate);
}

export function hide(text: string): string {
  return on ? HIDDEN : text;
}
