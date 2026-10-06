// Comprobación rápida de pagos y precios: npx tsx scripts/check-payments.ts
import assert from "node:assert";
import { calculateCommissionPrice, paymentSummary } from "../src/lib/commissionHelpers";

// PayPal: el cliente paga 200, te llegan 186,84
let s = paymentSummary(200, [{ amount: 200, received: 186.84 }]);
assert.deepStrictEqual([s.status, s.paid, s.received, s.fees, s.remaining], ["paid", 200, 186.84, 13.16, 0]);

// Mitad por adelantado, lo recibido aún sin apuntar
s = paymentSummary(240, [{ amount: 120, received: null }]);
assert.deepStrictEqual([s.status, s.remaining, s.pendingReceived, s.fees], ["partial", 120, 1, 0]);

// Sin pagos
assert.strictEqual(paymentSummary(160, []).status, "unpaid");

// Decimales que en coma flotante no suman exacto
s = paymentSummary(0.3, [{ amount: 0.1, received: 0.1 }, { amount: 0.2, received: 0.2 }]);
assert.deepStrictEqual([s.status, s.paid, s.fees], ["paid", 0.3, 0]);

console.log("payments ok");

// Precio automático: base por el primer personaje, +50 % por cada extra
assert.strictEqual(calculateCommissionPrice(160, 1), 160);
assert.strictEqual(calculateCommissionPrice(160, 2), 240);
assert.strictEqual(calculateCommissionPrice(160, 3), 320);
assert.strictEqual(calculateCommissionPrice(160, 0), 160);
assert.strictEqual(calculateCommissionPrice(99.99, 2), 149.99);
console.log("prices ok");
