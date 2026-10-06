import { useEffect, useRef, useState } from "react";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { IMAGE_EXTENSIONS } from "./images";

/**
 * Arrastrar y soltar + pegar con Ctrl+V.
 *
 * Las zonas que aceptan imágenes se marcan con `data-image-drop="<id>"`. Tauri entrega los archivos
 * soltados con su ruta y la posición del cursor; con esa posición se busca la zona que hay debajo.
 * Devuelve el id de la zona sobre la que se está arrastrando, para resaltarla.
 */
export function useImageInput({
  onDrop,
  onPaste,
}: {
  onDrop: (zoneId: string, paths: string[]) => void;
  onPaste: (files: File[]) => void;
}): string | null {
  const [dragZoneId, setDragZoneId] = useState<string | null>(null);

  // Los handlers cambian en cada render; los listeners se registran una sola vez y leen siempre el último
  const handlers = useRef({ onDrop, onPaste });
  handlers.current = { onDrop, onPaste };

  useEffect(() => {
    function zoneAt(position: { x: number; y: number }): string | null {
      const x = position.x / window.devicePixelRatio;
      const y = position.y / window.devicePixelRatio;
      const zone = document.elementFromPoint(x, y)?.closest<HTMLElement>("[data-image-drop]");

      return zone?.dataset.imageDrop ?? null;
    }

    let cancelled = false;
    let unlisten: (() => void) | undefined;

    getCurrentWebview()
      .onDragDropEvent(({ payload }) => {
        if (payload.type === "leave") {
          setDragZoneId(null);
          return;
        }

        const zoneId = zoneAt(payload.position);

        if (payload.type === "drop") {
          setDragZoneId(null);

          const images = payload.paths.filter((path) =>
            IMAGE_EXTENSIONS.includes(path.split(".").pop()?.toLowerCase() ?? ""),
          );

          if (zoneId && images.length > 0) {
            handlers.current.onDrop(zoneId, images);
          }
        } else {
          setDragZoneId(zoneId);
        }
      })
      .then((stop) => {
        // StrictMode desmonta antes de que llegue la promesa: se limpia aquí
        if (cancelled) {
          stop();
        } else {
          unlisten = stop;
        }
      });

    function handlePaste(event: ClipboardEvent) {
      const files = Array.from(event.clipboardData?.files ?? []).filter((file) =>
        file.type.startsWith("image/"),
      );

      if (files.length > 0) {
        event.preventDefault();
        handlers.current.onPaste(files);
      }
    }

    window.addEventListener("paste", handlePaste);

    return () => {
      cancelled = true;
      unlisten?.();
      window.removeEventListener("paste", handlePaste);
    };
  }, []);

  return dragZoneId;
}
