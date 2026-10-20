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

Open <http://127.0.0.1:8200>. The development server proxies `/api` to `http://127.0.0.1:4000`; start `paylink-server` separately for the integrated server-owned flow. If the API is unavailable, the UI visibly switches to labeled local demo data.

To use local demo data without API calls:

```powershell
npx ng serve --configuration demo --host 127.0.0.1 --port 8200
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
2. Open the UI at <http://127.0.0.1:8200/>.
3. Confirm the checkout amount says **$189.00** and **Fixed by server**.
4. Select Success, Pending, or Declined and submit the test payment.
5. Confirm the result explicitly says test mode and no money moved.
6. Open the account area to review Activity, Saved methods, Notifications, Profile, Preferences, and Support.
7. Stop the server and reload to verify the local demo warning and fallback remain honest.

## Latest UI updates

- Public navigation now has a full-width PayLink navbar, a public scroll region below the navbar, and a footer that stays in normal document flow.
- The account sidebar collapse control sits at the far-right edge of the logo row. In the collapsed state, the logo remains visible and the expand icon appears when the logo area is hovered or focused.
- Activity table rows and overview activity rows link their primary payment value to payment details and include a visible **View details** action.
- The account area includes the overview, activity/detail, saved methods, notifications, profile/avatar, password, preferences, support, and sign-out flows.
- The latest UI check completed with 21 passing tests, a passing development/typecheck build, and a passing production build.

## Main routes

- `/` — public PayLink landing page.
- `/checkout` — fixed-amount checkout with test outcomes and safe retry state.
- `/auth` — sign-in and local demo access.
- `/account/overview` — compact account overview.
- `/account/activity` and `/account/activity/:id` — filterable activity and payment detail.
- `/account/methods` — masked method list and ownership-checked removal.
- `/account/notifications` — read state and notification inbox.
- `/account/profile` — profile and two-step security settings.
- `/account/preferences` — communication preferences.
- `/account/support` — support ticket form and ticket list.
- `/help`, `/faq`, `/legal` — public help, FAQ, and combined terms/privacy information routes.

## Deploy to GitHub Pages

The repository workflow at `.github/workflows/deploy-pages.yml` builds this Angular app and publishes it with GitHub Pages. It also copies the built `index.html` to `404.html` so Angular routes continue to load on direct navigation.

Before the first deployment:

1. In repository settings, set **Pages → Build and deployment → Source** to **GitHub Actions**.
2. Deploy the backend to Railway using `paylink-server/railway.toml` and note its public HTTPS URL.
3. Add a repository **Actions variable** named `PAYLINK_API_BASE_URL` containing the Railway URL, without a trailing slash. The URL is public browser configuration, not a secret.
4. Add the GitHub Pages origin, for example `https://your-user.github.io`, to Railway's `PAYLINK_CORS_ORIGINS` variable.
5. Push to `main` or `master`, or run **Deploy PayLink UI to GitHub Pages** manually from the Actions tab.

If `PAYLINK_API_BASE_URL` is omitted, the published UI intentionally runs in local demo mode instead of pretending that a same-origin API exists.

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
