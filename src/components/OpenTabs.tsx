import type { Client, Commission, Tag } from "../lib/database";

function OpenTabs({
  openCommissionTabs,
  activeCommissionId,
  commissionTagsById,
  getPaymentTag,
  onSelectCommission,
  onCloseCommission,
  onShowAllCommissions,
  clients,
}: {
  openCommissionTabs: Commission[];
  activeCommissionId: number | null;
  commissionTagsById: Record<number, Tag[]>;
  getPaymentTag: (tags: Tag[]) => Tag | null;
  onSelectCommission: (commissionId: number) => void;
  onCloseCommission: (commissionId: number) => void;
  onShowAllCommissions: () => void;
  clients: Client[];
}) {
  return (
    <section className="border-b border-[#ded7cc] bg-white px-8 py-3">
      <div className="flex items-center gap-3 overflow-x-auto">
        <span className="mr-1 text-xs font-bold uppercase tracking-[0.18em] text-[#9a8f82]">
          Open
        </span>
        <button
          onClick={onShowAllCommissions}
          className={
            activeCommissionId === null
              ? "shrink-0 rounded-2xl border border-[#1f2933] bg-[#1f2933] px-4 py-2 text-sm font-bold text-white shadow-sm"
              : "shrink-0 rounded-2xl border border-[#e6ded2] bg-[#fffaf2] px-4 py-2 text-sm font-semibold text-[#1f2933] shadow-sm"
          }
        >
          All commissions
        </button>
        {openCommissionTabs.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[#d8cec0] px-4 py-2 text-sm text-[#9a8f82]">
            No commissions open
          </div>
        ) : (
          openCommissionTabs.map((commission) => {
            const client = clients.find((client) => client.id === commission.client_id) ?? null;
            const isActive = activeCommissionId === commission.id;
            const paymentTag = getPaymentTag(commissionTagsById[commission.id] ?? [],);

            return (
              <div
                key={commission.id}
                className={
                  isActive
                    ? "flex shrink-0 items-center gap-2 rounded-2xl border border-[#1f2933] bg-[#1f2933] px-4 py-2 text-sm font-bold text-white shadow-sm"
                    : "flex shrink-0 items-center gap-2 rounded-2xl border border-[#e6ded2] bg-[#fffaf2] px-4 py-2 text-sm font-semibold text-[#1f2933] shadow-sm"
                }
              >
                {client?.avatar_url && (
                  <img
                    src={client.avatar_url}
                    alt={client.name}
                    className="h-6 w-6 rounded-full object-cover"
                  />
                )}
                <button
                  onClick={() => onSelectCommission(commission.id)}
                  className="max-w-52 truncate"
                >
                  {commission.client_name || "No client"} · {commission.title}
                </button>

                {paymentTag && (
                  <span
                    className="rounded-full px-2 py-0.5 text-[10px] font-black text-white"
                    style={{ backgroundColor: paymentTag.color }}
                  >
                    {paymentTag.name}
                  </span>
                )}

                <button
                  onClick={() => onCloseCommission(commission.id)}
                  className={
                    isActive
                      ? "rounded-full px-2 text-white/70 hover:bg-white/10 hover:text-white"
                      : "rounded-full px-2 text-[#9a8f82] hover:bg-[#f1e8da] hover:text-[#1f2933]"
                  }
                >
                  ×
                </button>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}

export default OpenTabs;