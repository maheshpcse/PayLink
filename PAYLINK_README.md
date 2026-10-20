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

The HTTP backend still uses the explicitly labeled in-memory repository so the offline API suite remains deterministic. The local MySQL schema and seed are now reproducible through `npm run db:setup`; the runtime repository cutover remains a separate step before using MySQL-backed API traffic. Before production, configure a real payment provider in sandbox mode, add durable sessions/idempotency, and supply production secrets through a secret manager. See `paylink-server/README.md` and `paylink-server/migrations/` for details.
