import Database from "@tauri-apps/plugin-sql";
import { saveImageFile, deleteImageFile } from "./images";

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
    ALTER TABLE tags
    ADD COLUMN category TEXT DEFAULT 'General';
  `).catch(() => {});

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

  await database.execute(`
    CREATE TABLE IF NOT EXISTS commission_references (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      commission_id INTEGER NOT NULL,
      label TEXT NOT NULL DEFAULT 'Reference',
      image_data_url TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  `);

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

  const lastStages = await database.select<{ id: number }[]>(
    `
    SELECT id
    FROM template_stages
    WHERE template_id = ?
    ORDER BY stage_order DESC
    LIMIT 1;
    `,
    [templateId],
  );

  const lastStageId = lastStages.length > 0 ? lastStages[0].id : null;

  const activeCommissionsUsingTemplate = await database.select<{ count: number }[]>(
    lastStageId
      ? `
        SELECT COUNT(*) as count
        FROM commissions
        WHERE template_id = ?
          AND (current_stage_id IS NULL OR current_stage_id != ?);
        `
      : `
        SELECT COUNT(*) as count
        FROM commissions
        WHERE template_id = ?;
        `,
    lastStageId ? [templateId, lastStageId] : [templateId],
  );

  if (activeCommissionsUsingTemplate[0].count > 0) {
    throw new Error(
      "This template is in use by one or more active commissions and cannot be deleted.",
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
  const cleanStages = stages
    .map((stage) => stage.trim())
    .filter(Boolean);

  await runSerialized(async (database) => {
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
    `DELETE FROM commission_stage_images WHERE commission_id = ?;`,
    [commissionId],
  );

  await database.execute(
    `DELETE FROM commission_references WHERE commission_id = ?;`,
    [commissionId],
  );

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
  const database = await getDatabase();

  await database.execute(
    `
    DELETE FROM tags
    WHERE id = ?;
    `,
    [tagId],
  );
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

  await database.execute(
    `
    DELETE FROM character_references
    WHERE character_id = ?;
    `,
    [characterId],
  );

  await database.execute(
    `
    DELETE FROM commission_characters
    WHERE character_id = ?;
    `,
    [characterId],
  );

  await database.execute(
    `
    DELETE FROM client_characters
    WHERE id = ?;
    `,
    [characterId],
  );
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
  imageDataUrl: string,
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
  const imagePath = await saveImageFile(imageDataUrl);

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

  if (references.length > 0) {
    await deleteImageFile(references[0].image_data_url);
  }

  await database.execute(
    `
    DELETE FROM character_references
    WHERE id = ?;
    `,
    [referenceId],
  );
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

export type CommissionReference = {
  id: number;
  commission_id: number;
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
  imageDataUrl: string,
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
  const imagePath = await saveImageFile(imageDataUrl);

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

  if (images.length > 0) {
    await deleteImageFile(images[0].image_data_url);
  }

  await database.execute(
    `
    DELETE FROM commission_stage_images
    WHERE id = ?;
    `,
    [imageId],
  );
}

export async function getCommissionReferences(
  commissionId: number,
): Promise<CommissionReference[]> {
  const database = await getDatabase();

  return await database.select<CommissionReference[]>(
    `
    SELECT id, commission_id, label, image_data_url, created_at
    FROM commission_references
    WHERE commission_id = ?
    ORDER BY id ASC;
    `,
    [commissionId],
  );
}

export async function createCommissionReference(
  commissionId: number,
  imageDataUrl: string,
): Promise<void> {
  const database = await getDatabase();

  const existingReferences = await database.select<{ count: number }[]>(
    `
    SELECT COUNT(*) as count
    FROM commission_references
    WHERE commission_id = ?;
    `,
    [commissionId],
  );

  const referenceNumber = existingReferences[0].count + 1;
  const label = `Reference ${referenceNumber}`;

  await database.execute(
    `
    INSERT INTO commission_references (
      commission_id,
      label,
      image_data_url,
      created_at
    )
    VALUES (?, ?, ?, ?);
    `,
    [
      commissionId,
      label,
      imageDataUrl,
      new Date().toISOString(),
    ],
  );
}

export async function deleteCommissionReference(
  referenceId: number,
): Promise<void> {
  const database = await getDatabase();

  await database.execute(
    `
    DELETE FROM commission_references
    WHERE id = ?;
    `,
    [referenceId],
  );
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