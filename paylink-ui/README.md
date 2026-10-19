# PayLink UI

PayLink UI is the Angular customer-facing checkout and payment-companion application required by the revised PayLink prompt. It uses Angular CLI, TypeScript, Angular Router, HttpClient, Reactive Forms, RxJS, and standalone lazy-loaded feature components.

This MVP is intentionally **test mode**. It does not process real payments, contact card or bank networks, or store raw card details. The browser keeps the bearer session in memory only.

## Requirements

- Node.js **24.19.0** (`.nvmrc`)
- npm 11 or newer

## Setup

From this directory:

```powershell
npm ci --offline
```

If the npm cache is not available on a new machine, run `npm ci` once with network access.

## Run the app

Start Angular development mode:

```powershell
npm start
```

Open <http://127.0.0.1:4173>. The development server proxies `/api` to `http://127.0.0.1:4000`; start `paylink-server` separately for the integrated server-owned flow. If the API is unavailable, the UI visibly switches to labeled local demo data.

To use local demo data without API calls:

```powershell
npx ng serve --configuration demo --host 127.0.0.1 --port 4173
```

## Check the app

```powershell
npm test
npm run typecheck
npm run build
```

These commands run Angular/Vitest component and service tests, a development compilation/typecheck, and a production Angular CLI build. Browser automation was intentionally removed from this workspace to keep setup offline and avoid installing a browser binary; use the Angular test suite plus the manual flow below.

## Manual smoke flow

1. Start `paylink-server` in another terminal.
2. Open the UI at <http://127.0.0.1:4173/checkout>.
3. Confirm the checkout amount says **$189.00** and **Fixed by server**.
4. Select Success, Pending, or Declined and submit the test payment.
5. Confirm the result explicitly says test mode and no money moved.
6. Open the account area to review Activity, Saved methods, Notifications, Profile, Preferences, and Support.
7. Stop the server and reload to verify the local demo warning and fallback remain honest.

## Main routes

- `/checkout` — fixed-amount checkout with test outcomes and safe retry state.
- `/auth` — sign-in and local demo access.
- `/account/overview` — compact account overview.
- `/account/activity` and `/account/activity/:id` — filterable activity and payment detail.
- `/account/methods` — masked method list and ownership-checked removal.
- `/account/notifications` — read state and notification inbox.
- `/account/profile` — profile and two-step security settings.
- `/account/preferences` — communication preferences.
- `/account/support` — support ticket form and ticket list.
- `/help`, `/terms`, `/privacy` — honest editable information routes.

## Project layout

```text
src/app/app.routes.ts                 Lazy route map and account guard
src/app/core/paylink-api.service.ts   HttpClient API adapter and demo fallback
src/app/core/request.interceptor.ts   Trusted-origin auth/correlation/idempotency headers
src/app/core/paylink-store.service.ts RxJS application state
src/app/pages/                         Checkout, auth, account, support, and legal pages
src/app/shared/                        Reusable accessible UI components
src/app/**/*.spec.ts                   Angular/Vitest unit and component tests
```

## Production gaps

The connected backend is still an explicitly labeled in-memory development repository with a deterministic test provider. Production requires durable MySQL persistence, real provider-hosted tokenization, verified email/OTP/MFA flows, durable sessions, rate-limit storage, TLS termination, CSP review for the chosen gateway, notification delivery workers, receipt storage, and legal/privacy review.
