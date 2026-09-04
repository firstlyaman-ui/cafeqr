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

## Layout

```
CafeQR/
  api/          Express API + SQLite
  app/          Expo Router app
  README.md
  .gitignore
```


## Deploy (Vercel)



Two projects (recommended):



1. **API** — root directory `api/`

   - Serverless Express via `api/api/index.js` + `api/vercel.json`

   - Uses `sql.js` on `/tmp` (ephemeral; re-seeded on cold start)

2. **Web** — root directory `app/`

   - Static Expo export (`dist`) + SPA rewrites in `app/vercel.json`

   - Set `EXPO_PUBLIC_API_URL` to the API production URL, then redeploy



Demo paths: `/c/velvet-bean/t/04`, `/c/spice-lane/t/03`



**Caveat:** serverless SQLite under `/tmp` is not durable across instances/cold starts. Fine for demos; use a hosted DB for production.
