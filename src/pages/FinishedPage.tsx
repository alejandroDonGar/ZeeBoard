import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { imageUrl, thumbUrl } from "../lib/images";
import {
  isCommissionCompleted as isCommissionCompletedHelper,
  loadStageImagesForCommissions,
} from "../lib/commissionHelpers";
import {
  getCommissions,
  getTemplateStages,
  type Commission,
  type CommissionStageImage,
  type TemplateStage,
} from "../lib/database";
import PageHeader from "../components/PageHeader";

type FinishedImageItem = {
  commission: Commission;
  image: CommissionStageImage;
};

type FinishedGroup = {
  key: string;
  label: string;
  commissions: Commission[];
  images: FinishedImageItem[];
};

function FinishedPage({
  onOpenCommissionsPage,
}: {
  onOpenCommissionsPage: () => void;
}) {
  const [commissions, setCommissions] = useState<Commission[]>([]);
  const [templateStagesByTemplateId, setTemplateStagesByTemplateId] = useState<Record<number, TemplateStage[]>>({});
  const [stageImagesByCommissionId, setStageImagesByCommissionId] = useState<Record<number, CommissionStageImage[]>>({});
  const [searchQuery, setSearchQuery] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [groupMode, setGroupMode] = useState<"month" | "client">("month");
  const [activeSlideIndexByGroupKey, setActiveSlideIndexByGroupKey] = useState<Record<string, number>>({});

  useEffect(() => {
    getCommissions()
      .then(async (data) => {
        setCommissions(data);

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

        setStageImagesByCommissionId(await loadStageImagesForCommissions(data));
      })
      .catch(console.error);
  }, []);

  function isCommissionCompleted(commission: Commission) {
    return isCommissionCompletedHelper(commission, templateStagesByTemplateId);
  }

  function handleOpenCommission(commission: Commission) {
    localStorage.setItem(
      "zeeboard-open-commission-tabs",
      JSON.stringify([commission.id]),
    );

    localStorage.setItem(
      "zeeboard-active-commission-id",
      String(commission.id),
    );

    onOpenCommissionsPage();
  }

  const completedCommissions = commissions.filter(isCommissionCompleted);

  const query = searchQuery.trim().toLowerCase();

  const filteredCompleted = completedCommissions.filter((commission) => {
    const matchesSearch =
      query === "" ||
      commission.title.toLowerCase().includes(query) ||
      (commission.client_name ?? "").toLowerCase().includes(query);

    const createdAt = new Date(commission.created_at);

    const matchesFrom =
      dateFrom === "" || createdAt >= new Date(`${dateFrom}T00:00:00`);

    const matchesTo =
      dateTo === "" || createdAt <= new Date(`${dateTo}T23:59:59`);

    return matchesSearch && matchesFrom && matchesTo;
  });

  const totalEarnings = filteredCompleted.reduce(
    (sum, commission) => sum + (commission.price ?? 0),
    0,
  );

  const allImageItems: FinishedImageItem[] = filteredCompleted
    .map((commission) => {
      const images = stageImagesByCommissionId[commission.id] ?? [];

      if (images.length === 0) {
        return null;
      }

      return { commission, image: images[images.length - 1] };
    })
    .filter((item): item is FinishedImageItem => item !== null);

  const monthFormatter = new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
  });

  function buildMonthGroups(): FinishedGroup[] {
    const groupsMap = new Map<string, FinishedGroup>();

    filteredCompleted.forEach((commission) => {
      const date = new Date(commission.created_at);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

      if (!groupsMap.has(key)) {
        groupsMap.set(key, {
          key,
          label: monthFormatter.format(new Date(date.getFullYear(), date.getMonth(), 1)),
          commissions: [],
          images: [],
        });
      }

      groupsMap.get(key)!.commissions.push(commission);
    });

    allImageItems.forEach((item) => {
      const date = new Date(item.commission.created_at);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

      groupsMap.get(key)?.images.push(item);
    });

    return Array.from(groupsMap.values()).sort((a, b) => b.key.localeCompare(a.key));
  }

  function buildClientGroups(): FinishedGroup[] {
    const groupsMap = new Map<string, FinishedGroup>();

    filteredCompleted.forEach((commission) => {
      const label = commission.client_name || "No client";

      if (!groupsMap.has(label)) {
        groupsMap.set(label, {
          key: label,
          label,
          commissions: [],
          images: [],
        });
      }

      groupsMap.get(label)!.commissions.push(commission);
    });

    allImageItems.forEach((item) => {
      const label = item.commission.client_name || "No client";
      groupsMap.get(label)?.images.push(item);
    });

    return Array.from(groupsMap.values()).sort((a, b) =>
      a.label.localeCompare(b.label),
    );
  }

  const groups = groupMode === "month" ? buildMonthGroups() : buildClientGroups();

  function getActiveSlideIndex(groupKey: string, images: FinishedImageItem[]) {
    const index = activeSlideIndexByGroupKey[groupKey] ?? 0;

    if (images.length === 0) {
      return 0;
    }

    return Math.min(index, images.length - 1);
  }

  function handlePreviousSlide(groupKey: string, images: FinishedImageItem[]) {
    setActiveSlideIndexByGroupKey((current) => {
      const currentIndex = getActiveSlideIndex(groupKey, images);
      const nextIndex = currentIndex === 0 ? images.length - 1 : currentIndex - 1;

      return { ...current, [groupKey]: nextIndex };
    });
  }

  function handleNextSlide(groupKey: string, images: FinishedImageItem[]) {
    setActiveSlideIndexByGroupKey((current) => {
      const currentIndex = getActiveSlideIndex(groupKey, images);
      const nextIndex = currentIndex === images.length - 1 ? 0 : currentIndex + 1;

      return { ...current, [groupKey]: nextIndex };
    });
  }

  const hasActiveFilters = searchQuery.trim() !== "" || dateFrom !== "" || dateTo !== "";

  return (
    <>
      <PageHeader
        label="Archive"
        title="Finished commissions"
        description="Browse completed commissions grouped by month or by client."
      />

      <section className="h-[calc(100vh-117px)] overflow-y-auto p-5 pb-6">
        {commissions.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <div className="text-center">
              <h3 className="text-2xl font-black">No completed commissions</h3>
              <p className="mt-2 text-sm text-[#7c7163]">
                Finished commissions will be archived here automatically.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex rounded-2xl border border-[#d8cec0] bg-white p-1">
                <button
                  type="button"
                  onClick={() => setGroupMode("month")}
                  className={
                    groupMode === "month"
                      ? "rounded-xl bg-[#1f2933] px-3 py-1.5 text-xs font-black text-white"
                      : "rounded-xl px-3 py-1.5 text-xs font-bold text-[#7c7163]"
                  }
                >
                  By month
                </button>

                <button
                  type="button"
                  onClick={() => setGroupMode("client")}
                  className={
                    groupMode === "client"
                      ? "rounded-xl bg-[#1f2933] px-3 py-1.5 text-xs font-black text-white"
                      : "rounded-xl px-3 py-1.5 text-xs font-bold text-[#7c7163]"
                  }
                >
                  By client
                </button>
              </div>

              <input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search by title or client..."
                className="min-w-[200px] flex-1 rounded-2xl border border-[#d8cec0] bg-[#fffaf2] px-4 py-2 text-sm"
              />

              <input
                type="date"
                value={dateFrom}
                onChange={(event) => setDateFrom(event.target.value)}
                className="rounded-2xl border border-[#d8cec0] bg-[#fffaf2] px-4 py-2 text-sm"
              />

              <span className="text-xs font-bold text-[#9a8f82]">to</span>

              <input
                type="date"
                value={dateTo}
                onChange={(event) => setDateTo(event.target.value)}
                className="rounded-2xl border border-[#d8cec0] bg-[#fffaf2] px-4 py-2 text-sm"
              />

              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery("");
                    setDateFrom("");
                    setDateTo("");
                  }}
                  className="flex items-center gap-1 rounded-2xl bg-[#1f2933] px-4 py-2 text-xs font-black text-white shadow-sm transition hover:-translate-y-0.5"
                >
                  ✕ Clear filters
                </button>
              )}

              <div className="rounded-2xl border border-[#e6ded2] bg-white px-4 py-2 text-sm font-bold text-[#1f2933] shadow-sm">
                {filteredCompleted.length} finished · {totalEarnings.toFixed(0)}€ total
              </div>
            </div>

            {filteredCompleted.length === 0 ? (
              <div className="flex h-64 items-center justify-center rounded-[2rem] border border-dashed border-[#d8cec0] text-sm text-[#9a8f82]">
                No finished commissions match your filters.
              </div>
            ) : (
              groups.map((group) => {
                const activeIndex = getActiveSlideIndex(group.key, group.images);
                const currentSlide = group.images[activeIndex] ?? null;

                const previousSlide =
                  group.images.length > 1
                    ? group.images[
                        activeIndex === 0 ? group.images.length - 1 : activeIndex - 1
                      ]
                    : null;

                const nextSlide =
                  group.images.length > 1
                    ? group.images[
                        activeIndex === group.images.length - 1 ? 0 : activeIndex + 1
                      ]
                    : null;

                const groupEarnings = group.commissions.reduce(
                  (sum, commission) => sum + (commission.price ?? 0),
                  0,
                );

                return (
                  <div
                    key={group.key}
                    className="rounded-[2rem] border border-[#e1d8ca] bg-white p-5 shadow-sm"
                  >
                    <div className="mb-4 flex items-center justify-between gap-4">
                      <h3 className="text-lg font-black text-[#1f2933]">
                        {group.label}
                      </h3>

                      <span className="rounded-full bg-[#fffaf2] px-3 py-1 text-xs font-bold text-[#9a8f82]">
                        {group.commissions.length} finished · {groupEarnings.toFixed(0)}€
                      </span>
                    </div>

                    {group.images.length === 0 ? (
                      <div className="flex h-40 items-center justify-center rounded-3xl border border-dashed border-[#d8cec0] text-sm text-[#9a8f82]">
                        No images for these commissions.
                      </div>
                    ) : (
                      <div className="relative overflow-hidden rounded-3xl border border-[#e6ded2] bg-[#fffaf2] p-3">
                        <div className="mb-2 flex items-center justify-between">
                          <span className="rounded-full bg-white px-3 py-1 text-[10px] font-black text-[#7c7163] shadow-sm">
                            {currentSlide?.commission.title}
                          </span>

                          <span className="rounded-full bg-white px-3 py-1 text-[10px] font-black text-[#9a8f82] shadow-sm">
                            {activeIndex + 1} / {group.images.length}
                          </span>
                        </div>

                        <div className="relative flex min-h-[240px] items-center justify-center">
                          {group.images.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handlePreviousSlide(group.key, group.images)}
                              className="absolute left-2 z-20 flex h-10 w-10 items-center justify-center rounded-full bg-[#1f2933] text-lg font-black text-white shadow-lg transition hover:scale-105"
                            >
                              ‹
                            </button>
                          )}

                          {previousSlide && (
                            <img
                              src={thumbUrl(previousSlide.image.image_data_url)}
                              loading="lazy" decoding="async"
                              alt=""
                              className="absolute left-4 z-0 max-h-[260px] scale-75 rounded-2xl object-contain opacity-20 blur-sm pointer-events-none"
                            />
                          )}

                          {nextSlide && (
                            <img
                              src={thumbUrl(nextSlide.image.image_data_url)}
                              loading="lazy" decoding="async"
                              alt=""
                              className="absolute right-4 z-0 max-h-[260px] scale-75 rounded-2xl object-contain opacity-20 blur-sm pointer-events-none"
                            />
                          )}

                          {currentSlide && (
                            <AnimatePresence mode="wait">
                              <motion.button
                                key={currentSlide.image.id}
                                type="button"
                                onClick={() => handleOpenCommission(currentSlide.commission)}
                                initial={{ opacity: 0, scale: 0.96, filter: "blur(6px)", x: 20 }}
                                animate={{ opacity: 1, scale: 1, filter: "blur(0px)", x: 0 }}
                                exit={{ opacity: 0, scale: 0.96, filter: "blur(6px)", x: -20 }}
                                transition={{ duration: 0.15, ease: "easeOut" }}
                                className="mx-auto"
                              >
                                <img
                                  src={imageUrl(currentSlide.image.image_data_url)}
                                  alt={currentSlide.commission.title}
                                  className="mx-auto max-h-[360px] w-auto rounded-2xl object-contain shadow-sm transition hover:scale-[1.02]"
                                />
                              </motion.button>
                            </AnimatePresence>
                          )}

                          {group.images.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleNextSlide(group.key, group.images)}
                              className="absolute right-2 z-20 flex h-10 w-10 items-center justify-center rounded-full bg-[#1f2933] text-lg font-black text-white shadow-lg transition hover:scale-105"
                            >
                              ›
                            </button>
                          )}
                        </div>

                        <div className="mt-3 flex items-center justify-between">
                          <p className="text-xs font-bold text-[#7c7163]">
                            {groupMode === "month"
                              ? currentSlide?.commission.client_name || "No client"
                              : currentSlide
                                ? new Date(currentSlide.commission.created_at).toLocaleDateString("en-US", {
                                    month: "short",
                                    day: "numeric",
                                    year: "numeric",
                                  })
                                : ""}
                          </p>

                          <p className="text-xs font-bold text-[#1f2933]">
                            {currentSlide?.commission.price
                              ? `${currentSlide.commission.price} ${currentSlide.commission.currency || "EUR"}`
                              : "No price"}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}
      </section>
    </>
  );
}

export default FinishedPage;