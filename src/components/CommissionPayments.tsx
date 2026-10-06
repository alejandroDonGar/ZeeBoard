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
  const [open, setOpen] = useState(false);

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
    <div className="relative shrink-0">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1 rounded-md border border-line bg-paper px-3 py-2 text-sm">
        <span className={`rounded-sm px-2 py-0.5 text-xs font-bold ${status.className}`}>{status.label}</span>
        <span>
          <span className="text-faint">Price </span>
          <b>{commission.price !== null ? formatMoney(commission.price, currency) : "—"}</b>
        </span>
        <span>
          <span className="text-faint">Client paid </span>
          <b>{formatMoney(summary.paid, currency)}</b>
          {summary.remaining > 0 && <span className="text-faint"> · {formatMoney(summary.remaining, currency)} left</span>}
        </span>
        <span>
          <span className="text-faint">Received </span>
          <b className="text-green-700">{formatMoney(summary.received, currency)}</b>
          {summary.pendingReceived > 0 && <span className="text-faint"> · {summary.pendingReceived} not entered</span>}
        </span>
        {summary.fees > 0 && <span className="text-faint">Fees {formatMoney(summary.fees, currency)}</span>}

        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className="ml-auto rounded-md border border-line-strong bg-surface px-2.5 py-1 text-xs font-semibold text-ink transition hover:border-ink"
        >
          Payments{payments.length > 0 ? ` · ${payments.length}` : ""} {open ? "▴" : "▾"}
        </button>
      </div>

      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full z-40 mt-1 w-[440px] rounded-md border border-line bg-surface p-3 shadow-lg">
            <div className="divide-y divide-line border-y border-line text-sm">
            <div className="grid grid-cols-[minmax(0,1.1fr)_1fr_1fr_24px] gap-2 py-1.5 text-[11px] text-faint">
              <span>Date</span>
              <span>Client paid</span>
              <span>You received</span>
              <span />
            </div>

            {payments.map((payment) => (
              <div key={payment.id} className="group grid grid-cols-[minmax(0,1.1fr)_1fr_1fr_24px] items-center gap-x-2 py-1.5">
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

                <button
                  type="button"
                  title="Remove payment"
                  onClick={() => run(() => deletePayment(payment.id))}
                  className="rounded-sm text-faint opacity-0 transition hover:bg-red-50 hover:text-red-500 group-hover:opacity-100"
                >
                  ×
                </button>

                {payment.note && <span className="col-span-full truncate text-xs text-muted">{payment.note}</span>}
              </div>
            ))}

            <div
              className="grid grid-cols-[minmax(0,1.1fr)_1fr_1fr_24px] items-center gap-2 py-1.5"
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
              <button
                type="button"
                title="Add payment"
                onClick={handleAdd}
                className="h-full rounded-sm bg-primary text-on-primary transition hover:bg-primary-hover"
              >
                +
              </button>

              <input
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder="Note: PayPal, deposit…"
                className={`${field} col-span-full`}
              />
            </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default CommissionPayments;
