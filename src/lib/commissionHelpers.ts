import {
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
/** "paid" / "unpaid" según las etiquetas de pago Paid y Not Paid (por nombre exacto, no "contiene"). */
export function getPaymentStatus(tags: { category: string; name: string }[]): "paid" | "unpaid" | null {
  const names = tags
    .filter((tag) => tag.category === "Payment")
    .map((tag) => tag.name.trim().toLowerCase());

  if (names.includes("not paid")) return "unpaid";
  if (names.includes("paid")) return "paid";
  return null;
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

  return Math.round(value * 100) / 100;
}

/** "200 EUR", "186,84 EUR": decimales solo cuando los hay, con el formato del sistema. */
export function formatMoney(amount: number, currency?: string | null): string {
  const rounded = Math.round(amount * 100) / 100;
  const decimals = Number.isInteger(rounded) ? 0 : 2;

  return `${rounded.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })} ${currency || "EUR"}`;
}
