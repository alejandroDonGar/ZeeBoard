import { t } from "../lib/i18n";

function PageHeader({
  label,
  title,
  description,
  action,
  onAction,
}: {
  label: string;
  title: string;
  description: string;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <header className="border-b border-line bg-paper/80 px-8 py-5 backdrop-blur">
      <div className="flex items-center justify-between gap-6">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-faint">
            {t(label)}
          </p>
          <h2 className="mt-1 font-display text-3xl font-semibold">{t(title)}</h2>
          <p className="mt-1 text-sm text-muted">{t(description)}</p>
        </div>

        {action && (
          <button
            onClick={onAction}
            className="rounded-2xl bg-primary px-5 py-3 text-sm font-bold text-on-primary shadow-md transition hover:-translate-y-0.5 hover:shadow-lg"
          >
            {t(action)}
          </button>
        )}
      </div>
    </header>
  );
}

export default PageHeader;