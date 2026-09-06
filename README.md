# CafeQred

QR table menu + cash ordering for small cafes. This monorepo has two parts:

| Folder | What it is |
|--------|------------|
| `api/` | Multi-cafe Express API (Neon Postgres in prod; SQLite locally) |
| `app/` | One Expo codebase → **three** role-locked Vercel web apps |

The app prefers the live API and falls back to a local seed if the API is unreachable.

## Three apps (role isolation)

One shared `app/` codebase, three production sites. Build-time `EXPO_PUBLIC_APP_ROLE` sets the entry route, Metro-blocks other role screens, and a layout `RoleGuard` refuses forbidden paths.

| App | Role | Production URL | Routes |
|-----|------|----------------|--------|
| **cafeqr** | customer | https://cafeqr-five.vercel.app | Landing, `/c/[slug]/t/[table]`, cart, checkout, order status, invoice |
| **cafeqr-staff** | staff | https://cafeqr-staff.vercel.app | `/staff` board + `/staff/qr` |
| **cafeqr-owner** | owner | https://cafeqr-owner.vercel.app | `/owner` setup + menu CRUD + QR print |
| **cafeqr-api** | API | https://cafeqr-api.vercel.app | Shared backend |

Cross-links (e.g. “Open guest menu”, “Staff app”) are **external** `https://` URLs only — never in-app routes into another role’s UI. Separate origins ⇒ separate PIN sessions (`staffOk` / `ownerOk`).

### Instant refresh

- **Staff board:** polls orders every **2s** while unlocked + refetch on focus
- **Guest order status:** polls every **2s** until `paid`
- **Guest menu:** refetches cafe/menu every **10s** (and on focus). API bumps `cafe.updatedAt` on profile/menu changes

Demo PIN for seeded cafés on staff/owner apps: **`1234`**.

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

Owner / staff live on their own apps with `?slug=` (e.g. `https://cafeqr-owner.vercel.app/owner?slug=velvet-bean`, `https://cafeqr-staff.vercel.app/staff?slug=spice-lane`). Printed QR codes always open the **customer** origin (`EXPO_PUBLIC_CUSTOMER_URL`).

## Demo PINs

Owner and staff PIN for seeded demos (Velvet Bean / Spice Lane / Himalayan Beans): **`1234`**  
(`1234` is reserved for seed demos only — `POST /cafes` rejects it for new cafes. Optional `DEMO_OWNER_PIN` / `DEMO_STAFF_PIN` override on seed.)

## Demo highlights (competitor-style)

- Sold-out / availability toggles (Spice Lane ships with Butter Pav Bhaji sold out)
- Staff: cash-first flow (`new` → Cash received · Approve → preparing → ready); confirm dialogs on Cancel/Approve; guest confirm codes on `new`
- Dine in / Takeaway at checkout
- Menu search; QR ordering pause from owner
- Custom tax name + rate per café (Nepal VAT 13%, India GST 5% with optional CGST/SGST split, US Tax 8%); WhatsApp share on receipt
- Owner menu: photo URL + preview; per-item customisations (milk options, extra shot, custom groups) with live guest options

## Layout

```
CafeQred/
  api/          Express API + SQLite
  app/          Expo Router app
  README.md
  .gitignore
```


## Deploy (Vercel)

Four Vercel projects, all deployed from the **monorepo root** (team `aman-42f1`, CLI user `firstlyaman-ui`):

| Project | Root Directory | Key env |
|---------|----------------|---------|
| `cafeqr-api` | `api` | `DATABASE_URL`, `CORS_ORIGINS` |
| `cafeqr` (customer) | `app` | `EXPO_PUBLIC_APP_ROLE=customer`, `EXPO_PUBLIC_API_URL`, `EXPO_PUBLIC_CUSTOMER_URL`, `EXPO_PUBLIC_STAFF_URL`, `EXPO_PUBLIC_OWNER_URL` |
| `cafeqr-staff` | `app` | `EXPO_PUBLIC_APP_ROLE=staff` + same URL envs |
| `cafeqr-owner` | `app` | `EXPO_PUBLIC_APP_ROLE=owner` + same URL envs |

