import { restoreTrash } from "./database";
import { t } from "./i18n";

export const DATA_RESTORED = "zeeboard:data-restored";

/** Tells the app something was put back: the screen remounts to read it */
export const announceRestored = () => window.dispatchEvent(new Event(DATA_RESTORED));

type ShowToast = (
  message: string,
  type?: "success" | "error",
  action?: { label: string; onClick: () => void },
) => void;

/** The "deleted" toast, with an Undo button for that trash entry */
export function undoToast(showToast: ShowToast, message: string, trashId: number) {
  showToast(message, "success", {
    label: "Undo",
    onClick: () => {
      restoreTrash(trashId)
        .then((label) => {
          if (label !== null) {
            showToast(t("Restored “{name}”.", { name: label }), "success");
            announceRestored();
          }
        })
        .catch((error) => {
          console.error(error);
          showToast("Could not undo.", "error");
        });
    },
  });
}
