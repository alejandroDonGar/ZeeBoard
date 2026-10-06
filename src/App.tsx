import "./App.css";
import { useEffect, useState } from "react";
import { initializeDatabase, migrateLegacyImages } from "./lib/database";
import { initImageUrls } from "./lib/images";
import CommissionsPage from "./pages/CommissionsPage";
import ClientsPage from "./pages/ClientsPage";
import TagsPage from "./pages/TagsPage";
import TemplatesPage from "./pages/TemplatesPage";
import FinishedPage from "./pages/FinishedPage";
import SettingsPage from "./pages/SettingsPage";
import DashboardPage from "./pages/DashboardPage";
import { ToastProvider } from "./context/ToastContext";

type Page = "dashboard" | "commissions" | "clients" | "tags" | "templates" | "finished" | "settings";

const navigationItems: { id: Page; label: string }[] = [
  { id: "dashboard", label: "Dashboard" },
  { id: "commissions", label: "Commissions" },
  { id: "clients", label: "Clients" },
  { id: "tags", label: "Tags" },
  { id: "templates", label: "Templates" },
  { id: "finished", label: "Finished" },
  { id: "settings", label: "Settings" },
];

type Progress = { done: number; total: number };

// El componente se suscribe al montarse para mostrar el progreso de la migración
let reportProgress: (progress: Progress) => void = () => {};

// Fuera del componente para que se ejecute una sola vez (StrictMode monta los efectos dos veces)
const startup = initImageUrls()
  .then(initializeDatabase)
  .then(() => migrateLegacyImages((done, total) => reportProgress({ done, total })));

function App() {
  const [currentPage, setCurrentPage] = useState<Page>("dashboard");
  const [ready, setReady] = useState(false);
  const [progress, setProgress] = useState<Progress | null>(null);

  useEffect(() => {
    reportProgress = setProgress;

    startup
      .then(({ migrated, failed }) => {
        if (migrated > 0 || failed > 0) {
          console.log(`Images migrated: ${migrated}, failed: ${failed}`);
        }
      })
      .catch(console.error)
      .finally(() => setReady(true));
  }, []);

  if (!ready) {
    return (
      <div className="flex h-screen items-center justify-center bg-canvas text-ink">
        <div className="text-center">
          <p className="text-4xl">🦓</p>
          <p className="mt-3 text-sm font-bold text-muted">
            {progress
              ? progress.done < progress.total
                ? `Optimizing images ${progress.done + 1} / ${progress.total}…`
                : "Compacting the database…"
              : "Loading ZeeBoard…"}
          </p>

          {progress && (
            <div className="mx-auto mt-4 h-2 w-64 overflow-hidden rounded-sm bg-line">
              <div
                className="h-full rounded-sm bg-primary transition-all duration-500"
                style={{ width: `${(progress.done / progress.total) * 100}%` }}
              />
            </div>
          )}

          {progress && progress.done < progress.total && (
            <p className="mt-3 text-xs text-faint">
              Only needed once. Large canvases take a few seconds each.
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <ToastProvider>
      <div className="h-screen overflow-hidden bg-canvas text-ink">
      <div className="flex h-full">
        <aside className="flex w-72 flex-col border-r border-line bg-paper px-5 py-6">
          <div className="mb-10">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-2xl shadow-md">
                🦓
              </div>

              <div>
                <h1 className="text-2xl font-black tracking-tight">ZeeBoard</h1>
                <p className="text-xs font-medium text-muted">
                  Commission workspace
                </p>
              </div>
            </div>
          </div>

          <nav className="space-y-2">
            {navigationItems.map((item) => {
              const isActive = currentPage === item.id;

              return (
                <button
                  key={item.id}
                  onClick={() => setCurrentPage(item.id)}
                  className={
                    isActive
                      ? "w-full rounded-2xl bg-primary px-4 py-3 text-left text-sm font-bold text-on-primary shadow-md"
                      : "w-full rounded-2xl px-4 py-3 text-left text-sm font-semibold text-muted transition hover:bg-highlight hover:text-ink"
                  }
                >
                  {item.label}
                </button>
              );
            })}
          </nav>

          <div className="mt-auto rounded-3xl border border-line bg-surface p-4 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-faint">
              Current theme
            </p>
            <p className="mt-2 text-sm font-bold">Zebra Light</p>
            <p className="mt-1 text-xs leading-relaxed text-muted">
              A soft workspace for tracking commissions, clients and deadlines.
            </p>
          </div>
        </aside>

        <main className="flex-1 overflow-hidden">
          {currentPage === "dashboard" && (
            <DashboardPage onOpenCommissionsPage={() => setCurrentPage("commissions")} />
          )}
          {currentPage === "commissions" && <CommissionsPage />}
          {currentPage === "clients" && (
            <ClientsPage onOpenCommissionsPage={() => setCurrentPage("commissions")} />
          )}
          {currentPage === "tags" && <TagsPage />}
          {currentPage === "templates" && <TemplatesPage />}
          {currentPage === "finished" && (
            <FinishedPage onOpenCommissionsPage={() => setCurrentPage("commissions")} />
          )}
          {currentPage === "settings" && <SettingsPage />}
        </main>
      </div>
    </div>
    </ToastProvider>
  );
}

export default App;