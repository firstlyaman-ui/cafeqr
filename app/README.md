# CafeQred (Expo app)

Multi-cafe QR ordering — guest menu, bag/checkout, staff board, owner setup.

- Guest: `/c/<slug>/t/<table>`
- Receipt: `/order/<id>/invoice` (print on web)
- Owner / staff: `/owner?slug=…`, `/staff?slug=…` (PIN `1234`)
- Prefers live API via `EXPO_PUBLIC_API_URL`; falls back to local seed

See monorepo root README for API + deploy.
