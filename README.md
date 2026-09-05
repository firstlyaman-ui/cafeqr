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

Default API base in code is `http://localhost:8787` (override with `EXPO_PUBLIC_API_URL`).

## Multi-cafe guest URLs

Guest menus use cafe-specific paths:

- `/c/<slug>/t/<table>`
- Legacy `/t/<n>` redirects to the default demo cafe

**Demo cafes**

| Cafe | Example guest URL |
|------|-------------------|
| Velvet Bean | `/c/velvet-bean/t/04` |
| Spice Lane | `/c/spice-lane/t/03` |

Owner and staff screens take `?slug=` (e.g. `/owner?slug=velvet-bean`, `/staff?slug=spice-lane`). QR codes use the cafe-specific guest paths above.

## Demo PINs

Owner and staff PIN for both seeded cafes: **`1234`**

## Demo highlights (competitor-style)

- Sold-out / availability toggles (Spice Lane ships with Butter Pav Bhaji sold out)
- Staff 4-digit confirm codes before kitchen (Petpooja-style)
- Dine in / Takeaway at checkout
- Menu search; QR ordering pause from owner
- INR invoices show CGST 2.5% + SGST 2.5%; WhatsApp share on receipt

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

### Critical: always deploy the web app from the monorepo root

The `cafeqr` project keeps **Root Directory = `app`**. That means Vercel expects the upload to contain `app/package.json` (monorepo layout).

```bash
# From repo root (correct)
cd /path/to/CafeQR   # monorepo root — must see both api/ and app/
npx vercel --prod --yes --scope aman-42f1
```

**Do not** run `vercel` from inside `app/`. That uploads only the app folder while Root Directory is still `app`, so the build looks for `app/package.json` inside an already-app tree and fails with:

`ConfigError: The expected package.json path: /vercel/path0/app/package.json does not exist`

Also do not create `app/.vercel` linked to `cafeqr` — link only the monorepo root (`.vercel/` is gitignored).

Demo paths: `/c/velvet-bean/t/04`, `/c/spice-lane/t/03`

**Caveat:** serverless SQLite under `/tmp` is not durable across instances/cold starts. Fine for demos; use a hosted DB for production.

## Product notes

- Owner menu CRUD talks to the API with PIN auth; failed saves show inline errors (no silent failures).
- `POST /cafes/:slug/restore-demo` (X-Owner-Pin) resets a seeded café to the demo menu — wired to Owner → Restore demo.
- Printable receipt at `/order/<id>/invoice` (`window.print` on web).
- Haptics via `expo-haptics` on native (add-to-cart, place order, PIN, staff status); no-op on web.
- Soft visual refresh: lighter borders, rounded cards, ink/cream/amber palette kept.
