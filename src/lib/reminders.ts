import { sendNotification } from "@tauri-apps/plugin-notification";
import { isCommissionCompleted, isoDay } from "./commissionHelpers";
import {
  appSettings,
  getCommissions,
  getDatabase,
  getTemplateStages,
  type AppSettings,
  type Commission,
} from "./database";

const DAY = 24 * 60 * 60 * 1000;

export type AttentionKind = "overdue" | "due-today" | "due-soon" | "stalled";

export type Attention<T> = {
  commission: T;
  kind: AttentionKind;
  /** overdue: días de retraso · due-soon: días que faltan · stalled: días sin cambios */
  days: number;
  /** Cambia cuando cambia la situación: así se avisa una sola vez por cada aviso */
  key: string;
  text: string;
};

type Reminderable = { id: number; title: string; deadline: string | null; created_at: string };
type Options = Pick<
  AppSettings,
  "promise_max_days" | "reminders_enabled" | "reminder_days_before" | "stalled_enabled" | "stalled_days"
>;

const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());

/**
 * Cuántos días faltan para el límite de una comisión (negativo = pasado).
 * Con fecha de entrega manda esa; sin ella, el límite es el día que la aceptaste + lo máximo que prometes.
 */
export function daysToDeadline(commission: Reminderable, promiseMaxDays: number, now: Date) {
  const created = new Date(commission.created_at);
  const implicit = !commission.deadline;
  const deadline = commission.deadline
    ? new Date(`${commission.deadline}T00:00:00`)
    : new Date(created.getFullYear(), created.getMonth(), created.getDate() + promiseMaxDays);

  return { daysLeft: Math.round((deadline.getTime() - startOfDay(now).getTime()) / DAY), implicit, deadline };
}

/** Días desde que aceptaste la comisión. */
export function ageInDays(commission: Reminderable, now: Date): number {
  return Math.max(0, Math.round((startOfDay(now).getTime() - startOfDay(new Date(commission.created_at)).getTime()) / DAY));
}

export const ATTENTION_STYLE: Record<AttentionKind, { label: string; className: string }> = {
  overdue: { label: "Overdue", className: "bg-red-50 text-red-600" },
  "due-today": { label: "Today", className: "bg-red-50 text-red-600" },
  "due-soon": { label: "Soon", className: "bg-amber-100 text-amber-900" },
  stalled: { label: "Stalled", className: "bg-highlight text-muted" },
};

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? "" : "s"}`;

/** Qué comisiones piden atención hoy: entrega que se acerca o pasada, y comisiones paradas. */
export function computeAttention<T extends Reminderable>(
  commissions: T[],
  lastActivity: Record<number, string>,
  options: Options,
  now: Date,
): Attention<T>[] {
  const items: Attention<T>[] = [];

  for (const commission of commissions) {
    const { daysLeft, implicit, deadline } = daysToDeadline(commission, options.promise_max_days, now);
    const limit = implicit ? "your promised time" : "its deadline";
    const deadlineKey = `${commission.id}:${isoDay(deadline)}`;

    if (options.reminders_enabled && daysLeft < 0) {
      items.push({
        commission,
        kind: "overdue",
        days: -daysLeft,
        key: `${deadlineKey}:overdue`,
        text: `${commission.title} is ${plural(-daysLeft, "day")} past ${limit}`,
      });
    } else if (options.reminders_enabled && daysLeft === 0) {
      items.push({
        commission,
        kind: "due-today",
        days: 0,
        key: `${deadlineKey}:today`,
        text: `${commission.title} reaches ${limit} today`,
      });
    } else if (options.reminders_enabled && daysLeft <= options.reminder_days_before) {
      items.push({
        commission,
        kind: "due-soon",
        days: daysLeft,
        key: `${deadlineKey}:soon`,
        text: `${commission.title} reaches ${limit} in ${plural(daysLeft, "day")}`,
      });
    } else if (options.stalled_enabled) {
      const last = new Date(lastActivity[commission.id] ?? commission.created_at);
      const idle = Math.round((startOfDay(now).getTime() - startOfDay(last).getTime()) / DAY);

      if (idle >= options.stalled_days) {
        items.push({
          commission,
          kind: "stalled",
          days: idle,
          key: `${commission.id}:${isoDay(last)}:stalled`,
          text: `${commission.title} hasn't changed in ${plural(idle, "day")}`,
        });
      }
    }
  }

  const order: Record<AttentionKind, number> = { overdue: 0, "due-today": 1, "due-soon": 2, stalled: 3 };

  return items.sort((a, b) => order[a.kind] - order[b.kind] || b.days - a.days);
}

/** Lee la base de datos y devuelve lo que pide atención ahora mismo. */
export async function loadAttention(now = new Date()): Promise<Attention<Commission>[]> {
  const commissions = await getCommissions();
  const templateIds = [...new Set(commissions.map((c) => c.template_id).filter((id): id is number => id !== null))];
  const stages = Object.fromEntries(
    await Promise.all(templateIds.map(async (id) => [id, await getTemplateStages(id)] as const)),
  );

  const open = commissions.filter((commission) => !isCommissionCompleted(commission, stages));

  // Movimiento = imagen nueva, corrección, pago o cambio de etapa (las fechas ISO ordenan como texto)
  const database = await getDatabase();
  const rows = await database.select<{ id: number; last_activity: string }[]>(`
    SELECT c.id,
      MAX(
        c.created_at,
        COALESCE(c.stage_changed_at, ''),
        COALESCE((SELECT MAX(created_at) FROM commission_stage_images WHERE commission_id = c.id), ''),
        COALESCE((SELECT MAX(created_at) FROM commission_corrections WHERE commission_id = c.id), ''),
        COALESCE((SELECT MAX(paid_at) FROM commission_payments WHERE commission_id = c.id), '')
      ) AS last_activity
    FROM commissions c;
  `);

  return computeAttention(open, Object.fromEntries(rows.map((row) => [row.id, row.last_activity])), appSettings(), now);
}

const NOTIFIED_KEY = "zeeboard-notified-reminders";

/** Manda una notificación de Windows por cada aviso que aún no se ha enviado. Devuelve cuántas. */
export function notifyNew(items: Attention<Commission>[]): number {
  let notified: string[] = [];

  try {
    notified = JSON.parse(localStorage.getItem(NOTIFIED_KEY) ?? "[]");
  } catch {
    // Sin historial se vuelve a avisar: mejor repetir que perder un aviso
  }

  const fresh = items.filter((item) => !notified.includes(item.key));

  if (fresh.length === 0) {
    return 0;
  }

  // Muchos a la vez (primer arranque, o tras varios días sin abrir): uno solo con el resumen
  if (fresh.length > 3) {
    sendNotification({ title: "ZeeBoard", body: `${fresh.length} commissions need your attention` });
  } else {
    fresh.forEach((item) => sendNotification({ title: "ZeeBoard", body: item.text }));
  }

  try {
    localStorage.setItem(NOTIFIED_KEY, JSON.stringify([...notified, ...fresh.map((item) => item.key)].slice(-500)));
  } catch {
    // Igual que arriba
  }

  return fresh.length;
}
