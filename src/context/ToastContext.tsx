import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from "react";
import { t } from "../lib/i18n";

type ToastType = "success" | "error";

type ToastContextValue = {
  showToast: (message: string, type?: ToastType) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toastMessage, setToastMessage] = useState("");
  const [toastType, setToastType] = useState<ToastType>("success");

  const showToast = useCallback((message: string, type: ToastType = "success") => {
    setToastType(type);
    setToastMessage(t(message));

    setTimeout(() => {
      setToastMessage("");
    }, 2500);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}

      {toastMessage && (
        <div
          className={
            toastType === "success"
              ? "fixed bottom-6 right-6 z-[60] rounded-2xl bg-green-600 px-5 py-3 text-sm font-bold text-white shadow-xl"
              : "fixed bottom-6 right-6 z-[60] rounded-2xl bg-red-500 px-5 py-3 text-sm font-bold text-white shadow-xl"
          }
        >
          {toastMessage}
        </div>
      )}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);

  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }

  return context;
}