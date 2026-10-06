import Database from "@tauri-apps/plugin-sql";
import {
  deleteImageFiles,
  importImageFromDataDir,
  isProcessedImage,
} from "./images";

type ZeeDatabase = Awaited<ReturnType<typeof Database.load>>;

let db: ZeeDatabase | null = null;
let transactionQueue: Promise<unknown> = Promise.resolve();

async function runSerialized<T>(
  work: (database: ZeeDatabase) => Promise<T>,
): Promise<T> {
  const database = await getDatabase();

  const run = () => work(database);

  const resultPromise = transactionQueue.then(run, run);

  transactionQueue = resultPromise.then(
    () => undefined,
    () => undefined,
  );

  return resultPromise;
}

export type Template = {
  id: number;
  name: string;
  /** Precio por un personaje; cada personaje extra suma un porcentaje (ver calculateCommissionPrice) */
  base_price: number | null;
  /** Correcciones que entran en el precio; null = sin límite (no se muestra contador) */
  revisions_included: number | null;
};

export type TemplateStage = {
  id: number;
  template_id: number;
  name: string;
  stage_order: number;
};

export async function getDatabase(): Promise<ZeeDatabase> {
  if (db) return db;

  db = await Database.load("sqlite:zeeboard.db");

  await db.execute("PRAGMA busy_timeout = 5000;");

  return db;
}

/** Cierra la conexión: hace falta antes de reemplazar el archivo al restaurar un backup */
export async function closeDatabase(): Promise<void> {
  if (db) {
    await db.close();
    db = null;
  }
}

export type AppSettings = {
  default_currency: string;
  /** 0.5 = cada personaje extra suma el 50 % del precio base */
  extra_character_rate: number;
  auto_backup_enabled: boolean;
  auto_backup_folder: string | null;
  /** Cuántas copias automáticas se conservan */
  auto_backup_keep: number;
  /** Cuándo se hizo la última copia automática (ISO) */
  last_auto_backup: string | null;
  /** Lo máximo que prometes a un cliente: sin fecha de entrega, es el límite desde que aceptas la comisión */
  promise_max_days: number;
  reminders_enabled: boolean;
  /** Avisos de entrega: este número de días antes y el mismo día */
  reminder_days_before: number;
  stalled_enabled: boolean;
  /** Aviso de comisión parada: días sin cambios */
  stalled_days: number;
};

// Se cargan una vez al arrancar para poder leerlos sin await desde cualquier pantalla
let settings: AppSettings = {
  default_currency: "EUR",
  extra_character_rate: 0.5,
  auto_backup_enabled: false,
  auto_backup_folder: null,
  auto_backup_keep: 7,
  last_auto_backup: null,
  promise_max_days: 60,
  reminders_enabled: true,
  reminder_days_before: 3,
  stalled_enabled: true,
  stalled_days: 21,
};

export function appSettings(): AppSettings {
  return settings;
}

async function loadSettings(): Promise<void> {
  const database = await getDatabase();
  type Row = Omit<AppSettings, "auto_backup_enabled" | "reminders_enabled" | "stalled_enabled"> & {
    auto_backup_enabled: number;
    reminders_enabled: number;
    stalled_enabled: number;
  };

  const rows = await database.select<Row[]>(
    `SELECT default_currency, extra_character_rate, auto_backup_enabled, auto_backup_folder, auto_backup_keep,
       last_auto_backup, promise_max_days, reminders_enabled, reminder_days_before, stalled_enabled, stalled_days
     FROM settings WHERE id = 1;`,
  );

  if (rows[0]) {
    settings = {
      ...rows[0],
      auto_backup_enabled: Boolean(rows[0].auto_backup_enabled),
      reminders_enabled: Boolean(rows[0].reminders_enabled),
      stalled_enabled: Boolean(rows[0].stalled_enabled),
    };
  }
}

export async function updateSettings(changes: Partial<AppSettings>): Promise<void> {
  const database = await getDatabase();
  const next = { ...settings, ...changes };

  await database.execute(
    `UPDATE settings SET default_currency = ?, extra_character_rate = ?, auto_backup_enabled = ?,
       auto_backup_folder = ?, auto_backup_keep = ?, last_auto_backup = ?, promise_max_days = ?,
       reminders_enabled = ?, reminder_days_before = ?, stalled_enabled = ?, stalled_days = ? WHERE id = 1;`,
    [
      next.default_currency,
      next.extra_character_rate,
      next.auto_backup_enabled ? 1 : 0,
      next.auto_backup_folder,
      next.auto_backup_keep,
      next.last_auto_backup,
      next.promise_max_days,
      next.reminders_enabled ? 1 : 0,
      next.reminder_days_before,
      next.stalled_enabled ? 1 : 0,
      next.stalled_days,
    ],
  );
  settings = next;
}

