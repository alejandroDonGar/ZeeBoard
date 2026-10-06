import { sendNotification } from "@tauri-apps/plugin-notification";
import { t } from "./i18n";
import { isoDay, loadOpenCommissions } from "./commissionHelpers";
import {
  appSettings,
  getDatabase,
  type AppSettings,
  type Commission,
} from "./database";

const DAY = 24 * 60 * 60 * 1000;

export type AttentionKind = "overdue" | "due-today" | "payment" | "due-soon" | "stalled";

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
  payment: { label: "Unpaid", className: "bg-amber-100 text-amber-900" },
  stalled: { label: "Stalled", className: "bg-highlight text-muted" },
};

const days = (count: number) => t(count === 1 ? "{n} day" : "{n} days", { n: count });

/**
 * Qué comisiones piden atención hoy: entrega que se acerca o pasada, comisiones paradas y las que ya
 * pasaron del boceto sin cobrar nada (`unpaidPastSketch`).
 */
export function computeAttention<T extends Reminderable>(
  commissions: T[],
  lastActivity: Record<number, string>,
  options: Options,
  now: Date,
  unpaidPastSketch: Set<number> = new Set(),
): Attention<T>[] {
  const items: Attention<T>[] = [];

  for (const commission of commissions) {
    if (options.reminders_enabled && unpaidPastSketch.has(commission.id)) {
      items.push({
        commission,
        kind: "payment",
        days: 0,
        key: `${commission.id}:payment`,
        text: t("{title} is past the sketch and still unpaid", { title: commission.title }),
      });
    }

    const { daysLeft, implicit, deadline } = daysToDeadline(commission, options.promise_max_days, now);
    const limit = implicit ? t("your promised time") : t("its deadline");
    const deadlineKey = `${commission.id}:${isoDay(deadline)}`;

    if (options.reminders_enabled && daysLeft < 0) {
      items.push({
        commission,
        kind: "overdue",
        days: -daysLeft,
        key: `${deadlineKey}:overdue`,
        text: t("{title} is {days} past {limit}", { title: commission.title, days: days(-daysLeft), limit }),
      });
    } else if (options.reminders_enabled && daysLeft === 0) {
      items.push({
        commission,
        kind: "due-today",
        days: 0,
        key: `${deadlineKey}:today`,
        text: t("{title} reaches {limit} today", { title: commission.title, limit }),
      });
    } else if (options.reminders_enabled && daysLeft <= options.reminder_days_before) {
      items.push({
        commission,
        kind: "due-soon",
        days: daysLeft,
        key: `${deadlineKey}:soon`,
        text: t("{title} reaches {limit} in {days}", { title: commission.title, limit, days: days(daysLeft) }),
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
          text: t("{title} hasn't changed in {days}", { title: commission.title, days: days(idle) }),
        });
      }
    }
  }

  const order: Record<AttentionKind, number> = { overdue: 0, "due-today": 1, payment: 2, "due-soon": 3, stalled: 4 };

  return items.sort((a, b) => order[a.kind] - order[b.kind] || b.days - a.days);
}

/** Lee la base de datos y devuelve lo que pide atención ahora mismo. */
export async function loadAttention(now = new Date()): Promise<Attention<Commission>[]> {
  const open = await loadOpenCommissions();

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

  // ponytail: "boceto aprobado" = la comisión ya salió de la primera etapa de su plantilla; "sin cobrar" = ningún pago
  // (con adelanto no avisa). Cambiarlo aquí si usas una etapa concreta como señal.
  const unpaid = await database.select<{ id: number }[]>(`
    SELECT c.id FROM commissions c
    JOIN template_stages s ON s.id = c.current_stage_id
    WHERE c.price > 0
      AND s.stage_order > (SELECT MIN(stage_order) FROM template_stages WHERE template_id = c.template_id)
      AND NOT EXISTS (SELECT 1 FROM commission_payments WHERE commission_id = c.id);
  `);

  return computeAttention(
    open,
    Object.fromEntries(rows.map((row) => [row.id, row.last_activity])),
    appSettings(),
    now,
    new Set(unpaid.map((row) => row.id)),
  );
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
    sendNotification({ title: "ZeeBoard", body: t("{n} commissions need your attention", { n: fresh.length }) });
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
