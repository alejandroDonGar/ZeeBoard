// Quick check of the trash helpers: npx tsx scripts/check-trash.ts
import assert from "node:assert";
import { adaptCommission, imagePathsOf, insertStatement, type Snapshot } from "../src/lib/trash";

const snapshot: Snapshot = {
  commissions: [{ id: 7, title: "Sketch", client_id: 3, template_id: 2, current_stage_id: 5, price: 80 }],
  commission_tags: [{ commission_id: 7, tag_id: 1 }, { commission_id: 7, tag_id: 9 }],
  commission_payments: [{ id: 4, commission_id: 7, amount: 40 }],
  commission_stage_images: [{ id: 1, commission_id: 7, image_data_url: "images/a.webp" }],
  commission_characters: [{ commission_id: 7, character_id: 11 }, { commission_id: 7, character_id: 12 }],
};

// Everything still exists: the snapshot comes back unchanged
const all = { clients: new Set([3]), templates: new Set([2]), tags: new Set([1, 9]), characters: new Set([11, 12]) };
assert.deepStrictEqual(adaptCommission(snapshot, all), snapshot);

// Client, template, one tag and one character were deleted since
const later = { clients: new Set<number>(), templates: new Set<number>(), tags: new Set([1]), characters: new Set([12]) };
const adapted = adaptCommission(snapshot, later);
assert.deepStrictEqual(
  [adapted.commissions[0].client_id, adapted.commissions[0].template_id, adapted.commissions[0].current_stage_id],
  [null, null, null],
);
assert.deepStrictEqual(adapted.commission_tags, [{ commission_id: 7, tag_id: 1 }]);
assert.deepStrictEqual(adapted.commission_characters, [{ commission_id: 7, character_id: 12 }]);
assert.strictEqual(adapted.commissions[0].title, "Sketch");
assert.strictEqual(snapshot.commissions[0].client_id, 3, "the stored snapshot is not mutated");

// SQL built from the stored columns
assert.deepStrictEqual(insertStatement("commission_tags", { commission_id: 7, tag_id: 1 }), [
  "INSERT OR REPLACE INTO commission_tags (commission_id, tag_id) VALUES (?, ?);",
  [7, 1],
]);

assert.deepStrictEqual(imagePathsOf(snapshot), ["images/a.webp"]);
assert.deepStrictEqual(imagePathsOf({ commissions: [] }), []);

console.log("trash ok");
