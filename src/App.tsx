import "./App.css";
import { useEffect, useState } from "react";
import { initializeDatabase, migrateLegacyImages, migratePaymentTags } from "./lib/database";
import { initImageUrls } from "./lib/images";
import CommissionsPage from "./pages/CommissionsPage";
import ClientsPage from "./pages/ClientsPage";
import TagsPage from "./pages/TagsPage";
import TemplatesPage from "./pages/TemplatesPage";
import FinishedPage from "./pages/FinishedPage";
import SettingsPage from "./pages/SettingsPage";
import DashboardPage from "./pages/DashboardPage";
import RequestsPage from "./pages/RequestsPage";
import { ToastProvider, useToast } from "./context/ToastContext";
import { runAutoBackup } from "./lib/backup";
import { setPrivate, usePrivacy } from "./lib/privacy";
import { loadAttention, notifyNew } from "./lib/reminders";
import { REQUESTS_CHANGED, syncFormResponses } from "./lib/formSync";
import { getRequests } from "./lib/database";
import { t } from "./lib/i18n";
import {
  IconBrush,
  IconCircleCheck,
  IconEye,
  IconEyeOff,
  IconInbox,
  IconLayoutDashboard,
  IconListDetails,
  IconSettings,
  IconTags,
  IconUsers,
  type Icon,
} from "@tabler/icons-react";

type Page = "dashboard" | "commissions" | "requests" | "clients" | "tags" | "templates" | "finished" | "settings";

const navigationItems: { id: Page; label: string; icon: Icon }[] = [
  { id: "dashboard", label: "Dashboard", icon: IconLayoutDashboard },
  { id: "commissions", label: "Commissions", icon: IconBrush },
  { id: "requests", label: "Requests", icon: IconInbox },
  { id: "clients", label: "Clients", icon: IconUsers },
  { id: "tags", label: "Tags", icon: IconTags },
  { id: "templates", label: "Templates", icon: IconListDetails },
  { id: "finished", label: "Finished", icon: IconCircleCheck },
  { id: "settings", label: "Settings", icon: IconSettings },
];

type Progress = { done: number; total: number };

// Subscribes on mount to show migration progress
let reportProgress: (progress: Progress) => void = () => {};

// Outside the component so it runs once (StrictMode mounts effects twice)
const startup = initImageUrls()
  .then(initializeDatabase)
  .then(migratePaymentTags)
  .then(() => migrateLegacyImages((done, total) => reportProgress({ done, total })));

/** Delivery and stalled-commission alerts: on open and every 30 minutes while the app is open. */
function Reminders() {
  useEffect(() => {
    const check = () => loadAttention().then(notifyNew).catch(console.error);

    check();
    const timer = setInterval(check, 30 * 60 * 1000);

    return () => clearInterval(timer);
  }, []);

  return null;
}

/** New form responses: on open and every 30 minutes, if a responses file is chosen. */
function FormSync() {
  useEffect(() => {
    // A missing file (Drive unmounted, offline…) is silent; retried later
    const check = () => syncFormResponses().catch(console.error);

    check();
    const timer = setInterval(check, 30 * 60 * 1000);

    return () => clearInterval(timer);
  }, []);

  return null;
}

let autoBackupStarted = false;

/** Once per launch, after the app is visible: runs the automatic backup in the background if due. */
function AutoBackup() {
  const { showToast } = useToast();

  useEffect(() => {
    if (autoBackupStarted) {
      return;
    }

    autoBackupStarted = true;

    runAutoBackup().catch((error) => {
      console.error(error);
      showToast(`Automatic backup failed: ${error}. It will try again next time you open ZeeBoard.`, "error");
    });
  }, [showToast]);

  return null;
}

function App() {
  const [currentPage, setCurrentPage] = useState<Page>(() => {
    const saved = sessionStorage.getItem("zeeboard-page");
    return navigationItems.some((item) => item.id === saved) ? (saved as Page) : "dashboard";
  });

  useEffect(() => {
    sessionStorage.setItem("zeeboard-page", currentPage);
  }, [currentPage]);
  // On change the whole app repaints with data hidden or visible
  const privateMode = usePrivacy();
  const [newRequests, setNewRequests] = useState(0);

  useEffect(() => {
    const count = () =>
      getRequests()
        .then((requests) => setNewRequests(requests.filter((request) => request.status === "new").length))
        .catch(console.error);

    count();
    window.addEventListener(REQUESTS_CHANGED, count);
    return () => window.removeEventListener(REQUESTS_CHANGED, count);
  }, []);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === "p") {
        event.preventDefault();
        setPrivate(!privateMode);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [privateMode]);
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
      <AutoBackup />
      <Reminders />
      <FormSync />
      <div className="h-screen overflow-hidden bg-canvas text-ink">
      <div className="flex h-full">
        <aside className="flex w-72 flex-col border-r border-line bg-paper px-5 py-6">
          <div className="mb-10">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-2xl shadow-md">
                🦓
              </div>

              <div>
                <h1 className="font-display text-2xl font-semibold">ZeeBoard</h1>
                <p className="text-xs font-medium text-muted">
                  {t("Commission workspace")}
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
                      ? "flex w-full items-center gap-3 rounded-2xl bg-primary px-4 py-3 text-left text-sm font-bold text-on-primary shadow-md"
                      : "flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm font-semibold text-muted transition hover:bg-highlight hover:text-ink"
                  }
                >
                  <item.icon size={18} stroke={1.75} aria-hidden="true" />
                  {t(item.label)}
                  {item.id === "requests" && newRequests > 0 && (
                    <span className="ml-2 rounded-sm bg-amber-100 px-1.5 py-0.5 text-[11px] font-bold text-amber-900">
                      {newRequests}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          <button
            type="button"
            onClick={() => setPrivate(!privateMode)}
            title={t("Hide client names and prices while streaming (Ctrl+Shift+P)")}
            className={`mt-auto flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left text-sm font-bold transition ${
              privateMode
                ? "border-amber-400 bg-amber-100 text-amber-900"
                : "border-line bg-surface text-muted hover:border-ink hover:text-ink"
            }`}
          >
            <span className="flex items-center gap-3">
              {privateMode ? <IconEyeOff size={18} stroke={1.75} aria-hidden="true" /> : <IconEye size={18} stroke={1.75} aria-hidden="true" />}
              {privateMode ? t("Private mode on") : t("Private mode")}
            </span>
            <span className="text-[11px] font-semibold opacity-70">Ctrl+Shift+P</span>
          </button>

          <div className="mt-3 rounded-3xl border border-line bg-surface p-4 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-faint">
              {t("Current theme")}
            </p>
            <p className="mt-2 text-sm font-bold">Zebra Light</p>
            <p className="mt-1 text-xs leading-relaxed text-muted">
              {t("A soft workspace for tracking commissions, clients and deadlines.")}
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
          {currentPage === "requests" && (
            <RequestsPage onOpenCommissionsPage={() => setCurrentPage("commissions")} />
          )}
          {currentPage === "settings" && <SettingsPage />}
        </main>
      </div>
    </div>
    </ToastProvider>
  );
}

export default App;