export async function initializeDatabase() {
  const database = await getDatabase();

  await database.execute(`
    CREATE TABLE IF NOT EXISTS settings (
      id INTEGER PRIMARY KEY,
      language TEXT NOT NULL DEFAULT 'en',
      theme TEXT NOT NULL DEFAULT 'zebra-light'
    );
  `);
  await database.execute(`ALTER TABLE settings ADD COLUMN default_currency TEXT NOT NULL DEFAULT 'EUR';`).catch(() => {});
  await database.execute(`ALTER TABLE settings ADD COLUMN extra_character_rate REAL NOT NULL DEFAULT 0.5;`).catch(() => {});
  await database.execute(`ALTER TABLE settings ADD COLUMN auto_backup_enabled INTEGER NOT NULL DEFAULT 0;`).catch(() => {});
  await database.execute(`ALTER TABLE settings ADD COLUMN auto_backup_folder TEXT;`).catch(() => {});
  await database.execute(`ALTER TABLE settings ADD COLUMN auto_backup_keep INTEGER NOT NULL DEFAULT 7;`).catch(() => {});
  await database.execute(`ALTER TABLE settings ADD COLUMN last_auto_backup TEXT;`).catch(() => {});
  await database.execute(`ALTER TABLE settings ADD COLUMN promise_max_days INTEGER NOT NULL DEFAULT 60;`).catch(() => {});
  await database.execute(`ALTER TABLE settings ADD COLUMN reminders_enabled INTEGER NOT NULL DEFAULT 1;`).catch(() => {});
  await database.execute(`ALTER TABLE settings ADD COLUMN reminder_days_before INTEGER NOT NULL DEFAULT 3;`).catch(() => {});
  await database.execute(`ALTER TABLE settings ADD COLUMN stalled_enabled INTEGER NOT NULL DEFAULT 1;`).catch(() => {});
  await database.execute(`ALTER TABLE settings ADD COLUMN stalled_days INTEGER NOT NULL DEFAULT 21;`).catch(() => {});
  // Cuándo cambió una comisión de etapa por última vez: cuenta como movimiento para el aviso de comisión parada
  await database.execute(`ALTER TABLE commissions ADD COLUMN stage_changed_at TEXT;`).catch(() => {});
  await database.execute(`INSERT OR IGNORE INTO settings (id) VALUES (1);`);
  await loadSettings();

  await database.execute(`
    CREATE TABLE IF NOT EXISTS clients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT,
      discord TEXT,
      notes TEXT,
      created_at TEXT NOT NULL
    );
  `);

  await database.execute(`
    CREATE TABLE IF NOT EXISTS tags (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      color TEXT NOT NULL
    );
  `);
  await database.execute(`
    ALTER TABLE tags
    ADD COLUMN category TEXT DEFAULT 'General';
  `).catch(() => {});

  await database.execute(`
    CREATE TABLE IF NOT EXISTS templates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL
    );
  `);

  await database.execute(`ALTER TABLE templates ADD COLUMN base_price REAL;`).catch(() => {});
  await database.execute(`ALTER TABLE templates ADD COLUMN revisions_included INTEGER;`).catch(() => {});

  // Correcciones que pide el cliente, cada una ligada a una etapa; cada una cuenta como una revisión
  await database.execute(`
    CREATE TABLE IF NOT EXISTS commission_corrections (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      commission_id INTEGER NOT NULL,
      stage_id INTEGER NOT NULL,
      text TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  `);

  await database.execute(`
    CREATE TABLE IF NOT EXISTS template_stages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      template_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      stage_order INTEGER NOT NULL
    );
  `);

  await database.execute(`
    CREATE TABLE IF NOT EXISTS commissions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      client_id INTEGER,
      template_id INTEGER,
      current_stage_id INTEGER,
      price REAL,
      deadline TEXT,
      notes TEXT,
      created_at TEXT NOT NULL
    );
  `);

  await database.execute(`
    ALTER TABLE commissions
    ADD COLUMN client_name TEXT;
  `).catch(() => {});

  await database.execute(`
    ALTER TABLE commissions
    ADD COLUMN platform TEXT;
  `).catch(() => {});

  await database.execute(`
    ALTER TABLE commissions
    ADD COLUMN currency TEXT DEFAULT 'EUR';
  `).catch(() => {});

  await database.execute(`
    CREATE TABLE IF NOT EXISTS commission_tags (
      commission_id INTEGER NOT NULL,
      tag_id INTEGER NOT NULL,
      PRIMARY KEY (commission_id, tag_id)
    );
  `);

  await database.execute(`
    ALTER TABLE clients
    ADD COLUMN platform TEXT;
  `).catch(() => {});

  await database.execute(`
    ALTER TABLE clients
    ADD COLUMN handle TEXT;
  `).catch(() => {});

  await database.execute(`
    ALTER TABLE clients
    ADD COLUMN avatar_url TEXT;
  `).catch(() => {});

  await database.execute(`
    CREATE TABLE IF NOT EXISTS commission_stage_images (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      commission_id INTEGER NOT NULL,
      stage_id INTEGER NOT NULL,
      label TEXT NOT NULL DEFAULT 'Alt 1',
      image_data_url TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  `);

  // Tabla antigua que nunca llegó a usarse
  await database.execute(`DROP TABLE IF EXISTS commission_references;`);

  await database.execute(`
    ALTER TABLE commission_stage_images
    ADD COLUMN id INTEGER;
  `).catch(() => {});

  await database.execute(`
    ALTER TABLE commission_stage_images
    ADD COLUMN label TEXT NOT NULL DEFAULT 'Alt 1';
  `).catch(() => {});

  await database.execute(`
    CREATE TABLE IF NOT EXISTS client_characters (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      notes TEXT,
      created_at TEXT NOT NULL
    );
  `);

  await database.execute(`
    CREATE TABLE IF NOT EXISTS character_references (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      character_id INTEGER NOT NULL,
      label TEXT NOT NULL DEFAULT 'Reference',
      image_data_url TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  `);

  await database.execute(`
    CREATE TABLE IF NOT EXISTS commission_characters (
      commission_id INTEGER NOT NULL,
      character_id INTEGER NOT NULL,
      PRIMARY KEY (commission_id, character_id)
    );
  `);

  // Tarifas de PayPal, Ko-fi…: lo recibido se calcula como importe − (importe × % + fijo)
  await database.execute(`
    CREATE TABLE IF NOT EXISTS payment_platforms (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      percent REAL NOT NULL DEFAULT 0,
      fixed REAL NOT NULL DEFAULT 0
    );
  `);

  // amount = lo que pagó el cliente; received = lo que te llegó (NULL = aún no lo has apuntado)
  await database.execute(`
    CREATE TABLE IF NOT EXISTS commission_payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      commission_id INTEGER NOT NULL,
      amount REAL NOT NULL,
      received REAL,
      paid_at TEXT NOT NULL,
      note TEXT
    );
  `);
}

