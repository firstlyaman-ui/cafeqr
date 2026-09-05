const express = require("express");
const cors = require("cors");
const { getDb } = require("./db");
const { seed } = require("./seed");

const PORT = process.env.PORT || 8787;
const TAX_RATE = 0.08;

function slugify(s) {
  return String(s || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
}

function orderPrefix(slug) {
  const parts = String(slug).split("-").filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return String(slug).slice(0, 2).toUpperCase() || "CQ";
}

function mapCafe(row) {
  if (!row) return null;
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    tagline: row.tagline || "",
    accentColor: row.accent_color || "#E8B62C",
    hours: row.hours || "",
    address: row.address || "",
    tableCount: row.table_count || 8,
    cashOnly: !!row.cash_only,
    currency: row.currency || "USD",
    createdAt: row.created_at,
  };
}

function mapCategory(row) {
  return { id: row.id, name: row.name, sort: row.sort };
}

function mapItem(row) {
  let tags = [];
  try {
    tags = JSON.parse(row.tags || "[]");
  } catch (_) {}
  return {
    id: row.id,
    categoryId: row.category_id,
    name: row.name,
    description: row.description || "",
    price: row.price,
    prepMinutes: row.prep_minutes,
    tags,
    image: row.image || "",
    hasMilk: !!row.has_milk,
    hasExtraShot: !!row.has_extra_shot,
    active: row.active === undefined ? true : !!row.active,
  };
}

function mapOrder(row) {
  let items = [];
  try {
    items = JSON.parse(row.items || "[]");
  } catch (_) {}
  return {
    id: row.id,
    cafeId: row.cafe_id,
    table: row.table_no,
    guestName: row.guest_name,
    phone: row.phone || "",
    notes: row.notes || "",
    items,
    subtotal: row.subtotal,
    tax: row.tax,
    total: row.total,
    status: row.status,
    estimatedWait: row.estimated_wait,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    payCash: true,
  };
}

function getCafeBySlug(db, slug) {
  return db.prepare("SELECT * FROM cafes WHERE slug = ?").get(slug);
}

function requireOwner(db, req, res, slug) {
  const cafe = getCafeBySlug(db, slug);
  if (!cafe) {
    res.status(404).json({ error: "Cafe not found" });
    return null;
  }
  const pin = req.header("X-Owner-Pin") || "";
  if (pin !== cafe.owner_pin) {
    res.status(401).json({ error: "Invalid owner PIN" });
    return null;
  }
  return cafe;
}

function requireStaff(db, req, res, slug) {
  const cafe = getCafeBySlug(db, slug);
  if (!cafe) {
    res.status(404).json({ error: "Cafe not found" });
    return null;
  }
  const pin = req.header("X-Staff-Pin") || "";
  if (pin !== cafe.staff_pin) {
    res.status(401).json({ error: "Invalid staff PIN" });
    return null;
  }
  return cafe;
}

