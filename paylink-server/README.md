# PayLink Server

`paylink-server` is the backend-only PayLink REST API used by the PayLink UI. It is isolated from the frontend and can also run independently for API tests.

The implementation is a dependency-light Node.js + TypeScript + Express.js HTTP application. Express is the production entrypoint, and its adapter passes the native request/response objects to the existing `PayLinkApplication`, which keeps request parsing, validation, security behavior, authentication, and route handling centralized. The application also exports the existing `createHttpServer` wrapper for low-level tests and integrations.

## Important demo boundaries

- The default persistence layer is an explicitly labeled **in-memory demo repository**. Restarting the process deletes accounts, sessions, payments, saved methods, tickets, and notifications. It is not suitable for production or multi-process use.
- The default payment adapter is the **`dev-test-provider`**. It never contacts a payment network and must not be described or deployed as live payments. `testOutcome` is a deterministic test-only control.
- The MySQL reference schema is in `migrations/001_init.sql`; a MySQL repository/connection pool is intentionally not included in this demo.
- Demo accounts are enabled in development by default: `admin@example.test` / `Admin123!`, `support@example.test` / `Support123!`, and customer `jamie.lee@example.com` / `Demo123!`. `POST /api/v1/auth/demo` also creates a session for that customer in demo mode. Set `PAYLINK_DEMO_USERS=false` outside local development; the demo login and unversioned UI compatibility routes are then disabled.
- The server seeds the fixed checkout session `checkout_demo_7H2Q` for Northstar Learning Co. at USD 189.00. Its amount, currency, and description are stored and selected by the server, not accepted from browser payment requests.
- Checkout accepts only masked payment metadata (`type`, `brand`, `last4`). It rejects raw card numbers, PANs, CVVs, and security codes.

## Requirements and setup

- Node.js **24.19.0** (`.nvmrc`)
- npm 11 or newer

From this directory:

```text
npm ci --offline
copy .env.example .env
```

On a machine without the npm cache populated, omit `--offline` for the first install. The committed lockfile pins the runtime and development dependencies.

## Run

```text
npm start
```

`npm start` builds `src` into `dist` before starting the Express entrypoint, loads a local `.env` file without requiring a global dotenv install, and works from a clean checkout without a pre-existing build directory. The API listens on `http://127.0.0.1:4000` by default. Use `PORT`, `PAYLINK_CORS_ORIGINS`, MySQL settings, notification transport settings, and the other values in `.env.example` to configure it. Development CORS includes Angular's `http://localhost:4173` and `http://127.0.0.1:4173`; development allows 1,000 requests per minute so Angular reloads and bounded payment polling do not produce a false local `Too many requests` fallback. Production defaults to 120 requests per minute, has no default allowed origins, and requires an explicit allowlist. `GET /health` is the liveness endpoint.

### Local MySQL schema and seed

The running MVP still uses the explicitly labeled in-memory repository. The local MySQL connection values are included in `.env.example` so a database can be provisioned without putting credentials in source control. To create disposable local sample data with MySQL:

```text
mysql -h 127.0.0.1 -P 3306 -u paylink -p paylink < migrations/001_init.sql
mysql -h 127.0.0.1 -P 3306 -u paylink -p paylink < migrations/002_seed_demo.sql
```

The seed contains masked payment metadata, checkout data, activity, tickets/messages, and notifications only. Its password hashes are disabled placeholders; do not treat seed records as production accounts. Wiring a durable MySQL repository remains a separate production step.

## Test and typecheck

The single project test command builds the TypeScript and runs the offline Node test suite:

```text
npm test
```

For the stricter local check, which runs typecheck and then the same test command:

```text
npm run check
```

## API outline

The primary application routes are versioned under `/api/v1` and return JSON. The demo-only UI compatibility routes are documented below. Errors have the shape `{ error: { code, message, correlationId, details? } }` and every response carries `X-Correlation-ID`.

### Authentication and sessions

```text
POST /api/v1/auth/register       { email, password, name? }
POST /api/v1/auth/login          { email, password }
POST /api/v1/auth/demo           local-only seeded customer session
POST /api/v1/auth/logout         Authorization: Bearer <token>
GET  /api/v1/auth/me             Authorization: Bearer <token>
GET  /api/v1/me                  Authorization: Bearer <token>
PATCH /api/v1/me                 Authorization: Bearer <token>
```

