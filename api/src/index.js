const express = require("express");
const cors = require("cors");
const { getStore } = require("./store");
const { seed, resetCafe } = require("./seed");
const { sendError, fromZod } = require("./errors");
const {
  createCafeSchema,
  patchCafeSchema,
  categorySchema,
  itemSchema,
  placeOrderSchema,
  patchOrderSchema,
  pinBodySchema,
} = require("./validate");

const PORT = process.env.PORT || 8787;
const VERSION =
  process.env.VERCEL_GIT_COMMIT_SHA ||
  process.env.GIT_SHA ||
  process.env.npm_package_version ||
  "1.0.0";

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

function genConfirmCode() {
  return String(1000 + Math.floor(Math.random() * 9000));
}

function cafeTaxRate(cafe) {
  const n = Number(cafe?.tax_rate);
  if (Number.isFinite(n) && n >= 0) return n;
  // Legacy fallback before tax_rate column
  if (cafe?.currency === "INR") return 0.05;
  if (cafe?.currency === "NPR") return 0.13;
  return 0.08;
}

function cafeTaxName(cafe) {
  return String(cafe?.tax_name || "").trim() || (cafe?.currency === "INR" ? "GST" : cafe?.currency === "NPR" ? "VAT" : "Tax");
}

function computeTax(subtotal, rate) {
  const r = Number(rate);
  if (!Number.isFinite(r) || r <= 0) return 0;
  return Math.round(subtotal * r * 100) / 100;
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
    country: row.country || "US",
    taxName: cafeTaxName(row),
    taxRate: cafeTaxRate(row),
    orderingEnabled:
      row.ordering_enabled === undefined || row.ordering_enabled === null ? true : !!row.ordering_enabled,
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
    available: row.available === undefined || row.available === null ? true : !!row.available,
  };
}

function mapOrder(row) {
  let items = [];
  try {
    items = typeof row.items === "string" ? JSON.parse(row.items || "[]") : row.items || [];
  } catch (_) {}
  const dining = row.dining_option === "takeaway" ? "takeaway" : "dine_in";
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
    taxName: row.tax_name || "",
    total: row.total,
    status: row.status,
    estimatedWait: row.estimated_wait,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    confirmCode: row.confirm_code || "",
    diningOption: dining,
    payCash: true,
  };
}

async function requireOwner(store, req, res, slug) {
  const cafe = await store.getCafeBySlug(slug);
  if (!cafe) {
    sendError(res, 404, "CAFE_NOT_FOUND", "Cafe not found");
    return null;
  }
  const pin = req.header("X-Owner-Pin") || "";
  if (pin !== cafe.owner_pin) {
    sendError(res, 401, "INVALID_OWNER_PIN", "Invalid owner PIN");
    return null;
  }
  return cafe;
}

async function requireStaff(store, req, res, slug) {
  const cafe = await store.getCafeBySlug(slug);
  if (!cafe) {
    sendError(res, 404, "CAFE_NOT_FOUND", "Cafe not found");
    return null;
  }
  const pin = req.header("X-Staff-Pin") || "";
  if (pin !== cafe.staff_pin) {
    sendError(res, 401, "INVALID_STAFF_PIN", "Invalid staff PIN");
    return null;
  }
  return cafe;
}