function nid(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

let cachedApp = null;

async function createApp() {
  if (cachedApp) return cachedApp;
  const db = await getDb();
  await seed();

  const app = express();
  app.use(cors({ origin: true }));
  app.use(express.json({ limit: "2mb" }));

  app.get("/health", (_req, res) => {
    res.json({ ok: true, service: "cafeqr-api", time: Date.now() });
  });

  // Public cafe list for pitch page
  app.get("/cafes", (_req, res) => {
    const rows = db.prepare("SELECT slug, name, tagline, currency, accent_color FROM cafes ORDER BY name").all();
    res.json(
      rows.map((r) => ({
        slug: r.slug,
        name: r.name,
        tagline: r.tagline,
        currency: r.currency,
        accentColor: r.accent_color,
      }))
    );
  });

  // Create cafe (signup) — default pins 1234
  app.post("/cafes", (req, res) => {
    const body = req.body || {};
    let slug = slugify(body.slug || body.name);
    if (!slug) return res.status(400).json({ error: "slug or name required" });
    if (getCafeBySlug(db, slug)) return res.status(409).json({ error: "Slug already taken" });

    const name = (body.name || slug).trim();
    const info = db
      .prepare(
        `INSERT INTO cafes (slug, name, tagline, accent_color, hours, address, table_count, cash_only, currency, owner_pin, staff_pin)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        slug,
        name,
        body.tagline || "",
        body.accentColor || body.accent_color || "#E8B62C",
        body.hours || "",
        body.address || "",
        Math.max(1, Math.min(48, Number(body.tableCount || body.table_count) || 8)),
        body.cashOnly === false || body.cash_only === 0 ? 0 : 1,
        body.currency || "USD",
        body.ownerPin || body.owner_pin || "1234",
        body.staffPin || body.staff_pin || "1234"
      );

    const cafe = getCafeBySlug(db, slug);
    // default category
    db.prepare(`INSERT INTO categories (id, cafe_id, name, sort) VALUES (?, ?, ?, ?)`).run(
      nid("cat"),
      cafe.id,
      "Menu",
      1
    );
    res.status(201).json(mapCafe(cafe));
  });

  // Cafe + menu
  app.get("/cafes/:slug", (req, res) => {
    const cafe = getCafeBySlug(db, req.params.slug);
    if (!cafe) return res.status(404).json({ error: "Cafe not found" });
    const categories = db
      .prepare("SELECT * FROM categories WHERE cafe_id = ? ORDER BY sort, name")
      .all(cafe.id)
      .map(mapCategory);
    const items = db
      .prepare("SELECT * FROM items WHERE cafe_id = ? AND active = 1 ORDER BY name")
      .all(cafe.id)
      .map(mapItem);
    res.json({ cafe: mapCafe(cafe), categories, items });
  });

  // Update profile
  app.patch("/cafes/:slug", (req, res) => {
    const cafe = requireOwner(db, req, res, req.params.slug);
    if (!cafe) return;
    const b = req.body || {};
    db.prepare(
      `UPDATE cafes SET
        name = COALESCE(?, name),
        tagline = COALESCE(?, tagline),
        accent_color = COALESCE(?, accent_color),
        hours = COALESCE(?, hours),
        address = COALESCE(?, address),
        table_count = COALESCE(?, table_count),
        cash_only = COALESCE(?, cash_only),
        currency = COALESCE(?, currency)
       WHERE id = ?`
    ).run(
      b.name !== undefined ? String(b.name) : null,
      b.tagline !== undefined ? String(b.tagline) : null,
      b.accentColor !== undefined ? String(b.accentColor) : b.accent_color !== undefined ? String(b.accent_color) : null,
      b.hours !== undefined ? String(b.hours) : null,
      b.address !== undefined ? String(b.address) : null,
      b.tableCount !== undefined ? Number(b.tableCount) : b.table_count !== undefined ? Number(b.table_count) : null,
      b.cashOnly !== undefined ? (b.cashOnly ? 1 : 0) : b.cash_only !== undefined ? Number(b.cash_only) : null,
      b.currency !== undefined ? String(b.currency) : null,
      cafe.id
    );
    res.json(mapCafe(getCafeBySlug(db, cafe.slug)));
  });

  // Verify pins
  app.post("/cafes/:slug/verify-owner", (req, res) => {
    const cafe = getCafeBySlug(db, req.params.slug);
    if (!cafe) return res.status(404).json({ error: "Cafe not found" });
    const pin = (req.body && req.body.pin) || "";
    res.json({ ok: pin === cafe.owner_pin });
  });

  app.post("/cafes/:slug/verify-staff", (req, res) => {
    const cafe = getCafeBySlug(db, req.params.slug);
    if (!cafe) return res.status(404).json({ error: "Cafe not found" });
    const pin = (req.body && req.body.pin) || "";
    res.json({ ok: pin === cafe.staff_pin });
  });

  // Categories
  app.post("/cafes/:slug/categories", (req, res) => {
    const cafe = requireOwner(db, req, res, req.params.slug);
    if (!cafe) return;
    const name = ((req.body && req.body.name) || "New category").trim();
    const maxSort = db.prepare("SELECT MAX(sort) as m FROM categories WHERE cafe_id = ?").get(cafe.id);
    const id = nid("cat");
    const sort = (maxSort && maxSort.m ? maxSort.m : 0) + 1;
    db.prepare(`INSERT INTO categories (id, cafe_id, name, sort) VALUES (?, ?, ?, ?)`).run(id, cafe.id, name, sort);
    res.status(201).json({ id, name, sort });
  });

  app.patch("/cafes/:slug/categories/:id", (req, res) => {
    const cafe = requireOwner(db, req, res, req.params.slug);
    if (!cafe) return;
    const row = db.prepare("SELECT * FROM categories WHERE id = ? AND cafe_id = ?").get(req.params.id, cafe.id);
    if (!row) return res.status(404).json({ error: "Category not found" });
    const name = req.body && req.body.name !== undefined ? String(req.body.name) : row.name;
    const sort = req.body && req.body.sort !== undefined ? Number(req.body.sort) : row.sort;
    db.prepare("UPDATE categories SET name = ?, sort = ? WHERE id = ?").run(name, sort, row.id);
    res.json({ id: row.id, name, sort });
  });

  app.delete("/cafes/:slug/categories/:id", (req, res) => {
    const cafe = requireOwner(db, req, res, req.params.slug);
    if (!cafe) return;
    const row = db.prepare("SELECT * FROM categories WHERE id = ? AND cafe_id = ?").get(req.params.id, cafe.id);
    if (!row) return res.status(404).json({ error: "Category not found" });
    db.prepare("DELETE FROM items WHERE category_id = ? AND cafe_id = ?").run(row.id, cafe.id);
    db.prepare("DELETE FROM categories WHERE id = ?").run(row.id);
    res.json({ ok: true });
  });

  // Items
  app.post("/cafes/:slug/items", (req, res) => {
    const cafe = requireOwner(db, req, res, req.params.slug);
    if (!cafe) return;
    const b = req.body || {};
    const id = b.id || nid("item");
    const categoryId = b.categoryId || b.category_id;
    if (!categoryId) return res.status(400).json({ error: "categoryId required" });
    if (!(b.name || "").toString().trim()) return res.status(400).json({ error: "name required" });
    const cat = db.prepare("SELECT id FROM categories WHERE id = ? AND cafe_id = ?").get(categoryId, cafe.id);
    if (!cat) return res.status(400).json({ error: "Invalid category" });
    db.prepare(
      `INSERT INTO items (id, cafe_id, category_id, name, description, price, prep_minutes, tags, image, has_milk, has_extra_shot, active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id,
      cafe.id,
      categoryId,
      (b.name || "Untitled").trim(),
      b.description || "",
      Number.isFinite(Number(b.price)) ? Math.max(0, Number(b.price)) : 0,
      Number.isFinite(Number(b.prepMinutes ?? b.prep_minutes)) ? Math.max(0, Number(b.prepMinutes ?? b.prep_minutes)) : 5,
      JSON.stringify(b.tags || []),
      b.image || "",
      b.hasMilk || b.has_milk ? 1 : 0,
      b.hasExtraShot || b.has_extra_shot ? 1 : 0,
      b.active === false ? 0 : 1
    );
    const row = db.prepare("SELECT * FROM items WHERE id = ?").get(id);
    res.status(201).json(mapItem(row));
  });

  app.patch("/cafes/:slug/items/:id", (req, res) => {
    const cafe = requireOwner(db, req, res, req.params.slug);
    if (!cafe) return;
    const row = db.prepare("SELECT * FROM items WHERE id = ? AND cafe_id = ?").get(req.params.id, cafe.id);
    if (!row) return res.status(404).json({ error: "Item not found" });
    const b = req.body || {};
    const categoryId = b.categoryId !== undefined ? b.categoryId : b.category_id !== undefined ? b.category_id : row.category_id;
    if (categoryId !== row.category_id) {
      const cat = db.prepare("SELECT id FROM categories WHERE id = ? AND cafe_id = ?").get(categoryId, cafe.id);
      if (!cat) return res.status(400).json({ error: "Invalid category" });
    }
    const tags = b.tags !== undefined ? JSON.stringify(Array.isArray(b.tags) ? b.tags : []) : row.tags;
    db.prepare(
      `UPDATE items SET
        category_id = ?, name = ?, description = ?, price = ?, prep_minutes = ?,
        tags = ?, image = ?, has_milk = ?, has_extra_shot = ?, active = ?
       WHERE id = ?`
    ).run(
      categoryId,
      b.name !== undefined ? String(b.name).trim() || row.name : row.name,
      b.description !== undefined ? String(b.description) : row.description,
      b.price !== undefined && Number.isFinite(Number(b.price)) ? Math.max(0, Number(b.price)) : row.price,
      b.prepMinutes !== undefined && Number.isFinite(Number(b.prepMinutes))
        ? Math.max(0, Number(b.prepMinutes))
        : b.prep_minutes !== undefined && Number.isFinite(Number(b.prep_minutes))
          ? Math.max(0, Number(b.prep_minutes))
          : row.prep_minutes,
      tags,
      b.image !== undefined ? String(b.image) : row.image,
      b.hasMilk !== undefined ? (b.hasMilk ? 1 : 0) : b.has_milk !== undefined ? (b.has_milk ? 1 : 0) : row.has_milk,
      b.hasExtraShot !== undefined ? (b.hasExtraShot ? 1 : 0) : b.has_extra_shot !== undefined ? (b.has_extra_shot ? 1 : 0) : row.has_extra_shot,
      b.active !== undefined ? (b.active ? 1 : 0) : row.active,
      row.id
    );
    res.json(mapItem(db.prepare("SELECT * FROM items WHERE id = ?").get(row.id)));
  });

  app.delete("/cafes/:slug/items/:id", (req, res) => {
    const cafe = requireOwner(db, req, res, req.params.slug);
    if (!cafe) return;
    const row = db.prepare("SELECT * FROM items WHERE id = ? AND cafe_id = ?").get(req.params.id, cafe.id);
    if (!row) return res.status(404).json({ error: "Item not found" });
    db.prepare("DELETE FROM items WHERE id = ?").run(row.id);
    res.json({ ok: true });
  });

  // Orders
  app.get("/cafes/:slug/orders", (req, res) => {
    const cafe = requireStaff(db, req, res, req.params.slug);
    if (!cafe) return;
    const rows = db
      .prepare("SELECT * FROM orders WHERE cafe_id = ? ORDER BY created_at DESC")
      .all(cafe.id)
      .map(mapOrder);
    res.json(rows);
  });

  app.post("/cafes/:slug/orders", (req, res) => {
    const cafe = getCafeBySlug(db, req.params.slug);
    if (!cafe) return res.status(404).json({ error: "Cafe not found" });
    const b = req.body || {};
    const lines = Array.isArray(b.items) ? b.items : [];
    if (!lines.length) return res.status(400).json({ error: "items required" });

    let subtotal = Number(b.subtotal);
    let tax = Number(b.tax);
    let total = Number(b.total);
    let wait = Number(b.estimatedWait || b.estimated_wait) || 5;

    if (!Number.isFinite(subtotal)) {
      subtotal = lines.reduce((s, l) => s + (Number(l.unitPrice) || 0) * (Number(l.qty) || 1), 0);
      subtotal = Math.round(subtotal * 100) / 100;
    }
    if (!Number.isFinite(tax)) {
      // INR demo cafes: no tax for simplicity; others use TAX_RATE
      tax = cafe.currency === "INR" ? 0 : Math.round(subtotal * TAX_RATE * 100) / 100;
    }
    if (!Number.isFinite(total)) {
      total = Math.round((subtotal + tax) * 100) / 100;
    }

    const prefix = orderPrefix(cafe.slug);
    let id = b.id;
    if (!id) {
      for (let i = 0; i < 8; i++) {
        const candidate = `${prefix}-${1000 + Math.floor(Math.random() * 9000)}`;
        if (!db.prepare("SELECT id FROM orders WHERE id = ?").get(candidate)) {
          id = candidate;
          break;
        }
      }
      if (!id) id = `${prefix}-${Date.now().toString(36).toUpperCase()}`;
    }

    const now = Date.now();
    const tableNo = String(b.table || b.table_no || "01").replace(/\D/g, "").padStart(2, "0") || "01";

    db.prepare(
      `INSERT INTO orders (id, cafe_id, table_no, guest_name, phone, notes, items, subtotal, tax, total, status, estimated_wait, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'new', ?, ?, ?)`
    ).run(
      id,
      cafe.id,
      tableNo,
      (b.guestName || b.guest_name || "Guest").trim() || "Guest",
      (b.phone || "").trim(),
      (b.notes || "").trim(),
      JSON.stringify(lines),
      subtotal,
      tax,
      total,
      Math.max(2, wait),
      now,
      now
    );

    const row = db.prepare("SELECT * FROM orders WHERE id = ?").get(id);
    res.status(201).json(mapOrder(row));
  });

  app.patch("/cafes/:slug/orders/:id", (req, res) => {
    const cafe = requireStaff(db, req, res, req.params.slug);
    if (!cafe) return;
    const row = db.prepare("SELECT * FROM orders WHERE id = ? AND cafe_id = ?").get(req.params.id, cafe.id);
    if (!row) return res.status(404).json({ error: "Order not found" });
    const status = (req.body && req.body.status) || row.status;
    const allowed = ["new", "preparing", "ready", "paid"];
    if (!allowed.includes(status)) return res.status(400).json({ error: "Invalid status" });
    const now = Date.now();
    db.prepare("UPDATE orders SET status = ?, updated_at = ? WHERE id = ?").run(status, now, row.id);
    res.json(mapOrder(db.prepare("SELECT * FROM orders WHERE id = ?").get(row.id)));
  });

  app.get("/cafes/:slug/orders/:id", (req, res) => {
    const cafe = getCafeBySlug(db, req.params.slug);
    if (!cafe) return res.status(404).json({ error: "Cafe not found" });
    const row = db.prepare("SELECT * FROM orders WHERE id = ? AND cafe_id = ?").get(req.params.id, cafe.id);
    if (!row) return res.status(404).json({ error: "Order not found" });
    res.json(mapOrder(row));
  });

  cachedApp = app;
  return app;
}

async function main() {
  const app = await createApp();
  app.listen(PORT, () => {
    console.log(`CafeQR API listening on http://localhost:${PORT}`);
    console.log(`Health: GET /health · Cafes: GET /cafes · Demo: GET /cafes/velvet-bean`);
  });
}

if (require.main === module) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}

module.exports = { createApp };
