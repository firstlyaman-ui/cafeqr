const fs = require("fs");
const path = require("path");

const ON_VERCEL = !!(process.env.VERCEL || process.env.VERCEL_ENV);
const DATA_DIR = ON_VERCEL ? path.join("/tmp", "cafeqr-data") : path.join(__dirname, "..", "data");
const DB_PATH = path.join(DATA_DIR, "cafeqr.db");

let Database;
let useSqlJs = false;
let sqlJsDb = null;
let sqlJsSQL = null;

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function tryBetterSqlite3() {
  try {
    Database = require("better-sqlite3");
    return true;
  } catch (e) {
    return false;
  }
}

async function initSqlJs() {
  const initSqlJsFn = require("sql.js");
  // .wasm is not in package "exports"; load beside the resolved JS entry.
  const wasmPath = path.join(path.dirname(require.resolve("sql.js")), "sql-wasm.wasm");
  const wasmBinary = fs.readFileSync(wasmPath);
  sqlJsSQL = await initSqlJsFn({ wasmBinary });
  if (fs.existsSync(DB_PATH)) {
    const buf = fs.readFileSync(DB_PATH);
    sqlJsDb = new sqlJsSQL.Database(buf);
  } else {
    sqlJsDb = new sqlJsSQL.Database();
  }
  useSqlJs = true;
}

function persistSqlJs() {
  if (!sqlJsDb) return;
  const data = sqlJsDb.export();
  fs.writeFileSync(DB_PATH, Buffer.from(data));
}