export async function getTemplates(): Promise<Template[]> {
  const database = await getDatabase();

  return await database.select<Template[]>(`
    SELECT id, name, base_price, revisions_included
    FROM templates
    ORDER BY id DESC;
  `);
}

export async function getTemplateStages(templateId: number): Promise<TemplateStage[]> {
  const database = await getDatabase();

  return await database.select<TemplateStage[]>(
    `
    SELECT id, template_id, name, stage_order
    FROM template_stages
    WHERE template_id = ?
    ORDER BY stage_order ASC;
    `,
    [templateId],
  );
}

export async function createTemplate(name: string, stages: string[]): Promise<void> {
  const templateName = name.trim();
  const templateStages = stages
    .map((stage) => stage.trim())
    .filter(Boolean);

  if (!templateName) {
    throw new Error("Template name is required");
  }

  await runSerialized(async (database) => {
    const result = await database.execute(
      `
      INSERT INTO templates (name)
      VALUES (?);
      `,
      [templateName],
    );

    const templateId = result.lastInsertId;

    if (!templateId) {
      throw new Error("Could not get created template id");
    }

    for (let index = 0; index < templateStages.length; index++) {
      await database.execute(
        `
        INSERT INTO template_stages (template_id, name, stage_order)
        VALUES (?, ?, ?);
        `,
        [templateId, templateStages[index], index + 1],
      );
    }
  });
}

export async function deleteTemplate(templateId: number): Promise<void> {
  const database = await getDatabase();

  // También las terminadas: sin sus etapas dejarían de contar como terminadas y perderían sus imágenes
  const commissionsUsingTemplate = await database.select<{ count: number }[]>(
    `SELECT COUNT(*) as count FROM commissions WHERE template_id = ?;`,
    [templateId],
  );

  if (commissionsUsingTemplate[0].count > 0) {
    throw new Error(
      "This template is used by one or more commissions (active or finished), so it can't be deleted. Duplicate it if you want a variation.",
    );
  }

  await database.execute(
    `DELETE FROM template_stages WHERE template_id = ?;`,
    [templateId],
  );

  await database.execute(
    `DELETE FROM templates WHERE id = ?;`,
    [templateId],
  );
}

export async function duplicateTemplate(templateId: number): Promise<void> {
  const database = await getDatabase();

  const templates = await database.select<Template[]>(
    `
    SELECT id, name, base_price, revisions_included
    FROM templates
    WHERE id = ?;
    `,
    [templateId],
  );

  if (templates.length === 0) {
    throw new Error("Template not found");
  }

  const sourceTemplate = templates[0];
  const stages = await getTemplateStages(templateId);

  const result = await database.execute(
    `
    INSERT INTO templates (name, base_price, revisions_included)
    VALUES (?, ?, ?);
    `,
    [`${sourceTemplate.name} Copy`, sourceTemplate.base_price, sourceTemplate.revisions_included],
  );

  const newTemplateId = result.lastInsertId;

  if (!newTemplateId) {
    throw new Error("Could not get duplicated template id");
  }

  for (const stage of stages) {
    await database.execute(
      `
      INSERT INTO template_stages (template_id, name, stage_order)
      VALUES (?, ?, ?);
      `,
      [newTemplateId, stage.name, stage.stage_order],
    );
  }
}

export async function updateTemplateBasePrice(templateId: number, basePrice: number | null): Promise<void> {
  const database = await getDatabase();

  await database.execute(`UPDATE templates SET base_price = ? WHERE id = ?;`, [basePrice, templateId]);
}

export async function updateTemplateRevisions(templateId: number, revisions: number | null): Promise<void> {
  const database = await getDatabase();

  await database.execute(`UPDATE templates SET revisions_included = ? WHERE id = ?;`, [revisions, templateId]);
}

export async function updateTemplateName(
  templateId: number,
  name: string,
): Promise<void> {
  const database = await getDatabase();

  const cleanName = name.trim();

  if (!cleanName) {
    throw new Error("Template name is required");
  }

  await database.execute(
    `
    UPDATE templates
    SET name = ?
    WHERE id = ?;
    `,
    [cleanName, templateId],
  );
}

export type StageDraft = { id: number | null; name: string };

/**
 * Guarda las etapas de una plantilla conservando sus ids: las comisiones guardan su etapa actual
 * y sus imágenes por id, así que renombrar o reordenar no puede crear etapas nuevas.
 * Una etapa que alguna comisión está usando no se puede quitar.
 */
