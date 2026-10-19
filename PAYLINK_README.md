# PayLink workspace

This folder contains two isolated projects built from `PayLink_App_Master_Development_Prompt.md`:

- `paylink-ui/` — React + TypeScript + Vite customer checkout and account UI.
- `paylink-server/` — TypeScript Node.js REST API with an explicitly labeled in-memory demo repository and deterministic test payment provider.

The existing root NoteDeck app remains unchanged. PayLink is intentionally test-only: it does not contact a payment network or move real money.

## Run the backend

Open PowerShell in `E:\MEAN\PayLink\paylink-server`:

```powershell
npm ci --offline
Copy-Item .env.example .env
npm start
```

The server listens at `http://127.0.0.1:4000`. `npm start` builds TypeScript before starting.

## Run the frontend

In a second PowerShell window, open `E:\MEAN\PayLink\paylink-ui`:

```powershell
npm ci --offline
Copy-Item .env.example .env.local
npm run dev
```

Then open the Vite URL, normally `http://localhost:4173`.

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

The backend currently uses memory so it can be tested offline. Before production, replace it with the documented MySQL repository, configure a real payment provider in sandbox mode, add durable sessions/idempotency, and supply production secrets through a secret manager. See each project's README for API details and the migration in `paylink-server/migrations/001_init.sql`.
