import type { ReactNode } from "react";

function SettingsCard({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <div className="h-full overflow-y-auto rounded-3xl border border-line bg-surface p-5 shadow-sm">
      <h3 className="text-xl font-black">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-muted">
        {description}
      </p>
      {children}
    </div>
  );
}

export default SettingsCard;