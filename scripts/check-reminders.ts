// Comprobación rápida de los avisos de entrega y de comisiones paradas: npx tsx scripts/check-reminders.ts
import assert from "node:assert";
import { ageInDays, computeAttention } from "../src/lib/reminders";

const now = new Date(2026, 9, 6, 12); // 6 oct 2026
const at = (month: number, day: number) => new Date(2026, month - 1, day, 10).toISOString();
const base = { promise_max_days: 60, reminders_enabled: true, reminder_days_before: 3, stalled_enabled: true, stalled_days: 21 };
const commission = (id: number, created_at: string, deadline: string | null = null) => ({ id, title: `C${id}`, created_at, deadline });
const kinds = (items: ReturnType<typeof computeAttention>) => items.map((item) => `${item.commission.id}:${item.kind}:${item.days}`);

// Sin fecha, el límite es el día que la aceptaste + 60: 8 ago → 7 oct (queda 1), 7 ago → hoy, 6 ago → pasado 1, 1 oct → lejos
const recent = { 1: at(10, 4), 2: at(10, 4), 3: at(10, 4), 4: at(10, 4) };
const items = computeAttention(
  [commission(1, at(8, 8)), commission(2, at(8, 7)), commission(3, at(8, 6)), commission(4, at(10, 1))],
  recent,
  base,
  now,
);
assert.deepStrictEqual(kinds(items), ["3:overdue:1", "2:due-today:0", "1:due-soon:1"]);

// Con fecha de entrega manda esa, aunque el límite implícito ya hubiera pasado
assert.deepStrictEqual(kinds(computeAttention([commission(5, at(8, 1), "2026-10-20")], { 5: at(10, 4) }, base, now)), []);
assert.deepStrictEqual(kinds(computeAttention([commission(5, at(8, 1), "2026-10-08")], { 5: at(10, 4) }, base, now)), ["5:due-soon:2"]);

// Parada: 26 días sin cambios y aún lejos del límite
assert.deepStrictEqual(kinds(computeAttention([commission(6, at(9, 1))], { 6: at(9, 10) }, base, now)), ["6:stalled:26"]);
// Con un movimiento reciente, no
assert.deepStrictEqual(kinds(computeAttention([commission(6, at(9, 1))], { 6: at(10, 3) }, base, now)), []);

// Interruptores
assert.deepStrictEqual(kinds(computeAttention([commission(3, at(8, 6))], recent, { ...base, reminders_enabled: false }, now)), []);
assert.deepStrictEqual(kinds(computeAttention([commission(6, at(9, 1))], { 6: at(9, 10) }, { ...base, stalled_enabled: false }, now)), []);

// La clave no cambia de un día para otro mientras la situación sea la misma (se avisa una sola vez)
const tomorrow = new Date(2026, 9, 7, 12);
const [a] = computeAttention([commission(3, at(8, 6))], recent, base, now);
const [b] = computeAttention([commission(3, at(8, 6))], recent, base, tomorrow);
assert.strictEqual(a.key, b.key);
assert.strictEqual(b.days, 2);

// Edad: 8 ago → 6 oct = 59 días
assert.strictEqual(ageInDays(commission(1, at(8, 8)), now), 59);

// Pasó del boceto sin cobrar: avisa una vez (clave fija), y se apaga con los avisos de entrega
const unpaid = new Set([3]);
assert.deepStrictEqual(kinds(computeAttention([commission(3, at(10, 1))], { 3: at(10, 3) }, base, now, unpaid)), ["3:payment:0"]);
assert.deepStrictEqual(kinds(computeAttention([commission(4, at(10, 1))], { 4: at(10, 3) }, base, now, unpaid)), []);
assert.deepStrictEqual(kinds(computeAttention([commission(3, at(10, 1))], { 3: at(10, 3) }, { ...base, reminders_enabled: false }, now, unpaid)), []);

console.log("reminders ok");