/** Thin wrapper so both better-sqlite3 and sql.js share one API */
function createAdapter(bs3) {
  if (bs3) {
    const db = new Database(DB_PATH);
    db.pragma("journal_mode = WAL");
    db.pragma("foreign_keys = ON");
    return {
      exec(sql) {
        db.exec(sql);
      },
      prepare(sql) {
        const stmt = db.prepare(sql);
        return {
          run(...params) {
            const info = stmt.run(...params);
            return { changes: info.changes, lastInsertRowid: Number(info.lastInsertRowid) };
          },
          get(...params) {
            return stmt.get(...params);
          },
          all(...params) {
            return stmt.all(...params);
          },
        };
      },
      transaction(fn) {
        return db.transaction(fn)();
      },
    };
  }

  // sql.js adapter
  return {
    exec(sql) {
      sqlJsDb.run(sql);
      persistSqlJs();
    },
    prepare(sql) {
      return {
        run(...params) {
          sqlJsDb.run(sql, params);
          const changes = sqlJsDb.getRowsModified();
          let lastInsertRowid = 0;
          try {
            const r = sqlJsDb.exec("SELECT last_insert_rowid() as id");
            if (r[0] && r[0].values[0]) lastInsertRowid = Number(r[0].values[0][0]);
          } catch (_) {}
          persistSqlJs();
          return { changes, lastInsertRowid };
        },
        get(...params) {
          const stmt = sqlJsDb.prepare(sql);
          stmt.bind(params);
          if (stmt.step()) {
            const row = stmt.getAsObject();
            stmt.free();
            return row;
          }
          stmt.free();
          return undefined;
        },
        all(...params) {
          const stmt = sqlJsDb.prepare(sql);
          stmt.bind(params);
          const rows = [];
          while (stmt.step()) rows.push(stmt.getAsObject());
          stmt.free();
          return rows;
        },
      };
    },
    transaction(fn) {
      sqlJsDb.run("BEGIN");
      try {
        const result = fn();
        sqlJsDb.run("COMMIT");
        persistSqlJs();
        return result;
      } catch (e) {
        sqlJsDb.run("ROLLBACK");
        throw e;
      }
    },
  };
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS cafes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
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
  tax_rate REAL DEFAULT 0.08,
  alt_milk_price REAL,
  extra_shot_price REAL,
  owner_pin TEXT DEFAULT '1234',
  staff_pin TEXT DEFAULT '1234',
  owner_user TEXT DEFAULT '',
  owner_password TEXT DEFAULT '',
  staff_user TEXT DEFAULT '',
  staff_password TEXT DEFAULT '',
  ordering_enabled INTEGER DEFAULT 1,
  updated_at INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,
  cafe_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  sort INTEGER DEFAULT 0,
  FOREIGN KEY (cafe_id) REFERENCES cafes(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS items (
  id TEXT PRIMARY KEY,
  cafe_id INTEGER NOT NULL,
  category_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  price REAL NOT NULL,
  prep_minutes INTEGER DEFAULT 5,
  tags TEXT DEFAULT '[]',
  image TEXT DEFAULT '',
  has_milk INTEGER DEFAULT 0,
  has_extra_shot INTEGER DEFAULT 0,
  modifiers TEXT DEFAULT '[]',
  active INTEGER DEFAULT 1,
  available INTEGER DEFAULT 1,
  FOREIGN KEY (cafe_id) REFERENCES cafes(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  cafe_id INTEGER NOT NULL,
  table_no TEXT NOT NULL,
  guest_name TEXT DEFAULT 'Guest',
  phone TEXT DEFAULT '',
  notes TEXT DEFAULT '',
  items TEXT NOT NULL,
  subtotal REAL NOT NULL,
  tax REAL NOT NULL,
  tax_name TEXT DEFAULT '',
  total REAL NOT NULL,
  status TEXT DEFAULT 'new',
  estimated_wait INTEGER DEFAULT 5,
  confirm_code TEXT DEFAULT '',
  dining_option TEXT DEFAULT 'dine_in',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (cafe_id) REFERENCES cafes(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_categories_cafe ON categories(cafe_id);
CREATE INDEX IF NOT EXISTS idx_items_cafe ON items(cafe_id);
CREATE INDEX IF NOT EXISTS idx_orders_cafe ON orders(cafe_id);
`;

function columnNames(adapter, table) {
  try {
    return adapter.prepare(`PRAGMA table_info(${table})`).all().map((r) => r.name);
  } catch (_) {
    return [];
  }
}

/** Additive migrations for existing sql.js /tmp DBs */
function migrate(adapter) {
  const cafeCols = columnNames(adapter, "cafes");
  if (cafeCols.length && !cafeCols.includes("ordering_enabled")) {
    adapter.exec("ALTER TABLE cafes ADD COLUMN ordering_enabled INTEGER DEFAULT 1");
  }
  if (cafeCols.length && !cafeCols.includes("country")) {
    adapter.exec("ALTER TABLE cafes ADD COLUMN country TEXT DEFAULT 'US'");
  }
  if (cafeCols.length && !cafeCols.includes("tax_name")) {
    adapter.exec("ALTER TABLE cafes ADD COLUMN tax_name TEXT DEFAULT 'Tax'");
  }
  if (cafeCols.length && !cafeCols.includes("tax_rate")) {
    adapter.exec("ALTER TABLE cafes ADD COLUMN tax_rate REAL DEFAULT 0.08");
  }
  if (cafeCols.length && !cafeCols.includes("alt_milk_price")) {
    adapter.exec("ALTER TABLE cafes ADD COLUMN alt_milk_price REAL");
  }
  if (cafeCols.length && !cafeCols.includes("extra_shot_price")) {
    adapter.exec("ALTER TABLE cafes ADD COLUMN extra_shot_price REAL");
  }

  if (cafeCols.length && !cafeCols.includes("updated_at")) {
    adapter.exec("ALTER TABLE cafes ADD COLUMN updated_at INTEGER DEFAULT 0");
    try {
      adapter.exec("UPDATE cafes SET updated_at = CAST(strftime('%s','now') AS INTEGER) * 1000 WHERE updated_at IS NULL OR updated_at = 0");
    } catch (_) {}
  }

  for (const col of ["owner_user", "owner_password", "staff_user", "staff_password"]) {
    if (cafeCols.length && !cafeCols.includes(col)) {
      adapter.exec(`ALTER TABLE cafes ADD COLUMN ${col} TEXT DEFAULT ''`);
    }
  }
  try {
    const { defaultCredsForSlug } = require("./auth");
    const rows = adapter.prepare("SELECT id, slug, owner_user, staff_user, owner_password, staff_password FROM cafes").all();
    for (const c of rows) {
      if (c.owner_user && c.staff_user && c.owner_password && c.staff_password) continue;
      const creds = defaultCredsForSlug(c.slug);
      adapter
        .prepare(
          `UPDATE cafes SET
            owner_user = CASE WHEN owner_user IS NULL OR owner_user = '' THEN ? ELSE owner_user END,
            staff_user = CASE WHEN staff_user IS NULL OR staff_user = '' THEN ? ELSE staff_user END,
            owner_password = CASE WHEN owner_password IS NULL OR owner_password = '' THEN ? ELSE owner_password END,
            staff_password = CASE WHEN staff_password IS NULL OR staff_password = '' THEN ? ELSE staff_password END
           WHERE id = ?`
        )
        .run(creds.owner_user, creds.staff_user, creds.owner_password, creds.staff_password, c.id);
    }
  } catch (_) {}

  const itemCols = columnNames(adapter, "items");
  if (itemCols.length && !itemCols.includes("available")) {
    adapter.exec("ALTER TABLE items ADD COLUMN available INTEGER DEFAULT 1");
  }
  if (itemCols.length && !itemCols.includes("modifiers")) {
    adapter.exec("ALTER TABLE items ADD COLUMN modifiers TEXT DEFAULT '[]'");
  }
  // Backfill structured modifiers from legacy flags when empty
  try {
    const { modifiersFromFlags, parseModifiers, serializeModifiers } = require("./modifiers");
    const cafes = adapter.prepare("SELECT id, currency FROM cafes").all();
    const cafeCur = Object.fromEntries(cafes.map((c) => [c.id, c.currency]));
    const items = adapter.prepare("SELECT id, cafe_id, has_milk, has_extra_shot, modifiers FROM items").all();
    const upd = adapter.prepare("UPDATE items SET modifiers = ? WHERE id = ?");
    for (const it of items) {
      const existing = parseModifiers(it.modifiers);
      if (existing.length) continue;
      if (!it.has_milk && !it.has_extra_shot) continue;
      const mods = modifiersFromFlags(!!it.has_milk, !!it.has_extra_shot, cafeCur[it.cafe_id]);
      if (mods.length) upd.run(serializeModifiers(mods), it.id);
    }
  } catch (_) {}

  const orderCols = columnNames(adapter, "orders");
  if (orderCols.length && !orderCols.includes("confirm_code")) {
    adapter.exec("ALTER TABLE orders ADD COLUMN confirm_code TEXT DEFAULT ''");
  }
  if (orderCols.length && !orderCols.includes("dining_option")) {
    adapter.exec("ALTER TABLE orders ADD COLUMN dining_option TEXT DEFAULT 'dine_in'");
  }
  if (orderCols.length && !orderCols.includes("tax_name")) {
    adapter.exec("ALTER TABLE orders ADD COLUMN tax_name TEXT DEFAULT ''");
  }

  // Backfill tax defaults from currency when missing / legacy rows
  try {
    adapter.exec(`UPDATE cafes SET country = 'IN', tax_name = 'GST', tax_rate = 0.05 WHERE currency = 'INR' AND (country IS NULL OR country = '' OR country = 'US') AND (tax_name IS NULL OR tax_name = '' OR tax_name = 'Tax')`);
    adapter.exec(`UPDATE cafes SET country = 'NP', tax_name = 'VAT', tax_rate = 0.13 WHERE currency = 'NPR'`);
  } catch (_) {}
}

let adapter = null;

async function getDb() {
  if (adapter) return adapter;
  ensureDir();
  const preferSqlJs = ON_VERCEL || process.env.CAFEQR_USE_SQLJS === "1";
  if (!preferSqlJs && tryBetterSqlite3()) {
    adapter = createAdapter(true);
    adapter.exec(SCHEMA);
    migrate(adapter);
    console.log("[db] better-sqlite3 @", DB_PATH);
  } else {
    console.log(preferSqlJs ? "[db] using sql.js (Vercel/ephemeral)" : "[db] better-sqlite3 unavailable, falling back to sql.js");
    await initSqlJs();
    adapter = createAdapter(false);
    adapter.exec(SCHEMA);
    migrate(adapter);
    console.log("[db] sql.js @", DB_PATH);
  }
  return adapter;
}

module.exports = { getDb, DB_PATH, DATA_DIR, migrate };