Web build command (all three): `npx expo export --platform web` (Metro reads `EXPO_PUBLIC_APP_ROLE` and blockLists other-role routes).

```bash
# Customer (root .vercel → cafeqr)
cd /path/to/CafeQR
npx vercel --prod --yes --scope aman-42f1

# API (swap .vercel → cafeqr-api)
mv .vercel .vercel-web && cp -a api/.vercel .vercel
npx vercel --prod --yes --scope aman-42f1
rm -rf .vercel && mv .vercel-web .vercel

# Staff / Owner: link or create projects with Root Directory = app, then:
#   npx vercel link --yes --scope aman-42f1 --project cafeqr-staff
#   set EXPO_PUBLIC_APP_ROLE=staff (and URL envs) then vercel --prod
```

**Do not** run `vercel` from inside `app/` or `api/` alone — Root Directory still expects the parent folder.

Demo paths (customer): `/c/velvet-bean/t/04`, `/c/spice-lane/t/03`, `/c/himalayan-beans/t/04`

### Database durability

- **Local:** SQLite file at `api/data/cafeqr.db`
- **Vercel without `DATABASE_URL`:** sql.js under `/tmp` (ephemeral — demo only)
- **Production:** set `DATABASE_URL` (Neon free / Vercel Postgres). Adapter: `PostgresStore` when URL present, else `SqliteStore`.

### Required env vars

| Project | Variable | Purpose |
|---------|----------|---------|
| web apps | `EXPO_PUBLIC_API_URL` | `https://cafeqr-api.vercel.app` |
| web apps | `EXPO_PUBLIC_APP_ROLE` | `customer` \| `staff` \| `owner` |
| web apps | `EXPO_PUBLIC_CUSTOMER_URL` | `https://cafeqr-five.vercel.app` |
| web apps | `EXPO_PUBLIC_STAFF_URL` | `https://cafeqr-staff.vercel.app` |
| web apps | `EXPO_PUBLIC_OWNER_URL` | `https://cafeqr-owner.vercel.app` |
| `cafeqr-api` | `DATABASE_URL` | Durable Postgres (recommended) |
| `cafeqr-api` | `CORS_ORIGINS` | Allowlist (cafeqr-five / staff / owner + localhost); wildcard pattern also allows `cafeqr*.vercel.app` |


### Google products (optional)

| Variable | Purpose |
|----------|---------|
| `EXPO_PUBLIC_GOOGLE_CLIENT_ID` | OAuth **Web** client ID for “Continue with Google” on the guest welcome screen (GIS on web; AuthSession when available). Guest path always works without it. |
| `EXPO_PUBLIC_GA_ID` | GA4 measurement ID (e.g. `G-XXXX`). Pageviews on landing / menu / order when set; no-op when unset. |

Also built-in (no key): Google Fonts (DM Sans + Fraunces on web), Google Maps links from cafe address (`maps.google.com` search — no Maps JS billing).

Later / not in this pitch: AdMob, Gmail API, YouTube, Cloud Vision, Play Console listing, Google Pay / UPI.

Health: `GET https://cafeqr-api.vercel.app/health` → `{ ok, db, driver, version }`

## Product notes

- Owner menu CRUD talks to the API with PIN auth; failed saves show inline errors (no silent failures).
- `POST /cafes/:slug/restore-demo` (X-Owner-Pin) resets a seeded café to the demo menu — wired to Owner → Restore demo.
- Printable receipt at `/order/<id>/invoice` (`window.print` on web).
- Haptics via `expo-haptics` on native (add-to-cart, place order, PIN, staff status); no-op on web.
- Soft visual refresh: lighter borders, rounded cards, ink/cream/amber palette kept.
