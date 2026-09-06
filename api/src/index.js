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
const { safeEqualStr, validateNewPin, createRateLimiter } = require("./security");
const {
  defaultSurcharges,
  cafeAltMilkPrice,
  cafeExtraShotPrice,
  cafeTaxRate,
  cafeTaxName,
  priceLine,
  recomputeOrder,
} = require("./pricing");
const {
  parseModifiers,
  serializeModifiers,
  deriveFlagsFromModifiers,
  modifiersFromFlags,
} = require("./modifiers");

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
    altMilkPrice: cafeAltMilkPrice(row),
    extraShotPrice: cafeExtraShotPrice(row),
    orderingEnabled:
      row.ordering_enabled === undefined || row.ordering_enabled === null ? true : !!row.ordering_enabled,
    updatedAt: row.updated_at === undefined || row.updated_at === null ? 0 : Number(row.updated_at),
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
  const modifiers = parseModifiers(row.modifiers);
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
    modifiers,
    active: row.active === undefined ? true : !!row.active,
    available: row.available === undefined || row.available === null ? true : !!row.available,
  };
}

function mapOrder(row) {
  if (!row) return null;
  let items = [];
  try {
    if (typeof row.items === "string") items = JSON.parse(row.items || "[]");
    else if (Array.isArray(row.items)) items = row.items;
  } catch (_) {
    items = [];
  }
  if (!Array.isArray(items)) items = [];
  const dining = String(row.dining_option || row.diningOption || "dine_in").toLowerCase();
  return {
    id: row.id,
    table: String(row.table_no || row.table || ""),
    guestName: row.guest_name || row.guestName || "Guest",
    phone: row.phone || "",
    notes: row.notes || "",
    items,
    subtotal: Number(row.subtotal) || 0,
    tax: Number(row.tax) || 0,
    taxName: row.tax_name || row.taxName || "",
    total: Number(row.total) || 0,
    status: row.status || "new",
    createdAt: Number(row.created_at ?? row.createdAt) || 0,
    updatedAt: Number(row.updated_at ?? row.updatedAt) || 0,
    estimatedWait: Number(row.estimated_wait ?? row.estimatedWait) || 0,
    payCash: true,
    confirmCode: row.confirm_code || row.confirmCode || "",
    diningOption: dining === "takeaway" || dining === "take_away" ? "takeaway" : "dine_in",
  };
}

function resolveItemModifiersAndFlags(b, row, cafe) {
  const currency = cafe?.currency;
  let modifiers = row ? parseModifiers(row.modifiers) : [];

  if (b.modifiers !== undefined) {
    modifiers = parseModifiers(b.modifiers);
    const flags = deriveFlagsFromModifiers(modifiers);
    return { modifiers, has_milk: flags.has_milk, has_extra_shot: flags.has_extra_shot };
  }

  const toggled =
    b.hasMilk !== undefined ||
    b.hasExtraShot !== undefined ||
    b.has_milk !== undefined ||
    b.has_extra_shot !== undefined;

  let hasMilk =
    b.hasMilk !== undefined
      ? b.hasMilk
        ? 1
        : 0
      : b.has_milk !== undefined
        ? b.has_milk
          ? 1
          : 0
        : row
          ? row.has_milk
          : 0;
  let hasExtraShot =
    b.hasExtraShot !== undefined
      ? b.hasExtraShot
        ? 1
        : 0
      : b.has_extra_shot !== undefined
        ? b.has_extra_shot
          ? 1
          : 0
        : row
          ? row.has_extra_shot
          : 0;

  if (toggled) {
    const custom = modifiers.filter(
      (g) => !(g.id === "milk" || /milk/i.test(g.name) || g.id === "extra-shot" || /extra\s*shot/i.test(g.name))
    );
    modifiers = [...modifiersFromFlags(!!hasMilk, !!hasExtraShot, currency), ...custom];
  } else if (!modifiers.length && (hasMilk || hasExtraShot)) {
    modifiers = modifiersFromFlags(!!hasMilk, !!hasExtraShot, currency);
  } else if (modifiers.length) {
    const flags = deriveFlagsFromModifiers(modifiers);
    hasMilk = flags.has_milk;
    hasExtraShot = flags.has_extra_shot;
  }

  return { modifiers, has_milk: hasMilk ? 1 : 0, has_extra_shot: hasExtraShot ? 1 : 0 };
}

