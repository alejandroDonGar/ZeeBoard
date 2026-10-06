import { useEffect, useState } from "react";
import {
  getCommissionCompletionPercentage,
  getDeadlineStatus,
  getPaymentStatus,
  isCommissionCompleted as isCommissionCompletedHelper,
  loadStageImagesForCommissions,
  formatMoney,
} from "../lib/commissionHelpers";
import {
  getCommissions,
  getCommissionTags,
  getTemplateStages,
  type Commission,
  type CommissionStageImage,
  type Tag,
  type TemplateStage,
} from "../lib/database";
import { thumbUrl } from "../lib/images";
import PageHeader from "../components/PageHeader";

const DAY = 24 * 60 * 60 * 1000;

function DashboardPage({ onOpenCommissionsPage }: { onOpenCommissionsPage: () => void }) {
  const [commissions, setCommissions] = useState<Commission[]>([]);
  const [commissionTagsById, setCommissionTagsById] = useState<Record<number, Tag[]>>({});
  const [templateStagesByTemplateId, setTemplateStagesByTemplateId] = useState<Record<number, TemplateStage[]>>({});
  const [stageImagesByCommissionId, setStageImagesByCommissionId] = useState<Record<number, CommissionStageImage[]>>({});

  useEffect(() => {
    getCommissions()
      .then(async (data) => {
        setCommissions(data);

        const tagEntries = await Promise.all(
          data.map(async (commission) => [commission.id, await getCommissionTags(commission.id)] as const),
        );
        setCommissionTagsById(Object.fromEntries(tagEntries));

        const templateIds = [
          ...new Set(data.map((commission) => commission.template_id).filter((id): id is number => id !== null)),
        ];
        const stageEntries = await Promise.all(
          templateIds.map(async (templateId) => [templateId, await getTemplateStages(templateId)] as const),
        );
        setTemplateStagesByTemplateId(Object.fromEntries(stageEntries));

        setStageImagesByCommissionId(await loadStageImagesForCommissions(data));
      })
      .catch(console.error);
  }, []);

  function handleOpenCommission(commission: Commission) {
    localStorage.setItem("zeeboard-open-commission-tabs", JSON.stringify([commission.id]));
    localStorage.setItem("zeeboard-active-commission-id", String(commission.id));
    onOpenCommissionsPage();
  }

  const today = new Date(new Date().toDateString()).getTime();
  const daysUntil = (deadline: string) => (new Date(`${deadline}T00:00:00`).getTime() - today) / DAY;

  // Las que tienen fecha primero, de la más urgente a la menos; sin fecha al final
  const inProgress = commissions
    .filter((commission) => !isCommissionCompletedHelper(commission, templateStagesByTemplateId))
    .sort((a, b) => (a.deadline ?? "9999").localeCompare(b.deadline ?? "9999"));

  const dueThisWeek = inProgress.filter(
    (commission) => commission.deadline !== null && daysUntil(commission.deadline) <= 7,
  ).length;

  const withStatus = (status: "paid" | "unpaid") =>
    commissions.filter((commission) => getPaymentStatus(commissionTagsById[commission.id] ?? []) === status);
  const sumPrices = (list: Commission[]) => list.reduce((sum, commission) => sum + (commission.price ?? 0), 0);

  const unpaid = withStatus("unpaid");
  const paid = withStatus("paid");

  const monthFormatter = new Intl.DateTimeFormat("en-US", { month: "short" });
  const now = new Date();
  const bookedByMonth = Array.from({ length: 6 }, (_, index) => {
    const month = new Date(now.getFullYear(), now.getMonth() - 5 + index, 1);
    const total = sumPrices(
      commissions.filter((commission) => {
        const created = new Date(commission.created_at);
        return created.getFullYear() === month.getFullYear() && created.getMonth() === month.getMonth();
      }),
    );
    return { label: monthFormatter.format(month), total };
  });
  const maxBooked = Math.max(...bookedByMonth.map((entry) => entry.total), 1);

  const tagCounts = new Map<number, { tag: Tag; count: number }>();
  Object.values(commissionTagsById)
    .flat()
    .filter((tag) => tag.category !== "Characters" && tag.category !== "Payment")
    .forEach((tag) => {
      const entry = tagCounts.get(tag.id) ?? { tag, count: 0 };
      entry.count += 1;
      tagCounts.set(tag.id, entry);
    });
  const topTags = [...tagCounts.values()].sort((a, b) => b.count - a.count).slice(0, 6);

  const stats = [
    { label: "In progress", value: inProgress.length, detail: "commissions", className: "text-ink" },
    {
      label: "Due within 7 days",
      value: dueThisWeek,
      detail: "including overdue",
      className: dueThisWeek > 0 ? "text-amber-600" : "text-ink",
    },
    {
      label: "Waiting for payment",
      value: formatMoney(sumPrices(unpaid)),
      detail: `${unpaid.length} tagged Not Paid`,
      className: unpaid.length > 0 ? "text-red-500" : "text-ink",
    },
    { label: "Paid", value: formatMoney(sumPrices(paid)), detail: `${paid.length} tagged Paid`, className: "text-green-600" },
  ];

  const panel = "rounded-3xl border border-line bg-surface p-5 shadow-sm";
  const heading = "mb-3 text-[11px] font-black uppercase tracking-[0.16em] text-faint";

  return (
    <div className="flex h-full min-h-0 flex-col overflow-y-auto">
      <PageHeader label="Overview" title="Dashboard" description="What's on your desk today." />

      <div className="space-y-5 p-5 pb-6">
        <dl className="grid grid-cols-4 gap-4">
          {stats.map((stat) => (
            <div key={stat.label} className={panel}>
              <dt className="text-[11px] font-bold uppercase tracking-[0.14em] text-faint">{stat.label}</dt>
              <dd className={`mt-1 text-2xl font-black ${stat.className}`}>{stat.value}</dd>
              <dd className="text-xs text-muted">{stat.detail}</dd>
            </div>
          ))}
        </dl>

        <div className="grid grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] gap-5">
          <section className={panel}>
            <h3 className={heading}>In progress · {inProgress.length}</h3>

            {inProgress.length === 0 ? (
              <p className="text-sm text-muted">Nothing on the board. Time for a break.</p>
            ) : (
              <div className="divide-y divide-line">
                {inProgress.map((commission) => {
                  const stages = commission.template_id ? templateStagesByTemplateId[commission.template_id] ?? [] : [];
                  const stageIndex = stages.findIndex((stage) => stage.id === commission.current_stage_id);
                  const images = stageImagesByCommissionId[commission.id] ?? [];
                  const latestImage = images[images.length - 1] ?? null;
                  const deadlineStatus = getDeadlineStatus(commission.deadline);
                  const progress = getCommissionCompletionPercentage(commission, templateStagesByTemplateId);

                  return (
                    <button
                      key={commission.id}
                      type="button"
                      onClick={() => handleOpenCommission(commission)}
                      className="grid w-full grid-cols-[40px_minmax(0,1fr)_96px_auto] items-center gap-4 py-2.5 text-left transition hover:bg-paper"
                    >
                      {latestImage ? (
                        <img
                          src={thumbUrl(latestImage.image_data_url)}
                          loading="lazy" decoding="async"
                          alt=""
                          className="h-10 w-10 rounded-md object-cover"
                        />
                      ) : (
                        <div className="h-10 w-10 rounded-md bg-paper" />
                      )}

                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold">{commission.title}</p>
                        <p className="truncate text-xs text-muted">
                          {stageIndex >= 0
                            ? `${stages[stageIndex].name} · ${stageIndex + 1}/${stages.length}`
                            : "Not started"}
                          {commission.client_name ? ` · ${commission.client_name}` : ""}
                        </p>
                      </div>

                      <div className="h-1.5 overflow-hidden rounded-sm bg-paper">
                        <div className="h-full bg-primary" style={{ width: `${progress}%` }} />
                      </div>

                      {deadlineStatus ? (
                        <span className={`rounded-sm px-2 py-0.5 text-xs font-bold ${deadlineStatus.className}`}>
                          {deadlineStatus.label}
                        </span>
                      ) : (
                        <span className="text-xs text-faint">No deadline</span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </section>

          <div className="space-y-5">
            <section className={panel}>
              <h3 className={heading}>Not paid yet · {unpaid.length}</h3>

              {unpaid.length === 0 ? (
                <p className="text-sm text-muted">All caught up.</p>
              ) : (
                <div className="divide-y divide-line">
                  {unpaid.map((commission) => (
                    <button
                      key={commission.id}
                      type="button"
                      onClick={() => handleOpenCommission(commission)}
                      className="flex w-full items-center justify-between gap-3 py-2 text-left text-sm transition hover:bg-paper"
                    >
                      <span className="truncate">{commission.title}</span>
                      <span className="shrink-0 font-bold">
                        {commission.price ? formatMoney(commission.price, commission.currency) : "—"}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </section>

            <section className={panel}>
              <h3 className={heading}>Most used tags</h3>

              {topTags.length === 0 ? (
                <p className="text-sm text-muted">No tags in use yet.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {topTags.map(({ tag, count }) => (
                    <span key={tag.id} className="flex items-center gap-1.5 text-xs">
                      <span className="rounded-sm px-2 py-0.5 font-bold text-white" style={{ backgroundColor: tag.color }}>
                        {tag.name}
                      </span>
                      <span className="text-faint">{count}</span>
                    </span>
                  ))}
                </div>
              )}
            </section>
          </div>
        </div>

        <section className={panel}>
          <h3 className={heading}>Booked per month · by commission start date</h3>

          <div className="flex h-36 items-end gap-3 border-b border-line">
            {bookedByMonth.map((entry) => (
              // ponytail: tooltip nativo (title); uno propio si hace falta más detalle
              <div
                key={entry.label}
                title={`${entry.label}: ${formatMoney(entry.total)}`}
                className="flex h-full flex-1 flex-col justify-end"
              >
                <div
                  className="min-h-px rounded-t-sm bg-primary transition hover:bg-primary-hover"
                  style={{ height: `${(entry.total / maxBooked) * 100}%` }}
                />
              </div>
            ))}
          </div>

          <div className="mt-1 flex gap-3">
            {bookedByMonth.map((entry) => (
              <div key={entry.label} className="flex-1 text-center text-[11px] text-faint">
                {entry.label}
                <span className="block font-semibold text-muted">{formatMoney(entry.total)}</span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

export default DashboardPage;