function nid(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function parseCorsOrigins() {
  const raw =
    process.env.CORS_ORIGINS ||
    "https://cafeqr-five.vercel.app,http://localhost:8081,http://localhost:19006,http://localhost:3000,http://127.0.0.1:8081";
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Best-effort in-memory rate limit (per isolate on serverless). */
const orderHits = new Map();
function rateLimitOrders(req, res, next) {
  const ip = req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || req.socket?.remoteAddress || "unknown";
  const key = `${ip}:${req.params.slug || ""}`;
  const now = Date.now();
  const windowMs = 60_000;
  const max = Number(process.env.ORDER_RATE_LIMIT || 30);
  let bucket = orderHits.get(key);
  if (!bucket || now - bucket.start > windowMs) {
    bucket = { start: now, count: 0 };
    orderHits.set(key, bucket);
  }
  bucket.count += 1;
  if (bucket.count > max) {
    return sendError(res, 429, "RATE_LIMITED", "Too many orders — try again shortly");
  }
  // opportunistic cleanup
  if (orderHits.size > 5000) {
    for (const [k, v] of orderHits) {
      if (now - v.start > windowMs * 2) orderHits.delete(k);
    }
  }
  next();
}

function securityHeaders(_req, res, next) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
  next();
}

let cachedApp = null;

async function createApp() {
  if (cachedApp) return cachedApp;
  const store = await getStore();
  await seed();

  const app = express();
  const origins = parseCorsOrigins();
  app.use(
    cors({
      origin(origin, cb) {
        if (!origin) return cb(null, true); // curl / same-origin / server-to-server
        if (origins.includes("*") || origins.includes(origin)) return cb(null, true);
        // Allow Vercel preview deploys of cafeqr
        if (/^https:\/\/cafeqr[a-z0-9-]*\.vercel\.app$/.test(origin)) return cb(null, true);
        return cb(null, false);
      },
      credentials: false,
    })
  );
  app.use(securityHeaders);
  app.use(express.json({ limit: "2mb" }));

  app.get("/health", async (_req, res) => {
    const dbUp = await store.ping();
    res.status(dbUp ? 200 : 503).json({
      ok: dbUp,
      db: dbUp ? "up" : "down",
      driver: store.driver,
      version: String(VERSION).slice(0, 40),
      time: Date.now(),
      service: "cafeqr-api",
    });
  });

  app.get("/version", (_req, res) => {
    res.json({ version: String(VERSION).slice(0, 40), service: "cafeqr-api", driver: store.driver });
  });

  app.get("/cafes", async (_req, res) => {
    try {
      const rows = await store.listCafes();
      res.json(
        rows.map((r) => ({
          slug: r.slug,
          name: r.name,
          tagline: r.tagline,
          currency: r.currency,
          country: r.country || undefined,
          taxName: r.tax_name || undefined,
          taxRate: r.tax_rate !== undefined && r.tax_rate !== null ? Number(r.tax_rate) : undefined,
          accentColor: r.accent_color,
        }))
      );
    } catch (e) {
      console.error(e);
      sendError(res, 500, "INTERNAL", "Failed to list cafes");
    }
  });

  app.post("/cafes", async (req, res) => {
    const parsed = createCafeSchema.safeParse(req.body || {});
    if (!parsed.success) return fromZod(res, parsed.error);
    const body = parsed.data;
    let slug = slugify(body.slug || body.name);
    if (!slug) return sendError(res, 400, "VALIDATION_ERROR", "slug or name required");
    if (await store.getCafeBySlug(slug)) return sendError(res, 409, "SLUG_TAKEN", "Slug already taken");

    const name = (body.name || slug).trim();
    const cafe = await store.createCafe({
      slug,
      name,
      tagline: body.tagline || "",
      accent_color: body.accentColor || body.accent_color || "#E8B62C",
      hours: body.hours || "",
      address: body.address || "",
      table_count: Math.max(1, Math.min(48, Number(body.tableCount || body.table_count) || 8)),
      cash_only: body.cashOnly === false || body.cash_only === 0 ? 0 : 1,
      currency: body.currency || "USD",
      country: (body.country || "US").toUpperCase().slice(0, 8),
      tax_name: body.taxName || body.tax_name || "Tax",
      tax_rate: (() => {
        const n = Number(body.taxRate ?? body.tax_rate);
        return Number.isFinite(n) && n >= 0 ? Math.min(1, n) : 0.08;
      })(),
      owner_pin: body.ownerPin || body.owner_pin || "1234",
      staff_pin: body.staffPin || body.staff_pin || "1234",
      ordering_enabled: body.orderingEnabled === false || body.ordering_enabled === 0 ? 0 : 1,
    });
    await store.createCategory({ id: nid("cat"), cafe_id: cafe.id, name: "Menu", sort: 1 });
    res.status(201).json(mapCafe(cafe));
  });

  app.get("/cafes/:slug", async (req, res) => {
    const cafe = await store.getCafeBySlug(req.params.slug);
    if (!cafe) return sendError(res, 404, "CAFE_NOT_FOUND", "Cafe not found");
    const categories = (await store.listCategories(cafe.id)).map(mapCategory);
    const items = (await store.listItems(cafe.id, { activeOnly: true })).map(mapItem);
    res.json({ cafe: mapCafe(cafe), categories, items });
  });

  app.patch("/cafes/:slug", async (req, res) => {
    const cafe = await requireOwner(store, req, res, req.params.slug);
    if (!cafe) return;
    const parsed = patchCafeSchema.safeParse(req.body || {});
    if (!parsed.success) return fromZod(res, parsed.error);
    const b = parsed.data;
    let orderingEnabled = null;
    if (b.orderingEnabled !== undefined) orderingEnabled = b.orderingEnabled ? 1 : 0;
    else if (b.ordering_enabled !== undefined) orderingEnabled = Number(b.ordering_enabled) ? 1 : 0;

    const updated = await store.updateCafe(cafe.id, {
      name: b.name !== undefined ? String(b.name) : null,
      tagline: b.tagline !== undefined ? String(b.tagline) : null,
      accent_color:
        b.accentColor !== undefined
          ? String(b.accentColor)
          : b.accent_color !== undefined
            ? String(b.accent_color)
            : null,
      hours: b.hours !== undefined ? String(b.hours) : null,
      address: b.address !== undefined ? String(b.address) : null,
      table_count:
        b.tableCount !== undefined
          ? Number(b.tableCount)
          : b.table_count !== undefined
            ? Number(b.table_count)
            : null,
      cash_only:
        b.cashOnly !== undefined
          ? b.cashOnly
            ? 1
            : 0
          : b.cash_only !== undefined
            ? Number(b.cash_only)
            : null,
      currency: b.currency !== undefined ? String(b.currency) : null,
      country: b.country !== undefined ? String(b.country).toUpperCase().slice(0, 8) : null,
      tax_name:
        b.taxName !== undefined
          ? String(b.taxName)
          : b.tax_name !== undefined
            ? String(b.tax_name)
            : null,
      tax_rate: (() => {
        if (b.taxRate !== undefined) {
          const n = Number(b.taxRate);
          return Number.isFinite(n) && n >= 0 ? Math.min(1, n) : null;
        }
        if (b.tax_rate !== undefined) {
          const n = Number(b.tax_rate);
          return Number.isFinite(n) && n >= 0 ? Math.min(1, n) : null;
        }
        return null;
      })(),
      ordering_enabled: orderingEnabled,
    });
    res.json(mapCafe(updated));
  });

  app.post("/cafes/:slug/verify-owner", async (req, res) => {
    const cafe = await store.getCafeBySlug(req.params.slug);
    if (!cafe) return sendError(res, 404, "CAFE_NOT_FOUND", "Cafe not found");
    const parsed = pinBodySchema.safeParse(req.body || {});
    if (!parsed.success) return fromZod(res, parsed.error);
    res.json({ ok: parsed.data.pin === cafe.owner_pin });
  });

  app.post("/cafes/:slug/verify-staff", async (req, res) => {
    const cafe = await store.getCafeBySlug(req.params.slug);
    if (!cafe) return sendError(res, 404, "CAFE_NOT_FOUND", "Cafe not found");
    const parsed = pinBodySchema.safeParse(req.body || {});
    if (!parsed.success) return fromZod(res, parsed.error);
    res.json({ ok: parsed.data.pin === cafe.staff_pin });
  });

  app.post("/cafes/:slug/categories", async (req, res) => {
    const cafe = await requireOwner(store, req, res, req.params.slug);
    if (!cafe) return;
    const parsed = categorySchema.safeParse(req.body || {});
    if (!parsed.success) return fromZod(res, parsed.error);
    const name = ((parsed.data.name) || "New category").trim();
    const sort = (await store.maxCategorySort(cafe.id)) + 1;
    const id = nid("cat");
    const cat = await store.createCategory({ id, cafe_id: cafe.id, name, sort });
    res.status(201).json(cat);
  });

  app.patch("/cafes/:slug/categories/:id", async (req, res) => {
    const cafe = await requireOwner(store, req, res, req.params.slug);
    if (!cafe) return;
    const parsed = categorySchema.safeParse(req.body || {});
    if (!parsed.success) return fromZod(res, parsed.error);
    const updated = await store.updateCategory(req.params.id, cafe.id, parsed.data);
    if (!updated) return sendError(res, 404, "CATEGORY_NOT_FOUND", "Category not found");
    res.json(updated);
  });

  app.delete("/cafes/:slug/categories/:id", async (req, res) => {
    const cafe = await requireOwner(store, req, res, req.params.slug);
    if (!cafe) return;
    const row = await store.getCategory(req.params.id, cafe.id);
    if (!row) return sendError(res, 404, "CATEGORY_NOT_FOUND", "Category not found");
    await store.deleteCategory(row.id, cafe.id);
    res.json({ ok: true });
  });

  app.post("/cafes/:slug/items", async (req, res) => {
    const cafe = await requireOwner(store, req, res, req.params.slug);
    if (!cafe) return;
    const parsed = itemSchema.safeParse(req.body || {});
    if (!parsed.success) return fromZod(res, parsed.error);
    const b = parsed.data;
    const categoryId = b.categoryId || b.category_id;
    if (!categoryId) return sendError(res, 400, "VALIDATION_ERROR", "categoryId required");
    if (!(b.name || "").toString().trim()) return sendError(res, 400, "VALIDATION_ERROR", "name required");
    const cat = await store.getCategory(categoryId, cafe.id);
    if (!cat) return sendError(res, 400, "INVALID_CATEGORY", "Invalid category");
    const id = b.id || nid("item");
    const available = b.available === false || b.available === 0 ? 0 : 1;
    const row = await store.createItem({
      id,
      cafe_id: cafe.id,
      category_id: categoryId,
      name: (b.name || "Untitled").trim(),
      description: b.description || "",
      price: Number.isFinite(Number(b.price)) ? Math.max(0, Number(b.price)) : 0,
      prep_minutes: Number.isFinite(Number(b.prepMinutes ?? b.prep_minutes))
        ? Math.max(0, Number(b.prepMinutes ?? b.prep_minutes))
        : 5,
      tags: b.tags || [],
      image: b.image || "",
      has_milk: b.hasMilk || b.has_milk ? 1 : 0,
      has_extra_shot: b.hasExtraShot || b.has_extra_shot ? 1 : 0,
      active: b.active === false ? 0 : 1,
      available,
    });
    res.status(201).json(mapItem(row));
  });

  app.patch("/cafes/:slug/items/:id", async (req, res) => {
    const cafe = await requireOwner(store, req, res, req.params.slug);
    if (!cafe) return;
    const row = await store.getItem(req.params.id, cafe.id);
    if (!row) return sendError(res, 404, "ITEM_NOT_FOUND", "Item not found");
    const parsed = itemSchema.safeParse(req.body || {});
    if (!parsed.success) return fromZod(res, parsed.error);
    const b = parsed.data;
    const categoryId =
      b.categoryId !== undefined
        ? b.categoryId
        : b.category_id !== undefined
          ? b.category_id
          : row.category_id;
    if (categoryId !== row.category_id) {
      const cat = await store.getCategory(categoryId, cafe.id);
      if (!cat) return sendError(res, 400, "INVALID_CATEGORY", "Invalid category");
    }
    const tags = b.tags !== undefined ? JSON.stringify(Array.isArray(b.tags) ? b.tags : []) : row.tags;
    let available = row.available === undefined || row.available === null ? 1 : row.available;
    if (b.available !== undefined) available = b.available ? 1 : 0;
    const updated = await store.updateItem(row.id, cafe.id, {
      category_id: categoryId,
      name: b.name !== undefined ? String(b.name).trim() || row.name : row.name,
      description: b.description !== undefined ? String(b.description) : row.description,
      price:
        b.price !== undefined && Number.isFinite(Number(b.price))
          ? Math.max(0, Number(b.price))
          : row.price,
      prep_minutes:
        b.prepMinutes !== undefined && Number.isFinite(Number(b.prepMinutes))
          ? Math.max(0, Number(b.prepMinutes))
          : b.prep_minutes !== undefined && Number.isFinite(Number(b.prep_minutes))
            ? Math.max(0, Number(b.prep_minutes))
            : row.prep_minutes,
      tags,
      image: b.image !== undefined ? String(b.image) : row.image,
      has_milk:
        b.hasMilk !== undefined
          ? b.hasMilk
            ? 1
            : 0
          : b.has_milk !== undefined
            ? b.has_milk
              ? 1
              : 0
            : row.has_milk,
      has_extra_shot:
        b.hasExtraShot !== undefined
          ? b.hasExtraShot
            ? 1
            : 0
          : b.has_extra_shot !== undefined
            ? b.has_extra_shot
              ? 1
              : 0
            : row.has_extra_shot,
      active: b.active !== undefined ? (b.active ? 1 : 0) : row.active,
      available,
    });
    res.json(mapItem(updated));
  });

  app.delete("/cafes/:slug/items/:id", async (req, res) => {
    const cafe = await requireOwner(store, req, res, req.params.slug);
    if (!cafe) return;
    const row = await store.getItem(req.params.id, cafe.id);
    if (!row) return sendError(res, 404, "ITEM_NOT_FOUND", "Item not found");
    await store.deleteItem(row.id);
    res.json({ ok: true });
  });

  app.get("/cafes/:slug/orders", async (req, res) => {
    const cafe = await requireStaff(store, req, res, req.params.slug);
    if (!cafe) return;
    const rows = (await store.listOrders(cafe.id)).map(mapOrder);
    res.json(rows);
  });

  app.post("/cafes/:slug/orders", rateLimitOrders, async (req, res) => {
    const cafe = await store.getCafeBySlug(req.params.slug);
    if (!cafe) return sendError(res, 404, "CAFE_NOT_FOUND", "Cafe not found");
    const orderingOn =
      cafe.ordering_enabled === undefined || cafe.ordering_enabled === null
        ? true
        : !!cafe.ordering_enabled;
    if (!orderingOn) return sendError(res, 403, "ORDERING_PAUSED", "Ordering paused — please call staff");

    const parsed = placeOrderSchema.safeParse(req.body || {});
    if (!parsed.success) return fromZod(res, parsed.error);
    const b = parsed.data;
    const lines = b.items;

    for (const line of lines) {
      const itemId = line.itemId || line.item_id;
      if (!itemId) continue;
      const row = await store.getItem(itemId, cafe.id);
      if (row && (row.available === 0 || row.available === false)) {
        return sendError(res, 400, "SOLD_OUT", `${row.name || "Item"} is sold out`);
      }
    }

    let subtotal = Number(b.subtotal);
    let tax = Number(b.tax);
    let total = Number(b.total);
    let wait = Number(b.estimatedWait || b.estimated_wait) || 5;

    if (!Number.isFinite(subtotal)) {
      subtotal = lines.reduce((s, l) => s + (Number(l.unitPrice) || 0) * (Number(l.qty) || 1), 0);
      subtotal = Math.round(subtotal * 100) / 100;
    }
    const taxRate = cafeTaxRate(cafe);
    const taxName = cafeTaxName(cafe);
    if (!Number.isFinite(tax)) tax = computeTax(subtotal, taxRate);
    if (!Number.isFinite(total)) total = Math.round((subtotal + tax) * 100) / 100;

    const prefix = orderPrefix(cafe.slug);
    let id = b.id;
    if (!id) {
      for (let i = 0; i < 8; i++) {
        const candidate = `${prefix}-${1000 + Math.floor(Math.random() * 9000)}`;
        if (!(await store.orderIdExists(candidate))) {
          id = candidate;
          break;
        }
      }
      if (!id) id = `${prefix}-${Date.now().toString(36).toUpperCase()}`;
    }

    const now = Date.now();
    const tableNo = String(b.table || b.table_no || "01").replace(/\D/g, "").padStart(2, "0") || "01";
    const diningRaw = String(b.diningOption || b.dining_option || "dine_in").toLowerCase();
    const diningOption = diningRaw === "takeaway" || diningRaw === "take_away" ? "takeaway" : "dine_in";
    const confirmCode = String(b.confirmCode || b.confirm_code || genConfirmCode())
      .replace(/\D/g, "")
      .slice(0, 4)
      .padStart(4, "0");

    const row = await store.createOrder({
      id,
      cafe_id: cafe.id,
      table_no: tableNo,
      guest_name: (b.guestName || b.guest_name || "Guest").trim() || "Guest",
      phone: (b.phone || "").trim(),
      notes: (b.notes || "").trim(),
      items: lines,
      subtotal,
      tax,
      tax_name: taxName,
      total,
      status: "new",
      estimated_wait: Math.max(2, wait),
      confirm_code: confirmCode,
      dining_option: diningOption,
      created_at: now,
      updated_at: now,
    });
    res.status(201).json(mapOrder(row));
  });

  app.patch("/cafes/:slug/orders/:id", async (req, res) => {
    const cafe = await requireStaff(store, req, res, req.params.slug);
    if (!cafe) return;
    const row = await store.getOrder(req.params.id, cafe.id);
    if (!row) return sendError(res, 404, "ORDER_NOT_FOUND", "Order not found");
    const parsed = patchOrderSchema.safeParse(req.body || {});
    if (!parsed.success) return fromZod(res, parsed.error);
    const updated = await store.updateOrderStatus(row.id, cafe.id, parsed.data.status, Date.now());
    res.json(mapOrder(updated));
  });

  app.delete("/cafes/:slug/orders/:id", async (req, res) => {
    const cafe = await requireStaff(store, req, res, req.params.slug);
    if (!cafe) return;
    const row = await store.getOrder(req.params.id, cafe.id);
    if (!row) return sendError(res, 404, "ORDER_NOT_FOUND", "Order not found");
    await store.deleteOrder(row.id);
    res.json({ ok: true });
  });

  app.get("/cafes/:slug/orders/:id", async (req, res) => {
    const cafe = await store.getCafeBySlug(req.params.slug);
    if (!cafe) return sendError(res, 404, "CAFE_NOT_FOUND", "Cafe not found");
    const row = await store.getOrder(req.params.id, cafe.id);
    if (!row) return sendError(res, 404, "ORDER_NOT_FOUND", "Order not found");
    res.json(mapOrder(row));
  });

  app.post("/cafes/:slug/restore-demo", async (req, res) => {
    const cafe = await requireOwner(store, req, res, req.params.slug);
    if (!cafe) return;
    try {
      await resetCafe(cafe.slug);
      const refreshed = await store.getCafeBySlug(cafe.slug);
      const categories = (await store.listCategories(refreshed.id)).map(mapCategory);
      const items = (await store.listItems(refreshed.id, { activeOnly: true })).map(mapItem);
      res.json({ ok: true, cafe: mapCafe(refreshed), categories, items });
    } catch (e) {
      const status = e && e.status ? e.status : 500;
      sendError(res, status, "RESTORE_FAILED", e.message || "Restore failed");
    }
  });

  // Uniform 404
  app.use((_req, res) => sendError(res, 404, "NOT_FOUND", "Not found"));

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
