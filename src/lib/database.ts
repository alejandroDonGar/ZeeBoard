import Database from "@tauri-apps/plugin-sql";

type ZeeDatabase = Awaited<ReturnType<typeof Database.load>>;

let db: ZeeDatabase | null = null;

export type Template = {
  id: number;
  name: string;
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
  return db;
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
    CREATE TABLE IF NOT EXISTS templates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL
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
}

export async function getTemplates(): Promise<Template[]> {
  const database = await getDatabase();

  return await database.select<Template[]>(`
    SELECT id, name
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
  const database = await getDatabase();

  const templateName = name.trim();
  const templateStages = stages
    .map((stage) => stage.trim())
    .filter(Boolean);

  if (!templateName) {
    throw new Error("Template name is required");
  }

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
}

export async function deleteTemplate(templateId: number): Promise<void> {
  const database = await getDatabase();

  await database.execute(
    `
    DELETE FROM template_stages
    WHERE template_id = ?;
    `,
    [templateId],
  );

  await database.execute(
    `
    DELETE FROM templates
    WHERE id = ?;
    `,
    [templateId],
  );
}

export async function duplicateTemplate(templateId: number): Promise<void> {
  const database = await getDatabase();

  const templates = await database.select<Template[]>(
    `
    SELECT id, name
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
    INSERT INTO templates (name)
    VALUES (?);
    `,
    [`${sourceTemplate.name} Copy`],
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

export async function replaceTemplateStages(
  templateId: number,
  stages: string[],
): Promise<void> {
  const database = await getDatabase();

  const cleanStages = stages
    .map((stage) => stage.trim())
    .filter(Boolean);

  await database.execute(
    `
    DELETE FROM template_stages
    WHERE template_id = ?;
    `,
    [templateId],
  );

  for (let index = 0; index < cleanStages.length; index++) {
    await database.execute(
      `
      INSERT INTO template_stages (template_id, name, stage_order)
      VALUES (?, ?, ?);
      `,
      [templateId, cleanStages[index], index + 1],
    );
  }
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
  clientName: string,
  platform: string,
  templateId: number | null,
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

  let firstStageId: number | null = null;

  if (templateId) {
    const stages = await getTemplateStages(templateId);
    firstStageId = stages.length > 0 ? stages[0].id : null;
  }

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
      cleanTitle,
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
}

export async function updateCommissionStage(
  commissionId: number,
  stageId: number | null,
): Promise<void> {
  const database = await getDatabase();

  await database.execute(
    `
    UPDATE commissions
    SET current_stage_id = ?
    WHERE id = ?;
    `,
    [stageId, commissionId],
  );
}