import { invoke } from "@tauri-apps/api/core";
import { sendNotification } from "@tauri-apps/plugin-notification";
import { appSettings, getTemplates, importRequests, updateSettings } from "./database";
import { parseResponses } from "./formImport";

/** Se lanza cuando cambian las solicitudes, para que la barra lateral vuelva a contar las nuevas. */
export const REQUESTS_CHANGED = "zeeboard-requests-changed";

/**
 * Lee el CSV de respuestas que deja el script de Google en tu Drive y guarda las solicitudes nuevas.
 * Devuelve null si aún no has elegido el archivo. Las ya importadas no se repiten.
 */
export async function syncFormResponses(): Promise<{ added: number; skipped: number } | null> {
  const path = appSettings().responses_file;

  if (!path) {
    return null;
  }

  const text = await invoke<string>("read_text_file", { path });
  const { requests, error } = parseResponses(text, await getTemplates());

  if (error) {
    throw new Error(error);
  }

  const result = await importRequests(requests);
  await updateSettings({ last_form_sync: new Date().toISOString() });

  if (result.added > 0) {
    sendNotification({
      title: "ZeeBoard",
      body: `${result.added} new commission ${result.added === 1 ? "request" : "requests"}`,
    });
  }

  // Siempre: aunque no haya nuevas, la fecha de "última comprobación" ha cambiado
  window.dispatchEvent(new Event(REQUESTS_CHANGED));

  return result;
}
