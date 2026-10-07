// Pure helpers for the trash (no database here, so scripts/check-trash.ts can run them)

/** Rows of one deleted item, by table: the item itself plus everything that hung from it */
export type Snapshot = Record<string, Record<string, unknown>[]>;

/** Days an item stays in the trash before it is removed for good */
export const TRASH_DAYS = 30;

export const COMMISSION_CHILDREN = [
  "commission_tags",
  "commission_payments",
  "commission_corrections",
  "commission_stage_images",
  "commission_characters",
] as const;

/** Table names are our own constants; columns come from the stored rows. REPLACE makes a retry safe. */
export function insertStatement(table: string, row: Record<string, unknown>): [string, unknown[]] {
  const columns = Object.keys(row);

  return [
    `INSERT OR REPLACE INTO ${table} (${columns.join(", ")}) VALUES (${columns.map(() => "?").join(", ")});`,
    columns.map((column) => row[column]),
  ];
}

/** What exists now: a restored commission must not point at things deleted in the meantime */
export type Existing = {
  clients: Set<number>;
  templates: Set<number>;
  tags: Set<number>;
  characters: Set<number>;
};

export function adaptCommission(snapshot: Snapshot, existing: Existing): Snapshot {
  const commission = { ...snapshot.commissions[0] };

  if (!existing.clients.has(Number(commission.client_id))) {
    commission.client_id = null;
  }

  // No template means no stages: the commission comes back as "not started"
  if (!existing.templates.has(Number(commission.template_id))) {
    commission.template_id = null;
    commission.current_stage_id = null;
  }

  return {
    ...snapshot,
    commissions: [commission],
    commission_tags: (snapshot.commission_tags ?? []).filter((row) => existing.tags.has(Number(row.tag_id))),
    commission_characters: (snapshot.commission_characters ?? []).filter((row) =>
      existing.characters.has(Number(row.character_id)),
    ),
  };
}

/** Image files a snapshot still needs: they must survive the orphan cleanup */
export function imagePathsOf(snapshot: Snapshot): string[] {
  return (snapshot.commission_stage_images ?? []).map((row) => String(row.image_data_url));
}
