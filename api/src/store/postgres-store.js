/** PostgresStore — durable store when DATABASE_URL is set (Neon / Vercel Postgres / any Postgres). */

const { Pool } = require("pg");

const SCHEMA = `
CREATE TABLE IF NOT EXISTS cafes (
  id SERIAL PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  tagline TEXT DEFAULT '',
  accent_color TEXT DEFAULT '#E8B62C',
  hours TEXT DEFAULT '',
  address TEXT DEFAULT '',
  table_count INTEGER DEFAULT 8,
  cash_only INTEGER DEFAULT 1,
  currency TEXT DEFAULT 'USD',
  country TEXT DEFAULT 'US',
  tax_name TEXT DEFAULT 'Tax',
  tax_rate DOUBLE PRECISION DEFAULT 0.08,
  alt_milk_price DOUBLE PRECISION,
  extra_shot_price DOUBLE PRECISION,
  owner_pin TEXT DEFAULT '1234',
  staff_pin TEXT DEFAULT '1234',
  ordering_enabled INTEGER DEFAULT 1,
  updated_at BIGINT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,
  cafe_id INTEGER NOT NULL REFERENCES cafes(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sort INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS items (
  id TEXT PRIMARY KEY,
  cafe_id INTEGER NOT NULL REFERENCES cafes(id) ON DELETE CASCADE,
  category_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  price DOUBLE PRECISION NOT NULL,
  prep_minutes INTEGER DEFAULT 5,
  tags TEXT DEFAULT '[]',
  image TEXT DEFAULT '',
  has_milk INTEGER DEFAULT 0,
  has_extra_shot INTEGER DEFAULT 0,
  modifiers TEXT DEFAULT '[]',
  active INTEGER DEFAULT 1,
  available INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  cafe_id INTEGER NOT NULL REFERENCES cafes(id) ON DELETE CASCADE,
  table_no TEXT NOT NULL,
  guest_name TEXT DEFAULT 'Guest',
  phone TEXT DEFAULT '',
  notes TEXT DEFAULT '',
  items TEXT NOT NULL,
  subtotal DOUBLE PRECISION NOT NULL,
  tax DOUBLE PRECISION NOT NULL,
  tax_name TEXT DEFAULT '',
  total DOUBLE PRECISION NOT NULL,
  status TEXT DEFAULT 'new',
  estimated_wait INTEGER DEFAULT 5,
  confirm_code TEXT DEFAULT '',
  dining_option TEXT DEFAULT 'dine_in',
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_categories_cafe ON categories(cafe_id);
CREATE INDEX IF NOT EXISTS idx_items_cafe ON items(cafe_id);
CREATE INDEX IF NOT EXISTS idx_orders_cafe ON orders(cafe_id);
`;

function normalizeCafe(row) {
  if (!row) return null;
  return {
    ...row,
    cash_only: Number(row.cash_only),
    table_count: Number(row.table_count),
    ordering_enabled: Number(row.ordering_enabled),
    tax_rate: row.tax_rate === undefined || row.tax_rate === null ? 0.08 : Number(row.tax_rate),
    alt_milk_price: row.alt_milk_price === undefined || row.alt_milk_price === null ? null : Number(row.alt_milk_price),
    extra_shot_price: row.extra_shot_price === undefined || row.extra_shot_price === null ? null : Number(row.extra_shot_price),
    country: row.country || "US",
    tax_name: row.tax_name || "Tax",
    created_at: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
    updated_at: row.updated_at === undefined || row.updated_at === null ? 0 : Number(row.updated_at),
  };
}

function normalizeItem(row) {
  if (!row) return null;
  return {
    ...row,
    price: Number(row.price),
    prep_minutes: Number(row.prep_minutes),
    has_milk: Number(row.has_milk),
    has_extra_shot: Number(row.has_extra_shot),
    active: Number(row.active),
    available: Number(row.available),
  };
}

function normalizeOrder(row) {
  if (!row) return null;
  return {
    ...row,
    subtotal: Number(row.subtotal),
    tax: Number(row.tax),
    tax_name: row.tax_name || "",
    total: Number(row.total),
    estimated_wait: Number(row.estimated_wait),
    created_at: Number(row.created_at),
    updated_at: Number(row.updated_at),
  };
}

class PostgresStore {
  constructor(pool) {
    this.pool = pool;
    this.driver = "postgres";
  }

  async query(text, params = []) {
    return this.pool.query(text, params);
  }

  async ping() {
    try {
      await this.query("SELECT 1 AS n");
      return true;
    } catch {
      return false;
    }
  }