async function requireOwner(store, req, res, slug) {
  const cafe = await store.getCafeBySlug(slug);
  if (!cafe) {
    sendError(res, 404, "CAFE_NOT_FOUND", "Cafe not found");
    return null;
  }
  const pin = req.header("X-Owner-Pin") || "";
  if (!safeEqualStr(pin, cafe.owner_pin)) {
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
  if (!safeEqualStr(pin, cafe.staff_pin)) {
    sendError(res, 401, "INVALID_STAFF_PIN", "Invalid staff PIN");
    return null;
  }
  return cafe;
}

function requireAdmin(req, res) {
  const token = (process.env.CAFEQR_ADMIN_TOKEN || "").trim();
  const allowPublic = process.env.CAFEQR_ALLOW_PUBLIC_CREATE === "1";
  const onVercel = !!process.env.VERCEL;
  const isProd = process.env.NODE_ENV === "production" || onVercel;

  if (!token) {
    if (allowPublic && !isProd) return true;
    if (isProd) {
      sendError(
        res,
        503,
        "ADMIN_NOT_CONFIGURED",
        "CAFEQR_ADMIN_TOKEN is not configured — cafe create is disabled"
      );
      return false;
    }
    sendError(res, 401, "ADMIN_REQUIRED", "X-Admin-Token required (or set CAFEQR_ALLOW_PUBLIC_CREATE=1 for local)");
    return false;
  }

  const provided = req.header("X-Admin-Token") || "";
  if (!safeEqualStr(provided, token)) {
    sendError(res, 401, "INVALID_ADMIN_TOKEN", "Invalid admin token");
    return false;
  }
  return true;
}

function nid(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function parseCorsOrigins() {
  const raw =
    process.env.CORS_ORIGINS ||
    "https://cafeqr-five.vercel.app,https://cafeqr-staff.vercel.app,https://cafeqr-owner.vercel.app,http://localhost:8081,http://localhost:19006,http://localhost:3000,http://127.0.0.1:8081";
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Advisory in-memory rate limits (per isolate on serverless — not a global KV). */
const rateLimitOrders = createRateLimiter({
  windowMs: 60_000,
  max: Number(process.env.ORDER_RATE_LIMIT || 30),
});
const rateLimitPin = createRateLimiter({
  windowMs: 60_000,
  max: Number(process.env.PIN_RATE_LIMIT || 20),
});

function securityHeaders(_req, res, next) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
  next();
}

/** Async route wrapper — forwards rejections to error middleware. */
function wrap(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
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
        if (!origin) return cb(null, true);
        if (origins.includes("*") || origins.includes(origin)) return cb(null, true);
        if (/^https:\/\/cafeqr[a-z0-9-]*\.vercel\.app$/.test(origin)) return cb(null, true);
        return cb(null, false);
      },
      credentials: false,
    })
  );
  app.use(securityHeaders);
  app.use(express.json({ limit: "2mb" }));

  app.get(
    "/health",
    wrap(async (_req, res) => {
      const dbUp = await store.ping();
      res.status(dbUp ? 200 : 503).json({
        ok: dbUp,
        db: dbUp ? "up" : "down",
        driver: store.driver,
        version: String(VERSION).slice(0, 40),
        time: Date.now(),
        service: "cafeqr-api",
      });
    })
  );

  app.get("/version", (_req, res) => {
    res.json({ version: String(VERSION).slice(0, 40), service: "cafeqr-api", driver: store.driver });
  });

  app.get(
    "/cafes",
    wrap(async (_req, res) => {
      res.set("Cache-Control", "no-store");
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
    })
  );

  app.post(
    "/cafes",
    wrap(async (req, res) => {
      if (!requireAdmin(req, res)) return;
      const parsed = createCafeSchema.safeParse(req.body || {});
      if (!parsed.success) return fromZod(res, parsed.error);
      const body = parsed.data;
      let slug = slugify(body.slug || body.name);
      if (!slug) return sendError(res, 400, "VALIDATION_ERROR", "slug or name required");
      if (await store.getCafeBySlug(slug)) return sendError(res, 409, "SLUG_TAKEN", "Slug already taken");

      const ownerPin = body.ownerPin || body.owner_pin;
      const staffPin = body.staffPin || body.staff_pin;
      const ownerErr = validateNewPin(ownerPin, "ownerPin");
      if (ownerErr) return sendError(res, 400, "WEAK_PIN", ownerErr);
      const staffErr = validateNewPin(staffPin, "staffPin");
      if (staffErr) return sendError(res, 400, "WEAK_PIN", staffErr);

      const currency = body.currency || "USD";
      const sur = defaultSurcharges(currency);
      const altMilk =
        body.altMilkPrice !== undefined
          ? Number(body.altMilkPrice)
          : body.alt_milk_price !== undefined
            ? Number(body.alt_milk_price)
            : sur.altMilk;
      const extraShot =
        body.extraShotPrice !== undefined
          ? Number(body.extraShotPrice)
          : body.extra_shot_price !== undefined
            ? Number(body.extra_shot_price)
            : sur.extraShot;

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
        currency,
        country: (body.country || "US").toUpperCase().slice(0, 8),
        tax_name: body.taxName || body.tax_name || "Tax",
        tax_rate: (() => {
          const n = Number(body.taxRate ?? body.tax_rate);
          return Number.isFinite(n) && n >= 0 ? Math.min(1, n) : 0.08;
        })(),
        alt_milk_price: Number.isFinite(altMilk) && altMilk >= 0 ? altMilk : sur.altMilk,
        extra_shot_price: Number.isFinite(extraShot) && extraShot >= 0 ? extraShot : sur.extraShot,
        owner_pin: ownerPin,
        staff_pin: staffPin,
        ordering_enabled: body.orderingEnabled === false || body.ordering_enabled === 0 ? 0 : 1,
      });
      await store.createCategory({ id: nid("cat"), cafe_id: cafe.id, name: "Menu", sort: 1 });
      res.status(201).json(mapCafe(cafe));
    })
  );

  app.get(
    "/cafes/:slug",
    wrap(async (req, res) => {
      const cafe = await store.getCafeBySlug(req.params.slug);
      if (!cafe) return sendError(res, 404, "CAFE_NOT_FOUND", "Cafe not found");
      const categories = (await store.listCategories(cafe.id)).map(mapCategory);
      const items = (await store.listItems(cafe.id, { activeOnly: true })).map(mapItem);
      res.set("Cache-Control", "no-store");
      res.json({ cafe: mapCafe(cafe), categories, items });
    })
  );

  app.patch(
    "/cafes/:slug",
    wrap(async (req, res) => {
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
        alt_milk_price: (() => {
          if (b.altMilkPrice !== undefined) {
            const n = Number(b.altMilkPrice);
            return Number.isFinite(n) && n >= 0 ? n : null;
          }
          if (b.alt_milk_price !== undefined) {
            const n = Number(b.alt_milk_price);
            return Number.isFinite(n) && n >= 0 ? n : null;
          }
          return null;
        })(),
        extra_shot_price: (() => {
          if (b.extraShotPrice !== undefined) {
            const n = Number(b.extraShotPrice);
            return Number.isFinite(n) && n >= 0 ? n : null;
          }
          if (b.extra_shot_price !== undefined) {
            const n = Number(b.extra_shot_price);
            return Number.isFinite(n) && n >= 0 ? n : null;
          }
          return null;
        })(),
        ordering_enabled: orderingEnabled,
      });
      res.json(mapCafe(updated));
    })
  );

  app.post(
    "/cafes/:slug/verify-owner",
    (req, res, next) => rateLimitPin(req, res, next, { keyExtra: `owner:${req.params.slug}` }),
    wrap(async (req, res) => {
      const cafe = await store.getCafeBySlug(req.params.slug);
      if (!cafe) return sendError(res, 404, "CAFE_NOT_FOUND", "Cafe not found");
      const parsed = pinBodySchema.safeParse(req.body || {});
      if (!parsed.success) return fromZod(res, parsed.error);
      res.json({ ok: safeEqualStr(parsed.data.pin, cafe.owner_pin) });
    })
  );

  app.post(
    "/cafes/:slug/verify-staff",
    (req, res, next) => rateLimitPin(req, res, next, { keyExtra: `staff:${req.params.slug}` }),
    wrap(async (req, res) => {
      const cafe = await store.getCafeBySlug(req.params.slug);
      if (!cafe) return sendError(res, 404, "CAFE_NOT_FOUND", "Cafe not found");
      const parsed = pinBodySchema.safeParse(req.body || {});
      if (!parsed.success) return fromZod(res, parsed.error);
      res.json({ ok: safeEqualStr(parsed.data.pin, cafe.staff_pin) });
    })
  );

  app.post(
    "/cafes/:slug/categories",
    wrap(async (req, res) => {
      const cafe = await requireOwner(store, req, res, req.params.slug);
      if (!cafe) return;
      const parsed = categorySchema.safeParse(req.body || {});
      if (!parsed.success) return fromZod(res, parsed.error);
      const name = (parsed.data.name || "New category").trim();
      const sort = (await store.maxCategorySort(cafe.id)) + 1;
      const id = nid("cat");
      const cat = await store.createCategory({ id, cafe_id: cafe.id, name, sort });
      await store.touchCafe(cafe.id);
      res.status(201).json(cat);
      await store.touchCafe(cafe.id);
    })
  );

  app.patch(
    "/cafes/:slug/categories/:id",
    wrap(async (req, res) => {
      const cafe = await requireOwner(store, req, res, req.params.slug);
      if (!cafe) return;
      const parsed = categorySchema.safeParse(req.body || {});
      if (!parsed.success) return fromZod(res, parsed.error);
      const updated = await store.updateCategory(req.params.id, cafe.id, parsed.data);
      if (!updated) return sendError(res, 404, "CATEGORY_NOT_FOUND", "Category not found");
      await store.touchCafe(cafe.id);
      res.json(updated);
    })
  );

  app.delete(
    "/cafes/:slug/categories/:id",
    wrap(async (req, res) => {
      const cafe = await requireOwner(store, req, res, req.params.slug);
      if (!cafe) return;
      const row = await store.getCategory(req.params.id, cafe.id);
      if (!row) return sendError(res, 404, "CATEGORY_NOT_FOUND", "Category not found");
      await store.deleteCategory(row.id, cafe.id);
      await store.touchCafe(cafe.id);
      res.json({ ok: true });
    })
  );

  app.post(
    "/cafes/:slug/items",
    wrap(async (req, res) => {
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
      const resolved = resolveItemModifiersAndFlags(b, null, cafe);
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
        has_milk: resolved.has_milk,
        has_extra_shot: resolved.has_extra_shot,
        modifiers: serializeModifiers(resolved.modifiers),
        active: b.active === false ? 0 : 1,
        available,
      });
      await store.touchCafe(cafe.id);
      res.status(201).json(mapItem(row));
    })
  );

  app.patch(
    "/cafes/:slug/items/:id",
    wrap(async (req, res) => {
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
      const resolved = resolveItemModifiersAndFlags(b, row, cafe);
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
        has_milk: resolved.has_milk,
        has_extra_shot: resolved.has_extra_shot,
        modifiers: serializeModifiers(resolved.modifiers),
        active: b.active !== undefined ? (b.active ? 1 : 0) : row.active,
        available,
      });
      await store.touchCafe(cafe.id);
      res.json(mapItem(updated));
    })
  );

  app.delete(
    "/cafes/:slug/items/:id",
    wrap(async (req, res) => {
      const cafe = await requireOwner(store, req, res, req.params.slug);
      if (!cafe) return;
      const row = await store.getItem(req.params.id, cafe.id);
      if (!row) return sendError(res, 404, "ITEM_NOT_FOUND", "Item not found");
      await store.deleteItem(row.id);
      await store.touchCafe(cafe.id);
      res.json({ ok: true });
    })
  );

  app.get(
    "/cafes/:slug/orders",
    wrap(async (req, res) => {
      const cafe = await requireStaff(store, req, res, req.params.slug);
      if (!cafe) return;
      const rows = (await store.listOrders(cafe.id)).map(mapOrder);
      res.json(rows);
    })
  );

  app.post(
    "/cafes/:slug/orders",
    (req, res, next) => rateLimitOrders(req, res, next),
    wrap(async (req, res) => {
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

      const pricedLines = [];
      const prepList = [];
      for (const line of lines) {
        const itemId = line.itemId || line.item_id;
        if (!itemId) return sendError(res, 400, "VALIDATION_ERROR", "itemId required on each line");
        const row = await store.getItem(itemId, cafe.id);
        if (!row || row.active === 0 || row.active === false) {
          return sendError(res, 400, "ITEM_UNAVAILABLE", "Item not found or inactive");
        }
        if (row.available === 0 || row.available === false) {
          return sendError(res, 400, "SOLD_OUT", `${row.name || "Item"} is sold out`);
        }
        pricedLines.push(priceLine(row, line, cafe));
        prepList.push(row.prep_minutes);
      }

      // Server recomputes — client subtotal/tax/total/unitPrice ignored
      const priced = recomputeOrder(pricedLines, cafe, prepList);
      const clientWait = Number(b.estimatedWait || b.estimated_wait);
      const wait = Number.isFinite(clientWait) && clientWait > 0
        ? Math.max(priced.estimatedWait, Math.min(120, clientWait))
        : priced.estimatedWait;

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
      // Always mint confirm code server-side (ignore client-supplied to avoid collisions / guessing)
      const confirmCode = genConfirmCode();

      const row = await store.createOrder({
        id,
        cafe_id: cafe.id,
        table_no: tableNo,
        guest_name: (b.guestName || b.guest_name || "Guest").trim() || "Guest",
        phone: (b.phone || "").trim(),
        notes: (b.notes || "").trim(),
        items: priced.lines,
        subtotal: priced.subtotal,
        tax: priced.tax,
        tax_name: priced.taxName,
        total: priced.total,
        status: "new",
        estimated_wait: Math.max(2, wait),
        confirm_code: confirmCode,
        dining_option: diningOption,
        created_at: now,
        updated_at: now,
      });
      res.status(201).json(mapOrder(row));
    })
  );

  app.patch(
    "/cafes/:slug/orders/:id",
    wrap(async (req, res) => {
      const cafe = await store.getCafeBySlug(req.params.slug);
      if (!cafe) return sendError(res, 404, "CAFE_NOT_FOUND", "Cafe not found");
      const row = await store.getOrder(req.params.id, cafe.id);
      if (!row) return sendError(res, 404, "ORDER_NOT_FOUND", "Order not found");
      const parsed = patchOrderSchema.safeParse(req.body || {});
      if (!parsed.success) return fromZod(res, parsed.error);
      const next = parsed.data.status;
      const staffPin = req.header("X-Staff-Pin") || "";
      const confirm = String(
        parsed.data.confirm || parsed.data.confirmCode || parsed.data.confirm_code || req.query.confirm || ""
      ).trim();
      const okStaff = staffPin && safeEqualStr(staffPin, cafe.staff_pin);
      const okConfirm = confirm && safeEqualStr(confirm, row.confirm_code || "");
      const open = !["paid", "cancelled"].includes(String(row.status || ""));

      if (next === "cancelled") {
        if (okStaff && open) {
          /* staff cancel/reject any open order */
        } else if (okConfirm && (row.status === "new" || row.status === "preparing")) {
          /* guest cancel with confirm code */
        } else if (!okStaff && !okConfirm) {
          return sendError(res, 401, "ORDER_AUTH_REQUIRED", "Provide confirm code or X-Staff-Pin");
        } else {
          return sendError(res, 403, "CANCEL_NOT_ALLOWED", "Order cannot be cancelled in its current status");
        }
      } else if (!okStaff) {
        return sendError(res, 401, "INVALID_STAFF_PIN", "Invalid staff PIN");
      }

      const updated = await store.updateOrderStatus(row.id, cafe.id, next, Date.now());
      res.json(mapOrder(updated));
    })
  );

  app.delete(
    "/cafes/:slug/orders/:id",
    wrap(async (req, res) => {
      const cafe = await requireStaff(store, req, res, req.params.slug);
      if (!cafe) return;
      const row = await store.getOrder(req.params.id, cafe.id);
      if (!row) return sendError(res, 404, "ORDER_NOT_FOUND", "Order not found");
      await store.deleteOrder(row.id);
      res.json({ ok: true });
    })
  );

  app.get(
    "/cafes/:slug/orders/:id",
    wrap(async (req, res) => {
      const cafe = await store.getCafeBySlug(req.params.slug);
      if (!cafe) return sendError(res, 404, "CAFE_NOT_FOUND", "Cafe not found");
      const row = await store.getOrder(req.params.id, cafe.id);
      if (!row) return sendError(res, 404, "ORDER_NOT_FOUND", "Order not found");

      const confirm = String(req.query.confirm || "").trim();
      const staffPin = req.header("X-Staff-Pin") || "";
      const okConfirm = confirm && safeEqualStr(confirm, row.confirm_code || "");
      const okStaff = staffPin && safeEqualStr(staffPin, cafe.staff_pin);
      if (!okConfirm && !okStaff) {
        return sendError(res, 401, "ORDER_AUTH_REQUIRED", "Provide ?confirm= code or X-Staff-Pin");
      }
      res.json(mapOrder(row));
    })
  );

  app.post(
    "/cafes/:slug/restore-demo",
    wrap(async (req, res) => {
      const cafe = await requireOwner(store, req, res, req.params.slug);
      if (!cafe) return;
      try {
        await resetCafe(cafe.slug);
        await store.touchCafe(cafe.id);
        const refreshed = await store.getCafeBySlug(cafe.slug);
        const categories = (await store.listCategories(refreshed.id)).map(mapCategory);
        const items = (await store.listItems(refreshed.id, { activeOnly: true })).map(mapItem);
        res.json({ ok: true, cafe: mapCafe(refreshed), categories, items });
      } catch (e) {
        const status = e && e.status ? e.status : 500;
        sendError(res, status, "RESTORE_FAILED", e.message || "Restore failed");
      }
    })
  );

  app.use((_req, res) => sendError(res, 404, "NOT_FOUND", "Not found"));

  // Final error middleware (after wrap() rejections)
  app.use((err, _req, res, _next) => {
    console.error(err);
    if (res.headersSent) return;
    const status = err.status || err.statusCode || 500;
    sendError(res, status, err.code || "INTERNAL", err.message || "Internal error");
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

module.exports = { createApp, mapOrder };
