import { useEffect, useState } from "react";
import {
  isCommissionCompleted as isCommissionCompletedHelper,
  getDeadlineStatus,
} from "../lib/commissionHelpers";
import {
  getCommissions,
  getCommissionTags,
  getTemplateStages,
  getTags,
  type Commission,
  type Tag,
  type TemplateStage,
} from "../lib/database";
import PageHeader from "../components/PageHeader";

function DashboardPage() {
  const [commissions, setCommissions] = useState<Commission[]>([]);
  const [commissionTagsById, setCommissionTagsById] = useState<Record<number, Tag[]>>({});
  const [templateStagesByTemplateId, setTemplateStagesByTemplateId] = useState<Record<number, TemplateStage[]>>({});

  useEffect(() => {
    getCommissions()
      .then(async (data) => {
        setCommissions(data);

        const tagEntries = await Promise.all(
          data.map(async (commission) => {
            const tags = await getCommissionTags(commission.id);
            return [commission.id, tags] as const;
          }),
        );

        setCommissionTagsById(Object.fromEntries(tagEntries));

        const templateIds = Array.from(
          new Set(
            data
              .map((commission) => commission.template_id)
              .filter((templateId): templateId is number => templateId !== null),
          ),
        );

        const stageEntries = await Promise.all(
          templateIds.map(async (templateId) => {
            const stages = await getTemplateStages(templateId);
            return [templateId, stages] as const;
          }),
        );

        setTemplateStagesByTemplateId(Object.fromEntries(stageEntries));
      })
      .catch(console.error);

    getTags().catch(console.error);
  }, []);

  function isCommissionCompleted(commission: Commission) {
    return isCommissionCompletedHelper(commission, templateStagesByTemplateId);
  }

  const totalEarnings = commissions.reduce(
    (sum, commission) => sum + (commission.price ?? 0),
    0,
  );

  const activeCount = commissions.filter(
    (commission) => !isCommissionCompleted(commission),
  ).length;

  const completedCount = commissions.filter(
    (commission) => isCommissionCompleted(commission),
  ).length;

  const unpaidCount = commissions.filter((commission) => {
    const tags = commissionTagsById[commission.id] ?? [];
    return !tags.some(
      (tag) =>
        tag.category === "Payment" &&
        tag.name.toLowerCase().includes("paid"),
    );
  }).length;

  const monthFormatter = new Intl.DateTimeFormat("en-US", {
    month: "short",
    year: "numeric",
  });

  const now = new Date();
  const monthKeys: string[] = [];

  for (let i = 5; i >= 0; i--) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    monthKeys.push(`${date.getFullYear()}-${date.getMonth()}`);
  }

  const revenueByMonth = monthKeys.map((key) => {
    const [year, month] = key.split("-").map(Number);

    const total = commissions.reduce((sum, commission) => {
      if (!commission.price) {
        return sum;
      }

      const createdAt = new Date(commission.created_at);

      if (
        createdAt.getFullYear() === year &&
        createdAt.getMonth() === month
      ) {
        return sum + commission.price;
      }

      return sum;
    }, 0);

    return {
      label: monthFormatter.format(new Date(year, month, 1)),
      total,
    };
  });

  const maxMonthRevenue = Math.max(...revenueByMonth.map((entry) => entry.total), 1);

  const upcomingDeadlines = commissions
    .filter(
      (commission) =>
        !isCommissionCompleted(commission) && commission.deadline !== null,
    )
    .sort((a, b) => {
      return (
        new Date(a.deadline as string).getTime() -
        new Date(b.deadline as string).getTime()
      );
    })
    .slice(0, 5);

  const tagUsage = new Map<number, { tag: Tag; count: number }>();

  Object.values(commissionTagsById).forEach((tags) => {
    tags.forEach((tag) => {
      if (tag.category === "Characters" || tag.category === "Payment") {
        return;
      }

      const existing = tagUsage.get(tag.id);

      if (existing) {
        existing.count += 1;
      } else {
        tagUsage.set(tag.id, { tag, count: 1 });
      }
    });
  });

  const topTags = Array.from(tagUsage.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 6);

  return (
    <div className="flex h-full min-h-0 flex-col overflow-y-auto">
      <PageHeader
        label="Overview"
        title="Dashboard"
        description="A quick look at your commission workspace."
      />

      <section className="grid grid-cols-4 gap-4 px-5 pt-5">
        <div className="rounded-3xl border border-[#e6ded2] bg-white p-4 shadow-sm">
          <p className="text-xs uppercase tracking-[0.2em] text-[#9a8f82]">
            Total earned
          </p>
          <p className="mt-2 text-2xl font-black">
            {totalEarnings.toFixed(0)}€
          </p>
        </div>

        <div className="rounded-3xl border border-[#e6ded2] bg-white p-4 shadow-sm">
          <p className="text-xs uppercase tracking-[0.2em] text-[#9a8f82]">
            Active
          </p>
          <p className="mt-2 text-2xl font-black">{activeCount}</p>
        </div>

        <div className="rounded-3xl border border-[#e6ded2] bg-white p-4 shadow-sm">
          <p className="text-xs uppercase tracking-[0.2em] text-[#9a8f82]">
            Completed
          </p>
          <p className="mt-2 text-2xl font-black text-green-600">
            {completedCount}
          </p>
        </div>

        <div className="rounded-3xl border border-[#e6ded2] bg-white p-4 shadow-sm">
          <p className="text-xs uppercase tracking-[0.2em] text-[#9a8f82]">
            Unpaid
          </p>
          <p className="mt-2 text-2xl font-black text-red-500">
            {unpaidCount}
          </p>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-5 p-5">
        <div className="rounded-[2rem] border border-[#e1d8ca] bg-white p-5 shadow-sm">
          <h3 className="text-lg font-black">Revenue, last 6 months</h3>

          <div className="mt-5 space-y-3">
            {revenueByMonth.map((entry) => (
              <div key={entry.label}>
                <div className="flex items-center justify-between text-xs font-bold text-[#7c7163]">
                  <span>{entry.label}</span>
                  <span>{entry.total.toFixed(0)}€</span>
                </div>

                <div className="mt-1 h-2 overflow-hidden rounded-full bg-[#f6f3ee]">
                  <div
                    className="h-full rounded-full bg-[#1f2933]"
                    style={{
                      width: `${(entry.total / maxMonthRevenue) * 100}%`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-[2rem] border border-[#e1d8ca] bg-white p-5 shadow-sm">
          <h3 className="text-lg font-black">Upcoming deadlines</h3>

          {upcomingDeadlines.length === 0 ? (
            <p className="mt-4 text-sm text-[#9a8f82]">
              No upcoming deadlines.
            </p>
          ) : (
            <div className="mt-4 space-y-3">
              {upcomingDeadlines.map((commission) => {
                const deadlineStatus = getDeadlineStatus(commission.deadline);

                return (
                  <div
                    key={commission.id}
                    className="flex items-center justify-between gap-3 rounded-2xl bg-[#fffaf2] px-4 py-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-black text-[#1f2933]">
                        {commission.title}
                      </p>
                      <p className="mt-1 text-xs text-[#7c7163]">
                        {commission.client_name || "No client"}
                      </p>
                    </div>

                    {deadlineStatus && (
                      <span
                        className={`shrink-0 rounded-full px-3 py-1 text-xs font-black ${deadlineStatus.className}`}
                      >
                        {deadlineStatus.label}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      <section className="px-5 pb-6">
        <div className="rounded-[2rem] border border-[#e1d8ca] bg-white p-5 shadow-sm">
          <h3 className="text-lg font-black">Most used tags</h3>

          {topTags.length === 0 ? (
            <p className="mt-4 text-sm text-[#9a8f82]">
              No tags in use yet.
            </p>
          ) : (
            <div className="mt-4 flex flex-wrap gap-3">
              {topTags.map(({ tag, count }) => (
                <div
                  key={tag.id}
                  className="flex items-center gap-2 rounded-full border border-[#e6ded2] bg-[#fffaf2] py-1 pl-1 pr-3"
                >
                  <span
                    className="rounded-full px-3 py-1 text-xs font-black text-white"
                    style={{ backgroundColor: tag.color }}
                  >
                    {tag.name}
                  </span>
                  <span className="text-xs font-bold text-[#9a8f82]">
                    {count}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

export default DashboardPage;