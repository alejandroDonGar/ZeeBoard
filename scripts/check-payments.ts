// Quick check of payments and prices: npx tsx scripts/check-payments.ts
import assert from "node:assert";
import { calculateCommissionPrice, formatMoney, invoiceDescription, paymentSummary, receivedAfterFees } from "../src/lib/commissionHelpers";
import { HIDDEN, hide, setPrivate } from "../src/lib/privacy";

// PayPal: the client pays 200, you receive 186.84
let s = paymentSummary(200, [{ amount: 200, received: 186.84 }]);
assert.deepStrictEqual([s.status, s.paid, s.received, s.fees, s.remaining], ["paid", 200, 186.84, 13.16, 0]);

// Half upfront, received not entered yet
s = paymentSummary(240, [{ amount: 120, received: null }]);
assert.deepStrictEqual([s.status, s.remaining, s.pendingReceived, s.fees], ["partial", 120, 1, 0]);

// No payments
assert.strictEqual(paymentSummary(160, []).status, "unpaid");

// Decimals that don't add up exactly in floating point
s = paymentSummary(0.3, [{ amount: 0.1, received: 0.1 }, { amount: 0.2, received: 0.2 }]);
assert.deepStrictEqual([s.status, s.paid, s.fees], ["paid", 0.3, 0]);

console.log("payments ok");

// Automatic price: base for the first character, +50% per extra
assert.strictEqual(calculateCommissionPrice(160, 1, 0.5), 160);
assert.strictEqual(calculateCommissionPrice(160, 2, 0.5), 240);
assert.strictEqual(calculateCommissionPrice(160, 3, 0.5), 320);
assert.strictEqual(calculateCommissionPrice(160, 0, 0.5), 160);
assert.strictEqual(calculateCommissionPrice(99.99, 2, 0.5), 149.99);
// Fee changed in Settings
assert.strictEqual(calculateCommissionPrice(160, 2, 0.6), 256);
console.log("prices ok");

// Platform fee: 3.4% + 0.35 on 200 → 192.85; never negative
assert.strictEqual(receivedAfterFees(200, { percent: 3.4, fixed: 0.35 }), 192.85);
assert.strictEqual(receivedAfterFees(200, { percent: 0, fixed: 0 }), 200);
assert.strictEqual(receivedAfterFees(0.2, { percent: 3.4, fixed: 0.35 }), 0);
console.log("fees ok");

// Private mode: amounts and names hidden, and everything returns when turned off
assert.notStrictEqual(formatMoney(200, "EUR"), "•••");
setPrivate(true);
assert.strictEqual(formatMoney(200, "EUR"), "•••");
assert.strictEqual(hide("Kai"), HIDDEN);
setPrivate(false);
assert.strictEqual(hide("Kai"), "Kai");
assert.notStrictEqual(formatMoney(200, "EUR"), "•••");
console.log("private ok");

// Invoice description
assert.strictEqual(invoiceDescription("Rendered", ["Ana", "Beto"]), "Rendered, 2 characters (Ana, Beto) - @AverageZebraBoy");
assert.strictEqual(invoiceDescription("Sketch", ["Ana"]), "Sketch, 1 character (Ana) - @AverageZebraBoy");
assert.strictEqual(invoiceDescription(null, []), "@AverageZebraBoy");
console.log("description ok");
