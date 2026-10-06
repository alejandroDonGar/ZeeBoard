import { openUrl } from "@tauri-apps/plugin-opener";
import { splitLinks } from "../lib/links";

/** Text with clickable links: they open in the browser after your click. */
function Linkified({ text }: { text: string }) {
  return (
    <>
      {splitLinks(text).map((part, index) =>
        part.href ? (
          <button
            key={index}
            type="button"
            title={part.href}
            onClick={() => openUrl(part.href!).catch(console.error)}
            className="break-all text-left underline decoration-line-strong underline-offset-2 transition hover:text-ink"
          >
            {part.text}
          </button>
        ) : (
          part.text
        ),
      )}
    </>
  );
}

export default Linkified;