The demo uses opaque in-memory bearer sessions with an expiry. A production deployment should use a durable session/token store, secret rotation, account verification, password reset, MFA, and an operational identity provider.

### Checkout, saved methods, and payments

```text
GET  /api/v1/checkout/session
GET  /api/v1/me/payment-methods  Authorization: Bearer <token>
DELETE /api/v1/me/payment-methods/:methodId  Authorization: Bearer <token>
POST /api/v1/payments/checkout
POST /api/v1/payments             Authorization: Bearer <token>, Idempotency-Key
GET  /api/v1/payments
GET  /api/v1/payments/:paymentId
POST /api/v1/payments/:paymentId/confirm   Idempotency-Key required
POST /api/v1/payments/:paymentId/refund    Idempotency-Key required
```

`POST /api/v1/payments` is the server-owned session flow. It accepts `{ checkoutSessionId, paymentMethodId, testOutcome }`; it derives amount, currency, and description from the stored checkout session and derives masked method metadata from the saved method. `testOutcome` accepts `success`, `pending`, or `failed`; pending remains `processing`. The legacy `/api/v1/payments/checkout` metadata flow remains available for existing clients and tests.

Checkout and payment mutations require an `Idempotency-Key`. Reusing a key with a different request returns `409 CONFLICT`; a matching replay returns the original response. Payment transitions are `created -> processing -> succeeded|failed -> refunded` (refunds only follow `succeeded`). All payment reads enforce user ownership.

### PayLink UI compatibility routes

The existing UI calls these unversioned routes and does not send a bearer token. They are demo-only adapters backed by the seeded customer and are available only when `PAYLINK_DEMO_USERS=true`:

```text
GET    /api/checkout/session
GET    /api/account/methods
DELETE /api/account/methods/:methodId
GET    /api/account/activity
GET    /api/account/notifications
GET    /api/account/profile
PATCH  /api/account/profile
GET    /api/support/tickets
POST   /api/payments              { checkoutId, methodId, testOutcome }
```

The compatibility payment endpoint returns the UI result shape and maps `pending` to server status `processing`. Browser-supplied amount, currency, description, and raw payment credentials are not used.

### Support and notifications

```text
POST  /api/v1/support/tickets
GET   /api/v1/support/tickets
GET   /api/v1/support/tickets/:ticketId
POST  /api/v1/support/tickets/:ticketId/messages
PATCH /api/v1/support/tickets/:ticketId       support/admin only
GET   /api/v1/notifications?unread=true
POST  /api/v1/notifications/:notificationId/read
POST  /api/v1/notifications/read-all
```

### Staff metadata lookup and webhooks

```text
GET  /api/v1/admin/users/:userId/payment-metadata   support/admin only
POST /api/v1/webhooks/payment-provider
```

The lookup returns safe user/payment metadata and masked payment methods, never passwords or raw payment credentials. Webhooks require `X-PayLink-Signature: sha256=<hex-hmac>` calculated over the exact request body with `PAYLINK_WEBHOOK_SECRET`. The webhook route is a verification seam for a future provider adapter, not a live integration. Startup rejects the known development webhook secret when `NODE_ENV=production`.

## Security behavior included

The server includes strict JSON validation, secure response headers, configurable CORS origin allowlisting, an in-process IP rate-limit-ish window, correlation IDs, structured errors, constant-time password/signature comparisons, opaque session tokens, request body limits, idempotency records, ownership checks, and webhook event deduplication.

## Docker

Build and run the isolated server:

```text
docker build -t paylink-server .
docker run --rm -p 4000:4000 --env-file .env paylink-server
```

Production gaps are intentional: provide a managed database and durable session/idempotency storage, replace the dev provider, set a strong secret through the platform secret manager, terminate TLS, configure trusted proxy behavior, add durable logging/metrics/tracing, and complete payment-provider reconciliation and webhook retry handling. Do not enable the demo users or compatibility routes for customer traffic.
