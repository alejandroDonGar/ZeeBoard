import { t } from "./i18n";
import { isPrivate } from "./privacy";
import {
  getCommissions,
  getTemplateStages,
  getCommissionStageImages,
  type Commission,
  type CommissionStageImage,
  type TemplateStage,
} from "./database";

export async function loadStageImagesForCommissions(
  data: Commission[],
): Promise<Record<number, CommissionStageImage[]>> {
  const entries = await Promise.all(
    data.map(async (commission) => {
      const images = await getCommissionStageImages(commission.id);
      return [commission.id, images] as const;
    }),
  );

  return Object.fromEntries(entries);
}

export function getCommissionCompletionPercentage(
  commission: Commission,
  templateStagesByTemplateId: Record<number, TemplateStage[]>,
): number {
  if (!commission.template_id || !commission.current_stage_id) {
    return 0;
  }

  const stages = templateStagesByTemplateId[commission.template_id] ?? [];

  if (stages.length === 0) {
    return 0;
  }

  const stageIndex = stages.findIndex(
    (stage) => stage.id === commission.current_stage_id,
  );

  if (stageIndex === -1) {
    return 0;
  }

  return Math.round(((stageIndex + 1) / stages.length) * 100);
}

export function isCommissionCompleted(
  commission: Commission,
  templateStagesByTemplateId: Record<number, TemplateStage[]>,
): boolean {
  return (
    getCommissionCompletionPercentage(commission, templateStagesByTemplateId) === 100
  );
}

export function getDeadlineStatus(deadline: string | null) {
  if (!deadline) {
    return null;
  }

  const deadlineDate = new Date(`${deadline}T00:00:00`);

  if (Number.isNaN(deadlineDate.getTime())) {
    return null;
  }

  const todayDate = new Date();
  todayDate.setHours(0, 0, 0, 0);

  const daysLeft = Math.round(
    (deadlineDate.getTime() - todayDate.getTime()) / (1000 * 60 * 60 * 24),
  );

  if (daysLeft < 0) {
    return {
      label: t(daysLeft === -1 ? "{n} day overdue" : "{n} days overdue", { n: Math.abs(daysLeft) }),
      short: t("{n}d late", { n: Math.abs(daysLeft) }),
      className: "bg-red-500 text-white",
    };
  }

  if (daysLeft === 0) {
    return {
      label: t("Due today"),
      short: t("Due today"),
      className: "bg-red-500 text-white",
    };
  }

  if (daysLeft <= 7) {
    return {
      label: t(daysLeft === 1 ? "{n} day left" : "{n} days left", { n: daysLeft }),
      short: t("{n}d", { n: daysLeft }),
      className: "bg-amber-100 text-amber-900",
    };
  }

  return {
    label: t("{n} days left", { n: daysLeft }),
    short: t("{n}d", { n: daysLeft }),
    className: "bg-white text-[#7c7163]",
  };
}
export type PaymentStatus = "unpaid" | "partial" | "paid";

export type PaymentSummary = {
  /** What clients have paid */
  paid: number;
  /** What reached you, from payments where you entered it */
  received: number;
  /** What the platform kept, from those same payments */
  fees: number;
  /** What's left to collect of the price */
  remaining: number;
  /** Payments whose received amount isn't entered yet */
  pendingReceived: number;
  status: PaymentStatus;
};

/** Rounds to cents without floating-point error (149.985 → 149.99, not 149.98) */
export const round2 = (value: number) => Math.round(Number((value * 100).toPrecision(12))) / 100;

/** Payment status of a commission from its payments: used by every screen. */
export function paymentSummary(
  price: number | null,
  payments: { amount: number; received: number | null }[],
): PaymentSummary {
  const paid = round2(payments.reduce((sum, payment) => sum + payment.amount, 0));
  const withReceived = payments.filter((payment) => payment.received !== null);
  const received = round2(withReceived.reduce((sum, payment) => sum + (payment.received ?? 0), 0));
  const fees = round2(withReceived.reduce((sum, payment) => sum + payment.amount, 0) - received);
  const remaining = round2(Math.max((price ?? 0) - paid, 0));

  const status: PaymentStatus =
    paid > 0 && (price === null || remaining === 0) ? "paid" : paid > 0 ? "partial" : "unpaid";

  return { paid, received, fees, remaining, pendingReceived: payments.length - withReceived.length, status };
}

export const PAYMENT_STATUS_STYLE: Record<PaymentStatus, { label: string; className: string }> = {
  unpaid: { label: t("Unpaid"), className: "bg-red-50 text-red-600" },
  partial: { label: t("Partial"), className: "bg-amber-100 text-amber-900" },
  paid: { label: t("Paid"), className: "bg-green-50 text-green-700" },
};

// ponytail: your handle is hardcoded (same on all your networks); move to Settings if it ever changes
const ARTIST_HANDLE = "@AverageZebraBoy";

/** Short invoice text: "Rendered, 2 characters (Ana, Beto) - @AverageZebraBoy". */
export function invoiceDescription(templateName: string | null, characterNames: string[]): string {
  const count = characterNames.length;
  const characters = count ? `${count} ${count === 1 ? "character" : "characters"} (${characterNames.join(", ")})` : "";
  const detail = [templateName, characters].filter(Boolean).join(", ");

  return detail ? `${detail} - ${ARTIST_HANDLE}` : ARTIST_HANDLE;
}

/** Full Colour at 160 with 2 characters and rate 0.5: 160 + 50% of 160 = 240 (rate comes from Settings) */
export function calculateCommissionPrice(basePrice: number, characterCount: number, extraCharacterRate: number): number {
  const extraCharacters = Math.max(characterCount, 1) - 1;
  return round2(basePrice * (1 + extraCharacterRate * extraCharacters));
}

/** What a payment nets after the platform fee: amount − (amount × % + fixed) */
export function receivedAfterFees(amount: number, platform: { percent: number; fixed: number }): number {
  return round2(Math.max(amount - (amount * platform.percent) / 100 - platform.fixed, 0));
}

/** Parses a typed price: accepts "186,84", "186.84" or "200". Empty = no price. */
export function parsePrice(text: string): number | null {
  const clean = text.trim().replace(/\s/g, "").replace(",", ".");

  if (clean === "") {
    return null;
  }

  const value = Number(clean);

  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`"${text}" isn't a valid price. Use numbers like 186,84`);
  }

  return round2(value);
}

/** "200 EUR", "186,84 EUR": decimals only when present, in the system format. */
export function formatMoney(amount: number, currency?: string | null): string {
  if (isPrivate()) {
    return "•••";
  }

  const rounded = round2(amount);
  const decimals = Number.isInteger(rounded) ? 0 : 2;

  return `${rounded.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })} ${currency || "EUR"}`;
}

/** Local date as "2026-10-06" (toISOString uses UTC and can be off by a day). */
export function isoDay(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

/** Commissions not finished yet (the ones that take a slot). */
export async function loadOpenCommissions(): Promise<Commission[]> {
  const commissions = await getCommissions();
  const templateIds = [...new Set(commissions.map((c) => c.template_id).filter((id): id is number => id !== null))];
  const stages = Object.fromEntries(
    await Promise.all(templateIds.map(async (id) => [id, await getTemplateStages(id)] as const)),
  );

  return commissions.filter((commission) => !isCommissionCompleted(commission, stages));
}
