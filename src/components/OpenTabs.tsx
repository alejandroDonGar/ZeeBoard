import type { Client, Commission } from "../lib/database";
import { PAYMENT_STATUS_STYLE, type PaymentStatus } from "../lib/commissionHelpers";

function OpenTabs({
  openCommissionTabs,
  activeCommissionId,
  getPaymentStatus,
  onSelectCommission,
  onCloseCommission,
  onShowAllCommissions,
  clients,
}: {
  openCommissionTabs: Commission[];
  activeCommissionId: number | null;
  getPaymentStatus: (commission: Commission) => PaymentStatus;
  onSelectCommission: (commissionId: number) => void;
  onCloseCommission: (commissionId: number) => void;
  onShowAllCommissions: () => void;
  clients: Client[];
}) {
  return (
    <section className="border-b border-line bg-surface px-8 py-3">
      <div className="flex items-center gap-3 overflow-x-auto">
        <span className="mr-1 text-xs font-bold uppercase tracking-[0.18em] text-faint">
          Open
        </span>
        <button
          onClick={onShowAllCommissions}
          className={
            activeCommissionId === null
              ? "shrink-0 rounded-2xl border border-ink bg-primary px-4 py-2 text-sm font-bold text-on-primary shadow-sm"
              : "shrink-0 rounded-2xl border border-line bg-paper px-4 py-2 text-sm font-semibold text-ink shadow-sm"
          }
        >
          All commissions
        </button>
        {openCommissionTabs.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-line-strong px-4 py-2 text-sm text-faint">
            No commissions open
          </div>
        ) : (
          openCommissionTabs.map((commission) => {
            const client = clients.find((client) => client.id === commission.client_id) ?? null;
            const isActive = activeCommissionId === commission.id;
            const paymentStatus = PAYMENT_STATUS_STYLE[getPaymentStatus(commission)];

            return (
              <div
                key={commission.id}
                className={
                  isActive
                    ? "flex shrink-0 items-center gap-2 rounded-2xl border border-ink bg-primary px-4 py-2 text-sm font-bold text-on-primary shadow-sm"
                    : "flex shrink-0 items-center gap-2 rounded-2xl border border-line bg-paper px-4 py-2 text-sm font-semibold text-ink shadow-sm"
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

                <span className={`rounded-sm px-2 py-0.5 text-[10px] font-bold ${paymentStatus.className}`}>
                  {paymentStatus.label}
                </span>

                <button
                  onClick={() => onCloseCommission(commission.id)}
                  className={
                    isActive
                      ? "rounded-sm px-2 text-on-primary/70 hover:bg-on-primary/10 hover:text-on-primary"
                      : "rounded-sm px-2 text-faint hover:bg-highlight hover:text-ink"
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