  async migrate() {
    await this.query(SCHEMA);
    // Additive column safety for older Neon DBs created mid-upgrade
    const alters = [
      `ALTER TABLE cafes ADD COLUMN IF NOT EXISTS ordering_enabled INTEGER DEFAULT 1`,
      `ALTER TABLE cafes ADD COLUMN IF NOT EXISTS country TEXT DEFAULT 'US'`,
      `ALTER TABLE cafes ADD COLUMN IF NOT EXISTS tax_name TEXT DEFAULT 'Tax'`,
      `ALTER TABLE cafes ADD COLUMN IF NOT EXISTS tax_rate DOUBLE PRECISION DEFAULT 0.08`,
      `ALTER TABLE cafes ADD COLUMN IF NOT EXISTS alt_milk_price DOUBLE PRECISION`,
      `ALTER TABLE cafes ADD COLUMN IF NOT EXISTS extra_shot_price DOUBLE PRECISION`,
      `ALTER TABLE cafes ADD COLUMN IF NOT EXISTS updated_at BIGINT DEFAULT 0`,
      `ALTER TABLE items ADD COLUMN IF NOT EXISTS available INTEGER DEFAULT 1`,
      `ALTER TABLE items ADD COLUMN IF NOT EXISTS modifiers TEXT DEFAULT '[]'`,
      `ALTER TABLE orders ADD COLUMN IF NOT EXISTS confirm_code TEXT DEFAULT ''`,
      `ALTER TABLE orders ADD COLUMN IF NOT EXISTS dining_option TEXT DEFAULT 'dine_in'`,
      `ALTER TABLE orders ADD COLUMN IF NOT EXISTS tax_name TEXT DEFAULT ''`,
    ];
    for (const sql of alters) {
      try {
        await this.query(sql);
      } catch (_) {}
    }
    try {
      await this.query(
        `UPDATE cafes SET country = 'IN', tax_name = 'GST', tax_rate = 0.05
         WHERE currency = 'INR' AND (country IS NULL OR country = '' OR country = 'US')
           AND (tax_name IS NULL OR tax_name = '' OR tax_name = 'Tax')`
      );
      await this.query(`UPDATE cafes SET country = 'NP', tax_name = 'VAT', tax_rate = 0.13 WHERE currency = 'NPR'`);
    } catch (_) {}

    // Backfill structured modifiers from legacy flags when empty
    try {
      const { modifiersFromFlags, parseModifiers, serializeModifiers } = require("../modifiers");
      const cafes = (await this.query("SELECT id, currency FROM cafes")).rows;
      const cafeCur = Object.fromEntries(cafes.map((c) => [c.id, c.currency]));
      const items = (await this.query("SELECT id, cafe_id, has_milk, has_extra_shot, modifiers FROM items")).rows;
      for (const it of items) {
        const existing = parseModifiers(it.modifiers);
        if (existing.length) continue;
        if (!Number(it.has_milk) && !Number(it.has_extra_shot)) continue;
        const mods = modifiersFromFlags(!!Number(it.has_milk), !!Number(it.has_extra_shot), cafeCur[it.cafe_id]);
        if (mods.length) {
          await this.query("UPDATE items SET modifiers = $1 WHERE id = $2", [serializeModifiers(mods), it.id]);
        }
      }
    } catch (_) {}
  }

  async listCafes() {
    const { rows } = await this.query(
      "SELECT slug, name, tagline, currency, country, tax_name, tax_rate, accent_color FROM cafes ORDER BY name"
    );
    return rows;
  }

  async getCafeBySlug(slug) {
    const { rows } = await this.query("SELECT * FROM cafes WHERE slug = $1", [slug]);
    return normalizeCafe(rows[0] || null);
  }

  async createCafe(row) {
    await this.query(
      `INSERT INTO cafes (slug, name, tagline, accent_color, hours, address, table_count, cash_only, currency, country, tax_name, tax_rate, alt_milk_price, extra_shot_price, owner_pin, staff_pin, ordering_enabled, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)`,
      [
        row.slug,
        row.name,
        row.tagline ?? "",
        row.accent_color ?? "#E8B62C",
        row.hours ?? "",
        row.address ?? "",
        row.table_count ?? 8,
        row.cash_only ?? 1,
        row.currency ?? "USD",
        row.country ?? "US",
        row.tax_name ?? "Tax",
        row.tax_rate ?? 0.08,
        row.alt_milk_price ?? null,
        row.extra_shot_price ?? null,
        row.owner_pin ?? "1234",
        row.staff_pin ?? "1234",
        row.ordering_enabled ?? 1,
        row.updated_at ?? Date.now(),
      ]
    );
    return this.getCafeBySlug(row.slug);
  }

