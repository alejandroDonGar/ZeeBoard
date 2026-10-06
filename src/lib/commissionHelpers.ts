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
      label: `${Math.abs(daysLeft)} days overdue`,
      className: "bg-red-500 text-white",
    };
  }

  if (daysLeft === 0) {
    return {
      label: "Due today",
      className: "bg-red-500 text-white",
    };
  }

  if (daysLeft <= 7) {
    return {
      label: `${daysLeft} days left`,
      className: "bg-amber-100 text-amber-900",
    };
  }

  return {
    label: `${daysLeft} days left`,
    className: "bg-white text-[#7c7163]",
  };
}
export type PaymentStatus = "unpaid" | "partial" | "paid";

export type PaymentSummary = {
  /** Lo que han pagado los clientes */
  paid: number;
  /** Lo que te ha llegado, de los pagos donde ya lo apuntaste */
  received: number;
  /** Lo que se quedó la plataforma, de esos mismos pagos */
  fees: number;
  /** Lo que falta por cobrar del precio */
  remaining: number;
  /** Pagos de los que aún no apuntaste lo recibido */
  pendingReceived: number;
  status: PaymentStatus;
};

/** Redondea a céntimos sin el error de coma flotante (149,985 → 149,99, no 149,98) */
export const round2 = (value: number) => Math.round(Number((value * 100).toPrecision(12))) / 100;

/** Estado de pago de una comisión a partir de sus pagos: lo usan todas las pantallas. */
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
  unpaid: { label: "Unpaid", className: "bg-red-50 text-red-600" },
  partial: { label: "Partial", className: "bg-amber-100 text-amber-900" },
  paid: { label: "Paid", className: "bg-green-50 text-green-700" },
};

// ponytail: tu usuario fijo en el código (es el mismo en todas tus redes); pasarlo a Ajustes si alguna vez cambia
const ARTIST_HANDLE = "@AverageZebraBoy";

/** Texto corto para la factura: "Rendered, 2 characters (Ana, Beto) - @AverageZebraBoy". */
export function invoiceDescription(templateName: string | null, characterNames: string[]): string {
  const count = characterNames.length;
  const characters = count ? `${count} ${count === 1 ? "character" : "characters"} (${characterNames.join(", ")})` : "";
  const detail = [templateName, characters].filter(Boolean).join(", ");

  return detail ? `${detail} - ${ARTIST_HANDLE}` : ARTIST_HANDLE;
}

/** Full Colour a 160 con 2 personajes y rate 0.5: 160 + 50 % de 160 = 240 (el rate sale de Ajustes) */
export function calculateCommissionPrice(basePrice: number, characterCount: number, extraCharacterRate: number): number {
  const extraCharacters = Math.max(characterCount, 1) - 1;
  return round2(basePrice * (1 + extraCharacterRate * extraCharacters));
}

/** Lo que te llega de un pago tras la tarifa de la plataforma: importe − (importe × % + fijo) */
export function receivedAfterFees(amount: number, platform: { percent: number; fixed: number }): number {
  return round2(Math.max(amount - (amount * platform.percent) / 100 - platform.fixed, 0));
}

/** Lee un precio escrito a mano: acepta "186,84", "186.84" o "200". Vacío = sin precio. */
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

/** "200 EUR", "186,84 EUR": decimales solo cuando los hay, con el formato del sistema. */
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

/** Fecha local como "2026-10-06" (toISOString usaría UTC y puede salir un día corrido). */
export function isoDay(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

/** Las comisiones que aún no están terminadas (las que ocupan una plaza). */
export async function loadOpenCommissions(): Promise<Commission[]> {
  const commissions = await getCommissions();
  const templateIds = [...new Set(commissions.map((c) => c.template_id).filter((id): id is number => id !== null))];
  const stages = Object.fromEntries(
    await Promise.all(templateIds.map(async (id) => [id, await getTemplateStages(id)] as const)),
  );

  return commissions.filter((commission) => !isCommissionCompleted(commission, stages));
}
