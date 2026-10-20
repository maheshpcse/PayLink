# PayLink workspace

This folder contains two isolated projects built from the revised PayLink development prompt:

- `paylink-ui/` — Angular + TypeScript customer checkout and account UI.
- `paylink-server/` — TypeScript Node.js REST API with an offline in-memory repository, local MySQL migrations/seed commands, and a deterministic test payment provider.

PayLink is intentionally test-only: it does not contact a payment network or move real money. The obsolete root NoteDeck quiz app has been removed; only these two PayLink projects remain.

## Run the backend

Open PowerShell in `E:\MEAN\PayLink\paylink-server`:

```powershell
npm ci --offline
Copy-Item .env.example .env
npm start
```

The server listens at `http://127.0.0.1:4000`. `npm start` builds TypeScript before starting.

To create and verify the local MySQL schema/data using the credentials in `.env`:

```powershell
cd E:\MEAN\PayLink\paylink-server
npm run db:setup
npm run db:verify
```

## Run the frontend

In a second PowerShell window, open `E:\MEAN\PayLink\paylink-ui`:

```powershell
npm ci --offline
Copy-Item .env.example .env.local
npm run dev
```

Then open the Angular URL, normally `http://127.0.0.1:8200`.

With the server running, the UI uses the seeded demo customer and server-owned checkout data. Without a server or API URL, it still runs in clearly labeled local demo mode.

## Latest workspace updates

- The Angular app now runs on port `8200` and has a public landing page, separate checkout route, Help/FAQ/legal pages, sign-up, password reset, OTP, and account flows.
- The public shell keeps the navbar full width, starts scrolling below the navbar, and keeps the footer in normal page flow.
- Account navigation has a sidebar toggle at the far-right edge of the logo row. When collapsed, the PayLink logo remains visible and the expand icon appears on hover or keyboard focus.
- Payment activity and overview records expose linked primary values and visible **View details** actions that route to `/account/activity/:id`.
- Profile avatar upload/remove, preferences information, payment-detail links, and route scroll restoration are covered by the current UI implementation.
- GitHub Pages and Railway deployment files are included for the hosted test-mode frontend/backend setup.

## Test both projects

Backend:

```powershell
cd E:\MEAN\PayLink\paylink-server
npm run check
```

Frontend:

```powershell
cd E:\MEAN\PayLink\paylink-ui
npm test
npm run typecheck
npm run build
```

Browser automation is intentionally not part of this workspace. Playwright and its browser binaries were removed to keep the setup offline and lightweight; use the Angular unit/component tests and the manual smoke flow in `paylink-ui/README.md`.

The latest local verification is 21 frontend tests passed, frontend development/typecheck and production builds passed, and 8 backend tests passed through `npm run check`. The localhost UI/API servers are not left running after checks.

## Hosted deployment

The frontend has a GitHub Pages workflow at `.github/workflows/deploy-pages.yml`. It builds the Angular app with the repository-name base path, publishes an SPA-friendly `404.html`, and reads the public Railway API URL from the repository Actions variable `PAYLINK_API_BASE_URL`.

The backend has Railway deployment configuration at `paylink-server/railway.toml`. Railway uses the existing `paylink-server/Dockerfile`, injects `PORT`, and checks `GET /health`. Set `PAYLINK_CORS_ORIGINS` on Railway to the GitHub Pages origin and keep `PAYLINK_WEBHOOK_SECRET` out of git.

The HTTP backend still uses the explicitly labeled in-memory repository so the offline API suite remains deterministic. The local MySQL schema and seed are now reproducible through `npm run db:setup`; the runtime repository cutover remains a separate step before using MySQL-backed API traffic. Before production, configure a real payment provider in sandbox mode, add durable sessions/idempotency, and supply production secrets through a secret manager. See `paylink-server/README.md` and `paylink-server/migrations/` for details.
