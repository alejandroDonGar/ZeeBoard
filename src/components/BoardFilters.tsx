import { useState } from "react";
import type { Tag } from "../lib/database";

export type StatusFilter = "all" | "active" | "overdue";

const PAYMENT_CATEGORY = "Payment";
// Los personajes se filtran desde Clientes, no aquí
const HIDDEN_CATEGORIES = ["Characters", PAYMENT_CATEGORY];

function Segmented<T extends string | number>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div className="inline-flex shrink-0 rounded-md border border-line bg-paper p-0.5">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={
            option.value === value
              ? "rounded-sm bg-primary px-3 py-1.5 text-xs font-bold text-on-primary"
              : "rounded-sm px-3 py-1.5 text-xs font-semibold text-muted transition hover:text-ink"
          }
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

/** Búsqueda, etiquetas (menú), pago y estado en una sola línea; debajo, los filtros activos. */
function BoardFilters({
  tags,
  searchQuery,
  onSearchQueryChange,
  filterTagIds,
  onFilterTagIdsChange,
  filterStatus,
  onFilterStatusChange,
}: {
  tags: Tag[];
  searchQuery: string;
  onSearchQueryChange: (query: string) => void;
  filterTagIds: number[];
  onFilterTagIdsChange: (tagIds: number[]) => void;
  filterStatus: StatusFilter;
  onFilterStatusChange: (status: StatusFilter) => void;
}) {
  const [tagMenuOpen, setTagMenuOpen] = useState(false);

  const paymentTags = tags.filter((tag) => tag.category === PAYMENT_CATEGORY);
  const menuTags = tags.filter((tag) => !HIDDEN_CATEGORIES.includes(tag.category || "General"));
  const menuCategories = Object.entries(
    menuTags.reduce<Record<string, Tag[]>>((groups, tag) => {
      const category = tag.category || "General";
      (groups[category] ??= []).push(tag);
      return groups;
    }, {}),
  );

  const selectedPaymentId =
    paymentTags.find((tag) => filterTagIds.includes(tag.id))?.id ?? 0;
  const selectedMenuCount = menuTags.filter((tag) => filterTagIds.includes(tag.id)).length;
  const selectedTags = tags.filter((tag) => filterTagIds.includes(tag.id));
  const hasFilters = searchQuery.trim() !== "" || filterTagIds.length > 0 || filterStatus !== "all";

  function toggleTag(tagId: number) {
    onFilterTagIdsChange(
      filterTagIds.includes(tagId)
        ? filterTagIds.filter((id) => id !== tagId)
        : [...filterTagIds, tagId],
    );
  }

  function selectPayment(tagId: number) {
    const withoutPayment = filterTagIds.filter(
      (id) => !paymentTags.some((tag) => tag.id === id),
    );
    onFilterTagIdsChange(tagId === 0 ? withoutPayment : [...withoutPayment, tagId]);
  }

  return (
    <div className="mb-4">
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={searchQuery}
          onChange={(event) => onSearchQueryChange(event.target.value)}
          placeholder="Search title or client…"
          className="min-w-48 flex-1 rounded-md border border-line-strong bg-paper px-3 py-2 text-sm"
        />

        {menuCategories.length > 0 && (
          <div className="relative">
            <button
              type="button"
              onClick={() => setTagMenuOpen((open) => !open)}
              className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-semibold transition ${
                selectedMenuCount > 0
                  ? "border-ink bg-surface text-ink"
                  : "border-line-strong bg-surface text-muted hover:text-ink"
              }`}
            >
              Tags
              {selectedMenuCount > 0 && (
                <span className="rounded-sm bg-primary px-1.5 text-[11px] font-bold text-on-primary">
                  {selectedMenuCount}
                </span>
              )}
              <span className="text-xs">▾</span>
            </button>

            {tagMenuOpen && (
              <>
                {/* Capa invisible: un clic fuera cierra el menú */}
                <div className="fixed inset-0 z-30" onClick={() => setTagMenuOpen(false)} />

                <div className="absolute left-0 top-full z-40 mt-1 max-h-80 w-64 overflow-y-auto rounded-md border border-line bg-surface p-2 shadow-lg">
                  {menuCategories.map(([category, categoryTags]) => (
                    <div key={category} className="mb-2 last:mb-0">
                      <p className="px-2 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-faint">
                        {category}
                      </p>

                      {categoryTags.map((tag) => (
                        <label
                          key={tag.id}
                          className="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-ink hover:bg-highlight"
                        >
                          <input
                            type="checkbox"
                            checked={filterTagIds.includes(tag.id)}
                            onChange={() => toggleTag(tag.id)}
                            className="accent-current"
                          />
                          <span
                            className="h-2.5 w-2.5 shrink-0 rounded-sm"
                            style={{ backgroundColor: tag.color }}
                          />
                          <span className="truncate">{tag.name}</span>
                        </label>
                      ))}
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {paymentTags.length > 0 && (
          <Segmented
            options={[
              { value: 0, label: "All" },
              ...paymentTags.map((tag) => ({ value: tag.id, label: tag.name })),
            ]}
            value={selectedPaymentId}
            onChange={selectPayment}
          />
        )}

        <Segmented<StatusFilter>
          options={[
            { value: "all", label: "All" },
            { value: "active", label: "Active" },
            { value: "overdue", label: "Overdue" },
          ]}
          value={filterStatus}
          onChange={onFilterStatusChange}
        />
      </div>

      {hasFilters && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {selectedTags.map((tag) => (
            <button
              key={tag.id}
              type="button"
              onClick={() => toggleTag(tag.id)}
              title="Remove filter"
              className="rounded-sm px-2 py-0.5 text-xs font-bold text-white transition hover:opacity-80"
              style={{ backgroundColor: tag.color }}
            >
              {tag.name} ×
            </button>
          ))}

          <button
            type="button"
            onClick={() => {
              onSearchQueryChange("");
              onFilterTagIdsChange([]);
              onFilterStatusChange("all");
            }}
            className="px-1 text-xs font-semibold text-muted underline-offset-2 hover:text-ink hover:underline"
          >
            Clear filters
          </button>
        </div>
      )}
    </div>
  );
}

export default BoardFilters;
