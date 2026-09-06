/** SqliteStore — wraps better-sqlite3 / sql.js adapter from ../db.js */

const { getDb } = require("../db");

class SqliteStore {
  constructor(db) {
    this.db = db;
    this.driver = "sqlite";
  }

  async ping() {
    try {
      this.db.prepare("SELECT 1 AS n").get();
      return true;
    } catch {
      return false;
    }
  }

  async listCafes() {
    return this.db
      .prepare("SELECT slug, name, tagline, currency, country, tax_name, tax_rate, accent_color FROM cafes ORDER BY name")
      .all();
  }

  async getCafeBySlug(slug) {
    return this.db.prepare("SELECT * FROM cafes WHERE slug = ?").get(slug) || null;
  }

  async createCafe(row) {
    this.db
      .prepare(
        `INSERT INTO cafes (slug, name, tagline, accent_color, hours, address, table_count, cash_only, currency, country, tax_name, tax_rate, alt_milk_price, extra_shot_price, owner_pin, staff_pin, ordering_enabled)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
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
        row.ordering_enabled ?? 1
      );
    return this.getCafeBySlug(row.slug);
  }

  async updateCafe(id, fields) {
    this.db
      .prepare(
        `UPDATE cafes SET
          name = COALESCE(?, name),
          tagline = COALESCE(?, tagline),
          accent_color = COALESCE(?, accent_color),
          hours = COALESCE(?, hours),
          address = COALESCE(?, address),
          table_count = COALESCE(?, table_count),
          cash_only = COALESCE(?, cash_only),
          currency = COALESCE(?, currency),
          country = COALESCE(?, country),
          tax_name = COALESCE(?, tax_name),
          tax_rate = COALESCE(?, tax_rate),
          alt_milk_price = COALESCE(?, alt_milk_price),
          extra_shot_price = COALESCE(?, extra_shot_price),
          ordering_enabled = COALESCE(?, ordering_enabled)
         WHERE id = ?`
      )
      .run(
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
        id
      );
    return this.db.prepare("SELECT * FROM cafes WHERE id = ?").get(id);
  }

  async deleteCafeCascade(cafeId) {
    this.db.prepare("DELETE FROM orders WHERE cafe_id = ?").run(cafeId);
    this.db.prepare("DELETE FROM items WHERE cafe_id = ?").run(cafeId);
    this.db.prepare("DELETE FROM categories WHERE cafe_id = ?").run(cafeId);
    this.db.prepare("DELETE FROM cafes WHERE id = ?").run(cafeId);
  }

  async countCafes() {
    const r = this.db.prepare("SELECT COUNT(*) as n FROM cafes").get();
    return Number(r?.n || 0);
  }

  async listCategories(cafeId) {
    return this.db
      .prepare("SELECT * FROM categories WHERE cafe_id = ? ORDER BY sort, name")
      .all(cafeId);
  }

  async getCategory(id, cafeId) {
    return this.db.prepare("SELECT * FROM categories WHERE id = ? AND cafe_id = ?").get(id, cafeId) || null;
  }

  async maxCategorySort(cafeId) {
    const r = this.db.prepare("SELECT MAX(sort) as m FROM categories WHERE cafe_id = ?").get(cafeId);
    return r && r.m ? Number(r.m) : 0;
  }

  async createCategory(row) {
    this.db
      .prepare(`INSERT INTO categories (id, cafe_id, name, sort) VALUES (?, ?, ?, ?)`)
      .run(row.id, row.cafe_id, row.name, row.sort);
    return { id: row.id, name: row.name, sort: row.sort };
  }

  async updateCategory(id, cafeId, fields) {
    const row = await this.getCategory(id, cafeId);
    if (!row) return null;
    const name = fields.name !== undefined ? String(fields.name) : row.name;
    const sort = fields.sort !== undefined ? Number(fields.sort) : row.sort;
    this.db.prepare("UPDATE categories SET name = ?, sort = ? WHERE id = ?").run(name, sort, id);
    return { id, name, sort };
  }

  async deleteCategory(id, cafeId) {
    this.db.prepare("DELETE FROM items WHERE category_id = ? AND cafe_id = ?").run(id, cafeId);
    this.db.prepare("DELETE FROM categories WHERE id = ?").run(id);
  }

  async listItems(cafeId, { activeOnly = false } = {}) {
    if (activeOnly) {
      return this.db
        .prepare("SELECT * FROM items WHERE cafe_id = ? AND active = 1 ORDER BY name")
        .all(cafeId);
    }
    return this.db.prepare("SELECT * FROM items WHERE cafe_id = ? ORDER BY name").all(cafeId);
  }

  async getItem(id, cafeId) {
    return this.db.prepare("SELECT * FROM items WHERE id = ? AND cafe_id = ?").get(id, cafeId) || null;
  }

  async createItem(row) {
    this.db
      .prepare(
        `INSERT INTO items (id, cafe_id, category_id, name, description, price, prep_minutes, tags, image, has_milk, has_extra_shot, modifiers, active, available)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
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
        row.available ?? 1
      );
    return this.db.prepare("SELECT * FROM items WHERE id = ?").get(row.id);
  }

  async updateItem(id, cafeId, fields) {
    const row = await this.getItem(id, cafeId);
    if (!row) return null;
    this.db
      .prepare(
        `UPDATE items SET
          category_id = ?, name = ?, description = ?, price = ?, prep_minutes = ?,
          tags = ?, image = ?, has_milk = ?, has_extra_shot = ?, modifiers = ?, active = ?, available = ?
         WHERE id = ?`
      )
      .run(
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
        id
      );
    return this.db.prepare("SELECT * FROM items WHERE id = ?").get(id);
  }

  async deleteItem(id) {
    this.db.prepare("DELETE FROM items WHERE id = ?").run(id);
  }

  async listOrders(cafeId) {
    return this.db
      .prepare("SELECT * FROM orders WHERE cafe_id = ? ORDER BY created_at DESC")
      .all(cafeId);
  }

  async getOrder(id, cafeId) {
    return this.db.prepare("SELECT * FROM orders WHERE id = ? AND cafe_id = ?").get(id, cafeId) || null;
  }

  async orderIdExists(id) {
    return !!this.db.prepare("SELECT id FROM orders WHERE id = ?").get(id);
  }

  async createOrder(row) {
    this.db
      .prepare(
        `INSERT INTO orders (id, cafe_id, table_no, guest_name, phone, notes, items, subtotal, tax, tax_name, total, status, estimated_wait, confirm_code, dining_option, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
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
        row.updated_at
      );
    return this.db.prepare("SELECT * FROM orders WHERE id = ?").get(row.id);
  }

  async updateOrderStatus(id, cafeId, status, updatedAt) {
    this.db.prepare("UPDATE orders SET status = ?, updated_at = ? WHERE id = ? AND cafe_id = ?").run(status, updatedAt, id, cafeId);
    return this.getOrder(id, cafeId);
  }

  async deleteOrder(id) {
    this.db.prepare("DELETE FROM orders WHERE id = ?").run(id);
  }
}

async function createSqliteStore() {
  const db = await getDb();
  return new SqliteStore(db);
}

module.exports = { SqliteStore, createSqliteStore };