export async function saveTemplateStages(
  templateId: number,
  stages: StageDraft[],
): Promise<void> {
  const cleanStages = stages
    .map((stage) => ({ ...stage, name: stage.name.trim() }))
    .filter((stage) => stage.name);

  await runSerialized(async (database) => {
    const existing = await database.select<{ id: number; name: string }[]>(
      `SELECT id, name FROM template_stages WHERE template_id = ?;`,
      [templateId],
    );

    const keptIds = new Set(cleanStages.map((stage) => stage.id));
    const removed = existing.filter((stage) => !keptIds.has(stage.id));

    for (const stage of removed) {
      const usage = await database.select<{ count: number }[]>(
        `
        SELECT
          (SELECT COUNT(*) FROM commissions WHERE current_stage_id = ?) +
          (SELECT COUNT(*) FROM commission_stage_images WHERE stage_id = ?) +
          (SELECT COUNT(*) FROM commission_corrections WHERE stage_id = ?) AS count;
        `,
        [stage.id, stage.id, stage.id],
      );

      if (usage[0].count > 0) {
        throw new Error(
          `"${stage.name}" is in use by a commission (current stage, images or corrections), so it can't be removed.`,
        );
      }
    }

    for (const stage of removed) {
      await database.execute(`DELETE FROM template_stages WHERE id = ?;`, [stage.id]);
    }

    for (let index = 0; index < cleanStages.length; index++) {
      const stage = cleanStages[index];

      if (stage.id !== null) {
        await database.execute(
          `UPDATE template_stages SET name = ?, stage_order = ? WHERE id = ? AND template_id = ?;`,
          [stage.name, index + 1, stage.id, templateId],
        );
      } else {
        await database.execute(
          `INSERT INTO template_stages (template_id, name, stage_order) VALUES (?, ?, ?);`,
          [templateId, stage.name, index + 1],
        );
      }
    }
  });
}

export type Commission = {
  id: number;
  title: string;
  client_id: number | null;
  client_name: string | null;
  platform: string | null;
  template_id: number | null;
  current_stage_id: number | null;
  price: number | null;
  currency: string | null;
  deadline: string | null;
  notes: string | null;
  created_at: string;
};

export async function getCommissions(): Promise<Commission[]> {
  const database = await getDatabase();

  return await database.select<Commission[]>(`
    SELECT *
    FROM commissions
    ORDER BY id DESC;
  `);
}

export async function createCommission(
  title: string,
  clientId: number | null,
  clientName: string,
  platform: string,
  templateId: number | null,
  price: number | null,
  currency: string,
  deadline: string | null,
  notes: string,
): Promise<number> {
  const database = await getDatabase();

  const cleanTitle = title.trim();

  if (!cleanTitle) {
    throw new Error("Commission title is required");
  }

  let firstStageId: number | null = null;

  if (templateId) {
    const stages = await getTemplateStages(templateId);
    firstStageId = stages.length > 0 ? stages[0].id : null;
  }

  const result = await database.execute(
    `
    INSERT INTO commissions (
      title,
      client_id,
      client_name,
      platform,
      template_id,
      current_stage_id,
      price,
      currency,
      deadline,
      notes,
      created_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
    `,
    [
      cleanTitle,
      clientId,
      clientName.trim() || null,
      platform,
      templateId,
      firstStageId,
      price,
      currency,
      deadline,
      notes.trim() || null,
      new Date().toISOString(),
    ],
  );

  return Number(result.lastInsertId);
}

export async function updateCommissionStage(
  commissionId: number,
  stageId: number | null,
): Promise<void> {
  const database = await getDatabase();

  await database.execute(
    `
    UPDATE commissions
    SET current_stage_id = ?, stage_changed_at = ?
    WHERE id = ?;
    `,
    [stageId, new Date().toISOString(), commissionId],
  );
}

export async function updateCommission(
  commissionId: number,
  title: string,
  clientId: number | null,
  clientName: string,
  platform: string,
  price: number | null,
  currency: string,
  deadline: string | null,
  notes: string,
): Promise<void> {
  const database = await getDatabase();

  const cleanTitle = title.trim();

  if (!cleanTitle) {
    throw new Error("Commission title is required");
  }

  await database.execute(
    `
    UPDATE commissions
    SET
      title = ?,
      client_id = ?,
      client_name = ?,
      platform = ?,
      price = ?,
      currency = ?,
      deadline = ?,
      notes = ?
    WHERE id = ?;
    `,
    [
      cleanTitle,
      clientId,
      clientName.trim() || null,
      platform,
      price,
      currency,
      deadline,
      notes.trim() || null,
      commissionId,
    ],
  );
}

export async function duplicateCommission(
  commissionId: number,
): Promise<number> {
  const database = await getDatabase();

  const commissions = await database.select<Commission[]>(
    `
    SELECT *
    FROM commissions
    WHERE id = ?;
    `,
    [commissionId],
  );

  if (commissions.length === 0) {
    throw new Error("Commission not found");
  }

  const commission = commissions[0];

  const similarCopies = await database.select<{ count: number }[]>(
    `
    SELECT COUNT(*) as count
    FROM commissions
    WHERE title LIKE ?;
    `,
    [`${commission.title} Copy%`],
  );

  const copyNumber = similarCopies[0].count + 1;
  const copyTitle = `${commission.title} Copy ${copyNumber}`;

  await database.execute(
    `
    INSERT INTO commissions (
      title,
      client_name,
      platform,
      template_id,
      current_stage_id,
      price,
      currency,
      deadline,
      notes,
      created_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
    `,
    [
      copyTitle,
      commission.client_name,
      commission.platform,
      commission.template_id,
      commission.current_stage_id,
      commission.price,
      commission.currency,
      commission.deadline,
      commission.notes,
      new Date().toISOString(),
    ],
  );

  const result = await database.select<{ id: number }[]>(`
    SELECT last_insert_rowid() AS id;
  `);

  return result[0].id;
}

