/**
 * CafeQR DB adapter layer.
 *
 * - PostgresStore when DATABASE_URL (or POSTGRES_URL) is set — production durability
 * - SqliteStore otherwise — local / ephemeral Vercel fallback (sql.js under /tmp)
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

async function getStore() {
  if (storePromise) return storePromise;
  storePromise = (async () => {
    const url = databaseUrl();
    if (url) {
      try {
        return await createPostgresStore(url);
      } catch (e) {
        console.error("[db] Postgres init failed, falling back to SQLite:", e.message);
        return createSqliteStore();
      }
    }
    console.log("[db] no DATABASE_URL — using SQLite adapter (ephemeral on Vercel /tmp)");
    return createSqliteStore();
  })();
  return storePromise;
}

function resetStoreCache() {
  storePromise = null;
}

module.exports = { getStore, databaseUrl, resetStoreCache };