  async updateCafe(id, fields) {
    await this.query(
      `UPDATE cafes SET
        name = COALESCE($1, name),
        tagline = COALESCE($2, tagline),
        accent_color = COALESCE($3, accent_color),
        hours = COALESCE($4, hours),
        address = COALESCE($5, address),
        table_count = COALESCE($6, table_count),
        cash_only = COALESCE($7, cash_only),
        currency = COALESCE($8, currency),
        country = COALESCE($9, country),
        tax_name = COALESCE($10, tax_name),
        tax_rate = COALESCE($11, tax_rate),
        alt_milk_price = COALESCE($12, alt_milk_price),
        extra_shot_price = COALESCE($13, extra_shot_price),
        ordering_enabled = COALESCE($14, ordering_enabled),
        updated_at = $15
       WHERE id = $16`,
      [
        fields.name ?? null,
        fields.tagline ?? null,
        fields.accent_color ?? null,
        fields.hours ?? null,
        fields.address ?? null,
        fields.table_count ?? null,
        fields.cash_only ?? null,
        fields.currency ?? null,
        fields.country ?? null,
        fields.tax_name ?? null,
        fields.tax_rate ?? null,
        fields.alt_milk_price ?? null,
        fields.extra_shot_price ?? null,
        fields.ordering_enabled ?? null,
        Date.now(),
        id,
      ]
    );
    const { rows } = await this.query("SELECT * FROM cafes WHERE id = $1", [id]);
    return normalizeCafe(rows[0]);
  }

  async touchCafe(cafeId) {
    await this.query("UPDATE cafes SET updated_at = $1 WHERE id = $2", [Date.now(), cafeId]);
  }

  async deleteCafeCascade(cafeId) {
    await this.query("DELETE FROM orders WHERE cafe_id = $1", [cafeId]);
    await this.query("DELETE FROM items WHERE cafe_id = $1", [cafeId]);
    await this.query("DELETE FROM categories WHERE cafe_id = $1", [cafeId]);
    await this.query("DELETE FROM cafes WHERE id = $1", [cafeId]);
  }

  async countCafes() {
    const { rows } = await this.query("SELECT COUNT(*)::int AS n FROM cafes");
    return Number(rows[0]?.n || 0);
  }

  async listCategories(cafeId) {
    const { rows } = await this.query(
      "SELECT * FROM categories WHERE cafe_id = $1 ORDER BY sort, name",
      [cafeId]
    );
    return rows;
  }

  async getCategory(id, cafeId) {
    const { rows } = await this.query("SELECT * FROM categories WHERE id = $1 AND cafe_id = $2", [
      id,
      cafeId,
    ]);
    return rows[0] || null;
  }

  async maxCategorySort(cafeId) {
    const { rows } = await this.query("SELECT MAX(sort) AS m FROM categories WHERE cafe_id = $1", [
      cafeId,
    ]);
    return rows[0]?.m ? Number(rows[0].m) : 0;
  }

  async createCategory(row) {
    await this.query(`INSERT INTO categories (id, cafe_id, name, sort) VALUES ($1,$2,$3,$4)`, [
      row.id,
      row.cafe_id,
      row.name,
      row.sort,
    ]);
    return { id: row.id, name: row.name, sort: row.sort };
  }

  async updateCategory(id, cafeId, fields) {
    const row = await this.getCategory(id, cafeId);
    if (!row) return null;
    const name = fields.name !== undefined ? String(fields.name) : row.name;
    const sort = fields.sort !== undefined ? Number(fields.sort) : row.sort;
    await this.query("UPDATE categories SET name = $1, sort = $2 WHERE id = $3", [name, sort, id]);
    return { id, name, sort };
  }

  async deleteCategory(id, cafeId) {
    await this.query("DELETE FROM items WHERE category_id = $1 AND cafe_id = $2", [id, cafeId]);
    await this.query("DELETE FROM categories WHERE id = $1", [id]);
  }

  async listItems(cafeId, { activeOnly = false } = {}) {
    const q = activeOnly
      ? "SELECT * FROM items WHERE cafe_id = $1 AND active = 1 ORDER BY name"
      : "SELECT * FROM items WHERE cafe_id = $1 ORDER BY name";
    const { rows } = await this.query(q, [cafeId]);
    return rows.map(normalizeItem);
  }