export async function deleteCommission(
  commissionId: number,
): Promise<void> {
  const database = await getDatabase();

  await database.execute(
    `DELETE FROM commission_tags WHERE commission_id = ?;`,
    [commissionId],
  );

  await database.execute(
    `DELETE FROM commission_payments WHERE commission_id = ?;`,
    [commissionId],
  );

  await database.execute(
    `DELETE FROM commission_corrections WHERE commission_id = ?;`,
    [commissionId],
  );

  const images = await database.select<{ image_data_url: string }[]>(
    `SELECT image_data_url FROM commission_stage_images WHERE commission_id = ?;`,
    [commissionId],
  );

  await database.execute(
    `DELETE FROM commission_stage_images WHERE commission_id = ?;`,
    [commissionId],
  );

  for (const image of images) {
    await deleteImageIfUnused(image.image_data_url);
  }

  await database.execute(
    `DELETE FROM commission_characters WHERE commission_id = ?;`,
    [commissionId],
  );

  await database.execute(
    `DELETE FROM commissions WHERE id = ?;`,
    [commissionId],
  );
}

export type Tag = {
  id: number;
  name: string;
  color: string;
  category: string;
};

export async function getTags(): Promise<Tag[]> {
  const database = await getDatabase();

  return await database.select<Tag[]>(`
    SELECT id, name, color, category
    FROM tags
    ORDER BY id DESC;
  `);
}

export async function createTag(
  name: string,
  color: string,
  category: string,
): Promise<void> {
  const database = await getDatabase();

  const cleanName = name.trim();

  if (!cleanName) {
    throw new Error("Tag name is required");
  }

  await database.execute(
    `
    INSERT INTO tags (name, color, category)
    VALUES (?, ?, ?);
    `,
    [cleanName, color, category],
  );
}

export async function deleteTag(tagId: number): Promise<void> {
  await runSerialized(async (database) => {
    // Se quita también de las comisiones que la tenían
    await database.execute(`DELETE FROM commission_tags WHERE tag_id = ?;`, [tagId]);
    await database.execute(`DELETE FROM tags WHERE id = ?;`, [tagId]);
  });
}

export async function updateTag(tagId: number, name: string, color: string): Promise<void> {
  const database = await getDatabase();
  const cleanName = name.trim();

  if (!cleanName) {
    throw new Error("Tag name is required");
  }

  await database.execute(`UPDATE tags SET name = ?, color = ? WHERE id = ?;`, [
    cleanName,
    color,
    tagId,
  ]);
}

/** Cuántas comisiones usan cada etiqueta: { tagId: número } */
export async function getTagUsageCounts(): Promise<Record<number, number>> {
  const database = await getDatabase();
  const rows = await database.select<{ tag_id: number; count: number }[]>(
    `SELECT tag_id, COUNT(*) AS count FROM commission_tags GROUP BY tag_id;`,
  );

  return Object.fromEntries(rows.map((row) => [row.tag_id, row.count]));
}

export async function getCommissionTags(
  commissionId: number,
): Promise<Tag[]> {
  const database = await getDatabase();

  return await database.select<Tag[]>(
    `
    SELECT tags.id, tags.name, tags.color, tags.category
    FROM tags
    INNER JOIN commission_tags
      ON commission_tags.tag_id = tags.id
    WHERE commission_tags.commission_id = ?
    ORDER BY tags.name ASC;
    `,
    [commissionId],
  );
}

export async function replaceCommissionTags(
  commissionId: number,
  tagIds: number[],
): Promise<void> {
  await runSerialized(async (database) => {
    await database.execute(
      `
      DELETE FROM commission_tags
      WHERE commission_id = ?;
      `,
      [commissionId],
    );

    for (const tagId of tagIds) {
      await database.execute(
        `
        INSERT INTO commission_tags (commission_id, tag_id)
        VALUES (?, ?);
        `,
        [commissionId, tagId],
      );
    }
  });
}

export type Client = {
  id: number;
  name: string;
  platform: string | null;
  handle: string | null;
  avatar_url: string | null;
  notes: string | null;
  created_at: string;
};

export type ClientCharacter = {
  id: number;
  client_id: number;
  name: string;
  notes: string | null;
  created_at: string;
};

export type CharacterReference = {
  id: number;
  character_id: number;
  label: string;
  image_data_url: string;
  created_at: string;
};

export async function getClients(): Promise<Client[]> {
  const database = await getDatabase();

  return await database.select<Client[]>(`
    SELECT
      id,
      name,
      platform,
      handle,
      avatar_url,
      notes,
      created_at
    FROM clients
    ORDER BY name ASC;
  `);
}

export async function createClient(
  name: string,
  platform: string,
  handle: string,
  notes: string,
): Promise<void> {
  const database = await getDatabase();

  const cleanName = name.trim();

  if (!cleanName) {
    throw new Error("Client name is required");
  }

  await database.execute(
    `
    INSERT INTO clients (
      name,
      platform,
      handle,
      notes,
      created_at
    )
    VALUES (?, ?, ?, ?, ?);
    `,
    [
      cleanName,
      platform || null,
      handle.trim() || null,
      notes.trim() || null,
      new Date().toISOString(),
    ],
  );
}

