// Numbers for the Statistics screen. Pure: the page loads the data and only paints what comes out of here.
import {
  deliveryDay,
  isCommissionCompleted,
  isoDay,
  netIncome,
  paymentSummary,
  ratePerHour,
  round2,
} from "./commissionHelpers";
import type { Commission, CommissionPayment, TemplateStage } from "./database";

export type Period = "year" | "12m" | "all";

/** Inclusive days, YYYY-MM-DD */
export type Range = { from: string; to: string };

export type Summary = { received: number; pieces: number; avgPerPiece: number | null; rate: number | null };

export type TemplateRow = {
  name: string;
  pieces: number;
  net: number;
  avgNet: number;
  avgHours: number | null;
  rate: number | null;
};

export type Stats = {
  /** Commissions left out because they are in another currency (they are never added together) */
  excluded: number;
  current: Summary;
  /** The same length of time right before; null for "all" */
  previous: Summary | null;
  /** 12 months of cash received: the year for "year", the last 12 months otherwise */
  months: { key: string; total: number }[];
  byTemplate: TemplateRow[];
};

export function periodRanges(period: Period, now: Date): { current: Range; previous: Range | null } {
  if (period === "all") {
    return { current: { from: "0000-01-01", to: "9999-12-31" }, previous: null };
  }

  const year = now.getFullYear();

  if (period === "year") {
    return {
      current: { from: `${year}-01-01`, to: `${year}-12-31` },
      previous: { from: `${year - 1}-01-01`, to: `${year - 1}-12-31` },
    };
  }

  // Last 12 months, today included
  const from = new Date(year - 1, now.getMonth(), now.getDate() + 1);
  const previousFrom = new Date(year - 2, now.getMonth(), now.getDate() + 1);

  return {
    current: { from: isoDay(from), to: isoDay(now) },
    previous: { from: isoDay(previousFrom), to: isoDay(new Date(from.getTime() - 86400000)) },
  };
}

const inRange = (day: string, range: Range) => day >= range.from && day <= range.to;

/** What one payment brought in: the net where it is entered, else what the client paid */
const paymentNet = (payment: CommissionPayment) => payment.received ?? payment.amount;

export function computeStats(
  input: {
    commissions: Commission[];
    payments: CommissionPayment[];
    templates: { id: number; name: string }[];
    stages: Record<number, TemplateStage[]>;
    /** Default currency: commissions without one count as this */
    currency: string;
    now: Date;
  },
  period: Period,
): Stats {
  const { current, previous } = periodRanges(period, input.now);

  const included = input.commissions.filter((commission) => (commission.currency ?? input.currency) === input.currency);
  const includedIds = new Set(included.map((commission) => commission.id));
  const payments = input.payments.filter((payment) => includedIds.has(payment.commission_id));

  const piecesIn = (range: Range) =>
    included
      .filter((commission) => isCommissionCompleted(commission, input.stages) && inRange(deliveryDay(commission), range))
      .map((commission) => ({
        commission,
        net: netIncome(paymentSummary(commission.price, payments.filter((payment) => payment.commission_id === commission.id))),
      }));

  const summary = (range: Range): Summary => {
    const pieces = piecesIn(range);
    const total = round2(pieces.reduce((sum, piece) => sum + piece.net, 0));

    return {
      received: round2(payments.filter((payment) => inRange(payment.paid_at, range)).reduce((sum, payment) => sum + paymentNet(payment), 0)),
      pieces: pieces.length,
      avgPerPiece: pieces.length > 0 ? round2(total / pieces.length) : null,
      rate: ratePerHour(pieces.map((piece) => ({ net: piece.net, hours: piece.commission.hours }))),
    };
  };

  // 12 month buckets
  const start = period === "year" ? new Date(input.now.getFullYear(), 0, 1) : new Date(input.now.getFullYear(), input.now.getMonth() - 11, 1);
  const months = Array.from({ length: 12 }, (_, index) => {
    const month = new Date(start.getFullYear(), start.getMonth() + index, 1);
    const key = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, "0")}`;

    return {
      key,
      total: round2(payments.filter((payment) => payment.paid_at.startsWith(key)).reduce((sum, payment) => sum + paymentNet(payment), 0)),
    };
  });

  const byTemplate = new Map<string, { net: number; hours: number[]; entries: { net: number; hours: number | null }[] }>();

  for (const { commission, net } of piecesIn(current)) {
    const name = input.templates.find((template) => template.id === commission.template_id)?.name ?? "";
    const row = byTemplate.get(name) ?? { net: 0, hours: [], entries: [] };

    row.net += net;
    row.entries.push({ net, hours: commission.hours });
    if (commission.hours !== null && commission.hours > 0) row.hours.push(commission.hours);
    byTemplate.set(name, row);
  }

  return {
    excluded: input.commissions.length - included.length,
    current: summary(current),
    previous: previous ? summary(previous) : null,
    months,
    byTemplate: [...byTemplate.entries()]
      .map(([name, row]) => ({
        name,
        pieces: row.entries.length,
        net: round2(row.net),
        avgNet: round2(row.net / row.entries.length),
        avgHours: row.hours.length > 0 ? round2(row.hours.reduce((sum, hours) => sum + hours, 0) / row.hours.length) : null,
        rate: ratePerHour(row.entries),
      }))
      .sort((a, b) => b.net - a.net),
  };
}

/** "+12 %" / "-5 %" against the previous period; null when there is nothing to compare */
export function changePercent(now: number | null, before: number | null): number | null {
  return now !== null && before !== null && before > 0 ? Math.round(((now - before) / before) * 100) : null;
}
