/**
 * CafeQR DB adapter layer.
 *
 * Fail-closed in production / Vercel:
 * - DATABASE_URL set + Postgres fails → throw (no SQLite fallback)
 *   unless CAFEQR_ALLOW_SQLITE_FALLBACK=1 AND not VERCEL AND not production
 * - No DATABASE_URL on VERCEL / production → throw
 * - Local/dev without DATABASE_URL → SQLite OK
 */

const { createSqliteStore } = require("./sqlite-store");
const { createPostgresStore } = require("./postgres-store");

let storePromise = null;

function databaseUrl() {
  return (
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.POSTGRES_PRISMA_URL ||
    ""
  ).trim();
}

function isProdLike() {
  return !!(process.env.VERCEL || process.env.NODE_ENV === "production");
}

function allowSqliteFallback() {
  return (
    process.env.CAFEQR_ALLOW_SQLITE_FALLBACK === "1" &&
    !process.env.VERCEL &&
    process.env.NODE_ENV !== "production"
  );
}

async function getStore() {
  if (storePromise) return storePromise;
  storePromise = (async () => {
    const url = databaseUrl();
    if (url) {
      try {
        return await createPostgresStore(url);
      } catch (e) {
        if (allowSqliteFallback()) {
          console.error("[db] Postgres init failed, SQLite fallback allowed:", e.message);
          return createSqliteStore();
        }
        console.error("[db] Postgres init failed (fail-closed):", e.message);
        throw e;
      }
    }
    if (isProdLike()) {
      throw new Error(
        "DATABASE_URL is required on Vercel/production — refusing SQLite (ephemeral /tmp is not durable)"
      );
    }
    console.log("[db] no DATABASE_URL — using SQLite adapter (local/dev)");
    return createSqliteStore();
  })();
  return storePromise;
}

function resetStoreCache() {
  storePromise = null;
}

module.exports = { getStore, databaseUrl, resetStoreCache, isProdLike, allowSqliteFallback };
