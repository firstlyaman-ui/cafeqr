# CafeQR

QR table menu + cash ordering for small cafes. This monorepo has two parts:

| Folder | What it is |
|--------|------------|
| `api/` | Multi-cafe Express + SQLite API (seeded demo cafes) |
| `app/` | Expo (React Native) guest menu, cart, staff queue, and owner screens |

The app prefers the live API and falls back to a local seed if the API is unreachable.

## Quick start

### 1. API (port 8787)

```bash
cd api
npm install
npm start
# or: npm run seed && npm run dev
```

On first start the API creates `api/data/cafeqr.db` and seeds two demo cafes.

Health check: `http://localhost:8787/health`

### 2. Expo web app

```bash
cd app
npm install
npx expo start --web
```

Optional: point at a non-default API URL:

```bash
EXPO_PUBLIC_API_URL=http://localhost:8787 npx expo start --web
```

Dev default API base is `http://localhost:8787`; production builds default to `https://cafeqr-api.vercel.app` unless `EXPO_PUBLIC_API_URL` is set.

## Multi-cafe guest URLs

Guest menus use cafe-specific paths:

- `/c/<slug>/t/<table>`
- Legacy `/t/<n>` redirects to the default demo cafe

**Demo cafes**

| Cafe | Example guest URL |
|------|-------------------|
| Velvet Bean (USD · Tax 8%) | `/c/velvet-bean/t/04` |
| Spice Lane (INR · GST 5%) | `/c/spice-lane/t/03` |
| Himalayan Beans (NPR · VAT 13%) | `/c/himalayan-beans/t/04` |

Owner and staff screens take `?slug=` (e.g. `/owner?slug=velvet-bean`, `/staff?slug=spice-lane`). QR codes use the cafe-specific guest paths above.

## Demo PINs

Owner and staff PIN for both seeded cafes: **`1234`**

## Demo highlights (competitor-style)

- Sold-out / availability toggles (Spice Lane ships with Butter Pav Bhaji sold out)
- Staff 4-digit confirm codes before kitchen (Petpooja-style)
- Dine in / Takeaway at checkout
- Menu search; QR ordering pause from owner
- Custom tax name + rate per café (Nepal VAT 13%, India GST 5% with optional CGST/SGST split, US Tax 8%); WhatsApp share on receipt

## Layout

```
CafeQR/
  api/          Express API + SQLite
  app/          Expo Router app
  README.md
  .gitignore
```


## Deploy (Vercel)

Two Vercel projects (recommended):

1. **API** (`cafeqr-api`) — Project Root Directory = `api/`
   - Serverless Express via `api/api/index.js` + `api/vercel.json`
   - Uses `sql.js` on `/tmp` (ephemeral; re-seeded on cold start)

2. **Web** (`cafeqr`) — Project Root Directory = `app/`
   - Static Expo export to `dist` + SPA rewrites in `app/vercel.json`
   - Build command: `npx expo export --platform web` (matches `app/package.json` `build` / `export:web`)
   - Set env `EXPO_PUBLIC_API_URL` to the API production URL, then redeploy

### Critical: always deploy both projects from the monorepo root

`cafeqr` has **Root Directory = `app`** and `cafeqr-api` has **Root Directory = `api`**. Vercel expects the upload to contain the monorepo layout (`app/package.json` / `api/package.json`).

```bash
# Web (root .vercel → cafeqr)
cd /path/to/CafeQR
npx vercel --prod --yes --scope aman-42f1

# API (temporarily point root .vercel at cafeqr-api, then restore)
mv .vercel .vercel-web && cp -a api/.vercel .vercel
npx vercel --prod --yes --scope aman-42f1
rm -rf .vercel && mv .vercel-web .vercel
```

**Do not** run `vercel` from inside `app/` or `api/` alone — Root Directory still expects the parent folder, and the deploy can alias a broken empty build.

Also do not create `app/.vercel` linked to `cafeqr` — keep project links under monorepo root / `api/.vercel` for the swap above.

Demo paths: `/c/velvet-bean/t/04`, `/c/spice-lane/t/03`, `/c/himalayan-beans/t/04`

### Database durability

- **Local:** SQLite file at `api/data/cafeqr.db`
- **Vercel without `DATABASE_URL`:** sql.js under `/tmp` (ephemeral — demo only)
- **Production:** set `DATABASE_URL` (Neon free / Vercel Postgres). Adapter: `PostgresStore` when URL present, else `SqliteStore`.

Neon one-time setup (browser terms required):

1. Accept terms: https://vercel.com/aman-42f1/~/integrations/accept-terms/neon?source=cli
2. `cd api && npx vercel integration add neon --scope aman-42f1 -p free_v3 -m region=iad1 -m auth=false -n cafeqr-db`
3. Redeploy `cafeqr-api`

### Required env vars

| Project | Variable | Purpose |
|---------|----------|---------|
| `cafeqr` (web) | `EXPO_PUBLIC_API_URL` | API origin (prod: `https://cafeqr-api.vercel.app`) |
| `cafeqr-api` | `DATABASE_URL` | Durable Postgres (recommended) |
| `cafeqr-api` | `CORS_ORIGINS` | Comma allowlist (set; includes cafeqr-five + localhost) |

Health: `GET https://cafeqr-api.vercel.app/health` → `{ ok, db, driver, version }`

## Product notes

- Owner menu CRUD talks to the API with PIN auth; failed saves show inline errors (no silent failures).
- `POST /cafes/:slug/restore-demo` (X-Owner-Pin) resets a seeded café to the demo menu — wired to Owner → Restore demo.
- Printable receipt at `/order/<id>/invoice` (`window.print` on web).
- Haptics via `expo-haptics` on native (add-to-cart, place order, PIN, staff status); no-op on web.
- Soft visual refresh: lighter borders, rounded cards, ink/cream/amber palette kept.