export async function deleteClient(clientId: number): Promise<void> {
  const database = await getDatabase();

  const characters = await database.select<{ id: number }[]>(
    `SELECT id FROM client_characters WHERE client_id = ?;`,
    [clientId],
  );

  for (const character of characters) {
    await database.execute(
      `DELETE FROM character_references WHERE character_id = ?;`,
      [character.id],
    );

    await database.execute(
      `DELETE FROM commission_characters WHERE character_id = ?;`,
      [character.id],
    );
  }

  await database.execute(
    `DELETE FROM client_characters WHERE client_id = ?;`,
    [clientId],
  );

  await database.execute(
    `UPDATE commissions SET client_id = NULL WHERE client_id = ?;`,
    [clientId],
  );

  await database.execute(
    `DELETE FROM clients WHERE id = ?;`,
    [clientId],
  );
}

export async function updateClient(
  clientId: number,
  name: string,
  platform: string,
  handle: string,
  notes: string,
): Promise<void> {
  const database = await getDatabase();

  const cleanName = name.trim();

  if (!cleanName) {
    throw new Error("Client name is required");
  }

  await database.execute(
    `
    UPDATE clients
    SET
      name = ?,
      platform = ?,
      handle = ?,
      notes = ?
    WHERE id = ?;
    `,
    [
      cleanName,
      platform || null,
      handle.trim() || null,
      notes.trim() || null,
      clientId,
    ],
  );
}

export async function updateClientAvatar(
  clientId: number,
  avatarUrl: string | null,
): Promise<void> {
  const database = await getDatabase();

  await database.execute(
    `
    UPDATE clients
    SET avatar_url = ?
    WHERE id = ?;
    `,
    [avatarUrl, clientId],
  );
}

export async function getClientCharacters(
  clientId: number,
): Promise<ClientCharacter[]> {
  const database = await getDatabase();

  return await database.select<ClientCharacter[]>(
    `
    SELECT id, client_id, name, notes, created_at
    FROM client_characters
    WHERE client_id = ?
    ORDER BY name ASC;
    `,
    [clientId],
  );
}

export async function createClientCharacter(
  clientId: number,
  name: string,
  notes: string,
): Promise<void> {
  const database = await getDatabase();

  const cleanName = name.trim();

  if (!cleanName) {
    throw new Error("Character name is required");
  }

  await database.execute(
    `
    INSERT INTO client_characters (
      client_id,
      name,
      notes,
      created_at
    )
    VALUES (?, ?, ?, ?);
    `,
    [
      clientId,
      cleanName,
      notes.trim() || null,
      new Date().toISOString(),
    ],
  );
}

export async function deleteClientCharacter(
  characterId: number,
): Promise<void> {
  const database = await getDatabase();

  const references = await database.select<{ image_data_url: string }[]>(
    `SELECT image_data_url FROM character_references WHERE character_id = ?;`,
    [characterId],
  );

  await runSerialized(async (serialized) => {
    await serialized.execute(`DELETE FROM character_references WHERE character_id = ?;`, [characterId]);
    await serialized.execute(`DELETE FROM commission_characters WHERE character_id = ?;`, [characterId]);
    await serialized.execute(`DELETE FROM client_characters WHERE id = ?;`, [characterId]);
  });

  // Sus imágenes se borran del disco si ya no las usa nadie más
  for (const reference of references) {
    await deleteImageIfUnused(reference.image_data_url);
  }
}

export async function updateClientCharacter(
  characterId: number,
  name: string,
  notes: string,
): Promise<void> {
  const database = await getDatabase();
  const cleanName = name.trim();

  if (!cleanName) {
    throw new Error("Character name is required");
  }

  await database.execute(`UPDATE client_characters SET name = ?, notes = ? WHERE id = ?;`, [
    cleanName,
    notes.trim() || null,
    characterId,
  ]);
}

export async function getCharacterReferences(
  characterId: number,
): Promise<CharacterReference[]> {
  const database = await getDatabase();

  return await database.select<CharacterReference[]>(
    `
    SELECT id, character_id, label, image_data_url, created_at
    FROM character_references
    WHERE character_id = ?
    ORDER BY id ASC;
    `,
    [characterId],
  );
}

export async function createCharacterReference(
  characterId: number,
  imagePath: string,
): Promise<void> {
  const database = await getDatabase();

  const existingReferences = await database.select<{ count: number }[]>(
    `
    SELECT COUNT(*) as count
    FROM character_references
    WHERE character_id = ?;
    `,
    [characterId],
  );

  const referenceNumber = existingReferences[0].count + 1;

  await database.execute(
    `
    INSERT INTO character_references (
      character_id,
      label,
      image_data_url,
      created_at
    )
    VALUES (?, ?, ?, ?);
    `,
    [
      characterId,
      `Reference ${referenceNumber}`,
      imagePath,
      new Date().toISOString(),
    ],
  );
}

export async function deleteCharacterReference(
  referenceId: number,
): Promise<void> {
  const database = await getDatabase();

  const references = await database.select<{ image_data_url: string }[]>(
    `
    SELECT image_data_url
    FROM character_references
    WHERE id = ?;
    `,
    [referenceId],
  );

  await database.execute(
    `
    DELETE FROM character_references
    WHERE id = ?;
    `,
    [referenceId],
  );

  if (references.length > 0) {
    await deleteImageIfUnused(references[0].image_data_url);
  }
}

