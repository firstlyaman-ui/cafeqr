# CafeQR API

Express API. Set DATABASE_URL for Postgres (Neon). Without it, SQLite/sql.js (ephemeral on Vercel /tmp).

Neon terms: https://vercel.com/aman-42f1/~/integrations/accept-terms/neon?source=cli
Then: npx vercel integration add neon --scope aman-42f1 -p free_v3 -m region=iad1 -m auth=false -n cafeqr-db

Env: DATABASE_URL, CORS_ORIGINS, ORDER_RATE_LIMIT
Health: GET /health -> { ok, db, driver, version }
Errors: { error: { code, message } }