  async getItem(id, cafeId) {
    const { rows } = await this.query("SELECT * FROM items WHERE id = $1 AND cafe_id = $2", [
      id,
      cafeId,
    ]);
    return normalizeItem(rows[0] || null);
  }

  async createItem(row) {
    await this.query(
      `INSERT INTO items (id, cafe_id, category_id, name, description, price, prep_minutes, tags, image, has_milk, has_extra_shot, modifiers, active, available)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
      [
        row.id,
        row.cafe_id,
        row.category_id,
        row.name,
        row.description ?? "",
        row.price ?? 0,
        row.prep_minutes ?? 5,
        typeof row.tags === "string" ? row.tags : JSON.stringify(row.tags || []),
        row.image ?? "",
        row.has_milk ?? 0,
        row.has_extra_shot ?? 0,
        typeof row.modifiers === "string" ? row.modifiers : JSON.stringify(row.modifiers || []),
        row.active ?? 1,
        row.available ?? 1,
      ]
    );
    const { rows } = await this.query("SELECT * FROM items WHERE id = $1", [row.id]);
    return normalizeItem(rows[0]);
  }

  async updateItem(id, cafeId, fields) {
    const row = await this.getItem(id, cafeId);
    if (!row) return null;
    await this.query(
      `UPDATE items SET
        category_id = $1, name = $2, description = $3, price = $4, prep_minutes = $5,
        tags = $6, image = $7, has_milk = $8, has_extra_shot = $9, modifiers = $10, active = $11, available = $12
       WHERE id = $13`,
      [
        fields.category_id,
        fields.name,
        fields.description,
        fields.price,
        fields.prep_minutes,
        fields.tags,
        fields.image,
        fields.has_milk,
        fields.has_extra_shot,
        typeof fields.modifiers === "string" ? fields.modifiers : JSON.stringify(fields.modifiers || []),
        fields.active,
        fields.available,
        id,
      ]
    );
    const { rows } = await this.query("SELECT * FROM items WHERE id = $1", [id]);
    return normalizeItem(rows[0]);
  }

  async deleteItem(id) {
    await this.query("DELETE FROM items WHERE id = $1", [id]);
  }

  async listOrders(cafeId) {
    const { rows } = await this.query(
      "SELECT * FROM orders WHERE cafe_id = $1 ORDER BY created_at DESC",
      [cafeId]
    );
    return rows.map(normalizeOrder);
  }

  async getOrder(id, cafeId) {
    const { rows } = await this.query("SELECT * FROM orders WHERE id = $1 AND cafe_id = $2", [
      id,
      cafeId,
    ]);
    return normalizeOrder(rows[0] || null);
  }

  async orderIdExists(id) {
    const { rows } = await this.query("SELECT id FROM orders WHERE id = $1", [id]);
    return !!rows[0];
  }

  async createOrder(row) {
    await this.query(
      `INSERT INTO orders (id, cafe_id, table_no, guest_name, phone, notes, items, subtotal, tax, tax_name, total, status, estimated_wait, confirm_code, dining_option, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)`,
      [
        row.id,
        row.cafe_id,
        row.table_no,
        row.guest_name,
        row.phone ?? "",
        row.notes ?? "",
        typeof row.items === "string" ? row.items : JSON.stringify(row.items || []),
        row.subtotal,
        row.tax,
        row.tax_name ?? "",
        row.total,
        row.status ?? "new",
        row.estimated_wait ?? 5,
        row.confirm_code ?? "",
        row.dining_option ?? "dine_in",
        row.created_at,
        row.updated_at,
      ]
    );
    const { rows } = await this.query("SELECT * FROM orders WHERE id = $1", [row.id]);
    return normalizeOrder(rows[0]);
  }

  async updateOrderStatus(id, cafeId, status, updatedAt) {
    await this.query(
      "UPDATE orders SET status = $1, updated_at = $2 WHERE id = $3 AND cafe_id = $4",
      [status, updatedAt, id, cafeId]
    );
    return this.getOrder(id, cafeId);
  }

  async deleteOrder(id) {
    await this.query("DELETE FROM orders WHERE id = $1", [id]);
  }
}

async function createPostgresStore(connectionString) {
  const pool = new Pool({
    connectionString,
    ssl: /localhost|127\.0\.0\.1/.test(connectionString)
      ? false
      : { rejectUnauthorized: false },
    max: 3,
    idleTimeoutMillis: 10000,
    connectionTimeoutMillis: 10000,
  });
  const store = new PostgresStore(pool);
  await store.migrate();
  console.log("[db] postgres @ DATABASE_URL");
  return store;
}

module.exports = { PostgresStore, createPostgresStore };