export async function getCommissionCharacterIds(
  commissionId: number,
): Promise<number[]> {
  const database = await getDatabase();

  const rows = await database.select<{ character_id: number }[]>(
    `
    SELECT character_id
    FROM commission_characters
    WHERE commission_id = ?;
    `,
    [commissionId],
  );

  return rows.map((row) => row.character_id);
}

export async function replaceCommissionCharacters(
  commissionId: number,
  characterIds: number[],
): Promise<void> {
  await runSerialized(async (database) => {
    await database.execute(
      `
      DELETE FROM commission_characters
      WHERE commission_id = ?;
      `,
      [commissionId],
    );

    for (const characterId of characterIds) {
      await database.execute(
        `
        INSERT INTO commission_characters (
          commission_id,
          character_id
        )
        VALUES (?, ?);
        `,
        [commissionId, characterId],
      );
    }
  });
}

export type CommissionStageImage = {
  id: number;
  commission_id: number;
  stage_id: number;
  label: string;
  image_data_url: string;
  created_at: string;
};

export async function getCommissionStageImages(
  commissionId: number,
): Promise<CommissionStageImage[]> {
  const database = await getDatabase();

  return await database.select<CommissionStageImage[]>(
    `
    SELECT id, commission_id, stage_id, label, image_data_url, created_at
    FROM commission_stage_images
    WHERE commission_id = ?
    ORDER BY stage_id ASC, id ASC;
    `,
    [commissionId],
  );
}

export async function createCommissionStageImage(
  commissionId: number,
  stageId: number,
  imagePath: string,
): Promise<void> {
  const database = await getDatabase();

  const existingImages = await database.select<{ count: number }[]>(
    `
    SELECT COUNT(*) as count
    FROM commission_stage_images
    WHERE commission_id = ?
      AND stage_id = ?;
    `,
    [commissionId, stageId],
  );

  const altNumber = existingImages[0].count + 1;
  const label = `Alt ${altNumber}`;

  await database.execute(
    `
    INSERT INTO commission_stage_images (
      commission_id,
      stage_id,
      label,
      image_data_url,
      created_at
    )
    VALUES (?, ?, ?, ?, ?);
    `,
    [
      commissionId,
      stageId,
      label,
      imagePath,
      new Date().toISOString(),
    ],
  );
}

export async function deleteCommissionStageImage(
  imageId: number,
): Promise<void> {
  const database = await getDatabase();

  const images = await database.select<{ image_data_url: string }[]>(
    `
    SELECT image_data_url
    FROM commission_stage_images
    WHERE id = ?;
    `,
    [imageId],
  );

  await database.execute(
    `
    DELETE FROM commission_stage_images
    WHERE id = ?;
    `,
    [imageId],
  );

  if (images.length > 0) {
    await deleteImageIfUnused(images[0].image_data_url);
  }
}

export async function getAllUsedImagePaths(): Promise<string[]> {
  const database = await getDatabase();

  const characterRefs = await database.select<{ image_data_url: string }[]>(
    `SELECT image_data_url FROM character_references;`,
  );

  const stageImages = await database.select<{ image_data_url: string }[]>(
    `SELECT image_data_url FROM commission_stage_images;`,
  );

  return [
    ...characterRefs.map((row) => row.image_data_url),
    ...stageImages.map((row) => row.image_data_url),
  ];
}
const IMAGE_TABLES = ["character_references", "commission_stage_images"] as const;

/** Una misma imagen puede estar en varias filas (mismo archivo): solo se borra si ya nadie la usa. */
async function deleteImageIfUnused(imagePath: string): Promise<void> {
  const usedPaths = await getAllUsedImagePaths();

  if (!usedPaths.includes(imagePath)) {
    await deleteImageFiles([imagePath]);
  }
}

/**
 * Pasa las imágenes antiguas (archivos a tamaño completo) al formato nuevo: copia WebP ligera + miniatura.
 * Los archivos antiguos no se borran aquí: quedan como huérfanos y se limpian desde Ajustes.
 */
export async function migrateLegacyImages(
  onProgress: (done: number, total: number) => void = () => {},
): Promise<{ migrated: number; failed: number }> {
  const database = await getDatabase();
  let migrated = 0;
  let failed = 0;

  // Primero se reúnen todas las pendientes para poder mostrar "x de total"
  const pending: { table: string; id: number; image_data_url: string }[] = [];

  for (const table of IMAGE_TABLES) {
    const rows = await database.select<{ id: number; image_data_url: string }[]>(
      `SELECT id, image_data_url FROM ${table};`,
    );

    pending.push(
      ...rows
        .filter((row) => !isProcessedImage(row.image_data_url))
        .map((row) => ({ table, ...row })),
    );
  }

  for (const [index, { table, ...row }] of pending.entries()) {
    onProgress(index, pending.length);

    try {
      const stored = await importImageFromDataDir(row.image_data_url);

      await database.execute(
        `UPDATE ${table} SET image_data_url = ? WHERE id = ?;`,
        [stored.path, row.id],
      );

      migrated += 1;
    } catch (error) {
      console.error("Could not migrate image", table, row.id, error);
      failed += 1;
    }
  }

  if (migrated > 0) {
    onProgress(pending.length, pending.length);
    // Recupera el espacio que dejaron las imágenes en base64 de versiones anteriores
    await database.execute("VACUUM;");
  }

  return { migrated, failed };
}

