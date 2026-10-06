import { useState } from "react";
import {
  addPayment,
  deletePayment,
  updatePaymentReceived,
  type Commission,
  type CommissionPayment,
} from "../lib/database";
import { formatMoney, parsePrice, paymentSummary, PAYMENT_STATUS_STYLE } from "../lib/commissionHelpers";
import { useToast } from "../context/ToastContext";

const today = () => new Date().toISOString().slice(0, 10);
const dateFormatter = new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short", year: "numeric" });

/** Bloque de pagos del detalle: precio, lo pagado, lo recibido y la comisión de la plataforma. */
function CommissionPayments({
  commission,
  payments,
  onChange,
}: {
  commission: Commission;
  payments: CommissionPayment[];
  onChange: () => Promise<void>;
}) {
  const summary = paymentSummary(commission.price, payments);
  const currency = commission.currency;
  const { showToast } = useToast();

  // Lo que pagó el cliente se rellena con lo que falta por cobrar
  const [amount, setAmount] = useState("");
  const [received, setReceived] = useState("");
  const [paidAt, setPaidAt] = useState(today);
  const [note, setNote] = useState("");

  async function run(action: () => Promise<void>) {
    try {
      await action();
      await onChange();
    } catch (error) {
      console.error(error);
      showToast(error instanceof Error ? error.message : `Payment error: ${error}`, "error");
    }
  }

  function handleAdd() {
    run(async () => {
      const clientPaid = parsePrice(amount === "" ? String(summary.remaining) : amount);

      if (!clientPaid) {
        throw new Error("Enter what the client paid");
      }

      await addPayment(commission.id, clientPaid, parsePrice(received), paidAt, note);
      setAmount("");
      setReceived("");
      setNote("");
      setPaidAt(today());
    });
  }

  const status = PAYMENT_STATUS_STYLE[summary.status];
  const field = "min-w-0 rounded-md border border-line-strong bg-surface px-2 py-1.5 text-sm outline-none focus:border-ink";

  return (
    <div className="rounded-3xl border border-line bg-surface p-5">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-[11px] font-black uppercase tracking-[0.16em] text-faint">Payment</p>
        <span className={`rounded-sm px-2 py-0.5 text-xs font-bold ${status.className}`}>{status.label}</span>
      </div>

      <dl className="grid grid-cols-4 gap-3">
        {[
          { label: "Price", value: commission.price !== null ? formatMoney(commission.price, currency) : "—" },
          {
            label: "Client paid",
            value: formatMoney(summary.paid, currency),
            detail: summary.remaining > 0 ? `${formatMoney(summary.remaining, currency)} left` : undefined,
          },
          {
            label: "You received",
            value: formatMoney(summary.received, currency),
            detail: summary.pendingReceived > 0 ? `${summary.pendingReceived} not entered yet` : undefined,
            className: "text-green-700",
          },
          { label: "Platform fees", value: formatMoney(summary.fees, currency), className: "text-faint" },
        ].map((item) => (
          <div key={item.label}>
            <dt className="text-[11px] text-faint">{item.label}</dt>
            <dd className={`text-lg font-black ${item.className ?? ""}`}>{item.value}</dd>
            {item.detail && <dd className="text-[11px] text-muted">{item.detail}</dd>}
          </div>
        ))}
      </dl>

      <div className="mt-4 divide-y divide-line border-y border-line text-sm">
        <div className="grid grid-cols-[110px_1fr_1fr_1.4fr_28px] gap-2 py-1.5 text-[11px] text-faint">
          <span>Date</span>
          <span>Client paid</span>
          <span>You received</span>
          <span>Note</span>
          <span />
        </div>

        {payments.map((payment) => (
          <div key={payment.id} className="group grid grid-cols-[110px_1fr_1fr_1.4fr_28px] items-center gap-2 py-1.5">
            <span>{dateFormatter.format(new Date(`${payment.paid_at}T00:00:00`))}</span>
            <span className="font-semibold">{formatMoney(payment.amount, currency)}</span>

            {/* Lo recibido se apunta cuando llega: Enter o al salir del campo */}
            <input
              defaultValue={payment.received !== null ? String(payment.received).replace(".", ",") : ""}
              placeholder="Not yet"
              inputMode="decimal"
              onBlur={(event) => {
                if (event.target.value !== (payment.received !== null ? String(payment.received).replace(".", ",") : "")) {
                  run(() => updatePaymentReceived(payment.id, parsePrice(event.target.value)));
                }
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") event.currentTarget.blur();
              }}
              className={`${field} border-transparent bg-transparent hover:border-line`}
            />

            <span className="truncate text-muted">{payment.note}</span>

            <button
              type="button"
              title="Remove payment"
              onClick={() => run(() => deletePayment(payment.id))}
              className="rounded-sm text-faint opacity-0 transition hover:bg-red-50 hover:text-red-500 group-hover:opacity-100"
            >
              ×
            </button>
          </div>
        ))}

        <div
          className="grid grid-cols-[110px_1fr_1fr_1.4fr_28px] items-center gap-2 py-1.5"
          onKeyDown={(event) => {
            if (event.key === "Enter") handleAdd();
          }}
        >
          <input type="date" value={paidAt} onChange={(event) => setPaidAt(event.target.value)} className={field} />
          <input
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            placeholder={summary.remaining > 0 ? String(summary.remaining).replace(".", ",") : "0"}
            inputMode="decimal"
            className={field}
          />
          <input
            value={received}
            onChange={(event) => setReceived(event.target.value)}
            placeholder="Later"
            inputMode="decimal"
            className={field}
          />
          <input
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="PayPal, deposit…"
            className={field}
          />
          <button
            type="button"
            title="Add payment"
            onClick={handleAdd}
            className="rounded-sm bg-primary text-on-primary transition hover:bg-primary-hover"
          >
            +
          </button>
        </div>
      </div>
    </div>
  );
}

export default CommissionPayments;