export type CommissionPayment = {
  id: number;
  commission_id: number;
  amount: number;
  received: number | null;
  paid_at: string;
  note: string | null;
};

export async function getAllPayments(): Promise<CommissionPayment[]> {
  const database = await getDatabase();

  return await database.select<CommissionPayment[]>(
    `SELECT id, commission_id, amount, received, paid_at, note FROM commission_payments ORDER BY paid_at ASC, id ASC;`,
  );
}

export async function addPayment(
  commissionId: number,
  amount: number,
  received: number | null,
  paidAt: string,
  note: string,
): Promise<void> {
  const database = await getDatabase();

  await database.execute(
    `INSERT INTO commission_payments (commission_id, amount, received, paid_at, note) VALUES (?, ?, ?, ?, ?);`,
    [commissionId, amount, received, paidAt, note.trim() || null],
  );
}

export async function updatePaymentReceived(paymentId: number, received: number | null): Promise<void> {
  const database = await getDatabase();

  await database.execute(`UPDATE commission_payments SET received = ? WHERE id = ?;`, [received, paymentId]);
}

export async function deletePayment(paymentId: number): Promise<void> {
  const database = await getDatabase();

  await database.execute(`DELETE FROM commission_payments WHERE id = ?;`, [paymentId]);
}

/**
 * Las etiquetas "Paid" / "Not Paid" se sustituyen por pagos: cada comisión con "Paid" recibe un pago
 * por su precio (fechado el día de creación) y después se borran las etiquetas de pago.
 * No hace nada si ya no quedan etiquetas de pago.
 */
export async function migratePaymentTags(): Promise<void> {
  await runSerialized(async (database) => {
    const paymentTags = await database.select<{ id: number; name: string }[]>(
      `SELECT id, name FROM tags WHERE category = 'Payment';`,
    );

    if (paymentTags.length === 0) {
      return;
    }

    const paidTagIds = paymentTags
      .filter((tag) => tag.name.trim().toLowerCase() === "paid")
      .map((tag) => tag.id);

    for (const tagId of paidTagIds) {
      const paidCommissions = await database.select<{ id: number; price: number | null; created_at: string }[]>(
        `
        SELECT c.id, c.price, c.created_at
        FROM commissions c
        JOIN commission_tags ct ON ct.commission_id = c.id
        WHERE ct.tag_id = ?
          AND c.price IS NOT NULL
          AND NOT EXISTS (SELECT 1 FROM commission_payments p WHERE p.commission_id = c.id);
        `,
        [tagId],
      );

      for (const commission of paidCommissions) {
        await database.execute(
          `INSERT INTO commission_payments (commission_id, amount, received, paid_at, note) VALUES (?, ?, NULL, ?, ?);`,
          [commission.id, commission.price, commission.created_at.slice(0, 10), "Imported from Paid tag"],
        );
      }
    }

    for (const tag of paymentTags) {
      await database.execute(`DELETE FROM commission_tags WHERE tag_id = ?;`, [tag.id]);
      await database.execute(`DELETE FROM tags WHERE id = ?;`, [tag.id]);
    }
  });
}

export type CommissionCorrection = {
  id: number;
  commission_id: number;
  stage_id: number;
  text: string;
  created_at: string;
};

export async function getAllCorrections(): Promise<CommissionCorrection[]> {
  const database = await getDatabase();

  return await database.select<CommissionCorrection[]>(
    `SELECT id, commission_id, stage_id, text, created_at FROM commission_corrections ORDER BY created_at ASC, id ASC;`,
  );
}

export async function addCorrection(commissionId: number, stageId: number, text: string): Promise<void> {
  const database = await getDatabase();
  const cleanText = text.trim();

  if (!cleanText) {
    throw new Error("Write what the client asked to change");
  }

  await database.execute(
    `INSERT INTO commission_corrections (commission_id, stage_id, text, created_at) VALUES (?, ?, ?, ?);`,
    [commissionId, stageId, cleanText, new Date().toISOString()],
  );
}

export async function deleteCorrection(correctionId: number): Promise<void> {
  const database = await getDatabase();

  await database.execute(`DELETE FROM commission_corrections WHERE id = ?;`, [correctionId]);
}

export type PaymentPlatform = {
  id: number;
  name: string;
  /** 3.4 = 3,4 % */
  percent: number;
  /** Parte fija por pago, en la moneda del pago */
  fixed: number;
};

export async function getPaymentPlatforms(): Promise<PaymentPlatform[]> {
  const database = await getDatabase();

  return await database.select<PaymentPlatform[]>(
    `SELECT id, name, percent, fixed FROM payment_platforms ORDER BY id ASC;`,
  );
}

/** Se guarda la lista entera: ningún pago apunta a una plataforma por id (usan la nota) */
export async function savePaymentPlatforms(platforms: Omit<PaymentPlatform, "id">[]): Promise<void> {
  await runSerialized(async (database) => {
    await database.execute(`DELETE FROM payment_platforms;`);

    for (const platform of platforms.filter((item) => item.name.trim())) {
      await database.execute(`INSERT INTO payment_platforms (name, percent, fixed) VALUES (?, ?, ?);`, [
        platform.name.trim(),
        platform.percent,
        platform.fixed,
      ]);
    }
  });
}
