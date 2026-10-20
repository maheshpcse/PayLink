import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { createApplication, createHttpServer } from '../dist/server.js';
import { createExpressApp } from '../dist/express-server.js';
import { loadConfig } from '../dist/config.js';

const webhookSecret = 'test-webhook-secret';
let server;
let baseUrl;
let expressServer;
let expressBaseUrl;

before(async () => {
  const config = loadConfig({
    NODE_ENV: 'test',
    PAYLINK_CORS_ORIGINS: 'https://app.example.test',
    PAYLINK_WEBHOOK_SECRET: webhookSecret,
    PAYLINK_RATE_LIMIT_MAX: '1000',
    PAYLINK_RATE_LIMIT_WINDOW_MS: '60000',
  });
  const application = await createApplication(config);
  server = createHttpServer(application);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  baseUrl = `http://127.0.0.1:${address.port}`;

  const expressApplication = await createApplication(config);
  expressServer = createExpressApp(expressApplication).listen(0, '127.0.0.1');
  await new Promise((resolve, reject) => {
    expressServer.once('listening', resolve);
    expressServer.once('error', reject);
  });
  const expressAddress = expressServer.address();
  expressBaseUrl = `http://127.0.0.1:${expressAddress.port}`;
});

after(async () => {
  await Promise.all([
    new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve()))),
    new Promise((resolve, reject) => expressServer.close((error) => (error ? reject(error) : resolve()))),
  ]);
});

async function request(path, options = {}) {
  return fetch(`${baseUrl}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers ?? {}) },
  });
}

async function json(response) {
  return response.json();
}

async function register(suffix) {
  const response = await request('/api/v1/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email: `${suffix}@example.test`, password: 'Password123!', name: suffix }),
  });
  assert.equal(response.status, 201);
  return (await json(response)).data;
}

test('password changes verify the current password before updating the account', async () => {
  const account = await register(`password-${Date.now()}`);
  const wrongCurrent = await request('/api/v1/auth/change-password', {
    method: 'POST',
    headers: { Authorization: `Bearer ${account.token}` },
    body: JSON.stringify({ currentPassword: 'Wrong123!', newPassword: 'NewPassword123!' }),
  });
  assert.equal(wrongCurrent.status, 401);

  const changed = await request('/api/v1/auth/change-password', {
    method: 'POST',
    headers: { Authorization: `Bearer ${account.token}` },
    body: JSON.stringify({ currentPassword: 'Password123!', newPassword: 'NewPassword123!' }),
  });
  assert.equal(changed.status, 200);
  assert.deepEqual((await json(changed)).data, { changed: true });

  const oldLogin = await request('/api/v1/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: account.user.email, password: 'Password123!' }),
  });
  assert.equal(oldLogin.status, 401);
  const newLogin = await request('/api/v1/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: account.user.email, password: 'NewPassword123!' }),
  });
  assert.equal(newLogin.status, 200);
});

test('health, correlation IDs, secure headers, CORS, and validation are observable', async () => {
  const health = await request('/health', {
    headers: { Origin: 'https://app.example.test', 'X-Correlation-ID': 'smoke-test-1' },
  });
  assert.equal(health.status, 200);
  assert.equal(health.headers.get('x-correlation-id'), 'smoke-test-1');
  assert.equal(health.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(health.headers.get('access-control-allow-origin'), 'https://app.example.test');

  const invalid = await request('/api/v1/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email: 'not-an-email', password: 'short' }),
  });
  assert.equal(invalid.status, 400);
  const payload = await json(invalid);
  assert.equal(payload.error.code, 'VALIDATION_ERROR');
  assert.equal(typeof payload.error.correlationId, 'string');

  const blocked = await request('/health', { headers: { Origin: 'https://not-allowed.example' } });
  assert.equal(blocked.status, 403);
});

test('the Express entrypoint delegates the health contract', async () => {
  const health = await fetch(`${expressBaseUrl}/health`);
  assert.equal(health.status, 200);
  assert.deepEqual((await json(health)).data, {
    status: 'ok',
    service: 'paylink-server',
    environment: 'test',
  });
  assert.equal(health.headers.get('x-powered-by'), null);
});

test('session flow, ownership, masked payment metadata, state machine, and idempotency work together', async () => {
  const alice = await register(`alice-${Date.now()}`);
  const bob = await register(`bob-${Date.now()}`);
  const checkoutBody = {
    amountMinor: 2599,
    currency: 'usd',
    description: 'Demo order',
    paymentMethod: { type: 'card', brand: 'Visa', last4: '4242' },
  };
  const rawCard = await request('/api/v1/payments/checkout', {
    method: 'POST',
    headers: { Authorization: `Bearer ${alice.token}`, 'Idempotency-Key': 'raw-card' },
    body: JSON.stringify({ ...checkoutBody, paymentMethod: { type: 'card', number: '4242424242424242', cvc: '123' } }),
  });
  assert.equal(rawCard.status, 400);

  const missingIdempotency = await request('/api/v1/payments/checkout', {
    method: 'POST',
    headers: { Authorization: `Bearer ${alice.token}` },
    body: JSON.stringify(checkoutBody),
  });
  assert.equal(missingIdempotency.status, 400);

  const checkout = await request('/api/v1/payments/checkout', {
    method: 'POST',
    headers: { Authorization: `Bearer ${alice.token}`, 'Idempotency-Key': 'checkout-1' },
    body: JSON.stringify(checkoutBody),
  });
  assert.equal(checkout.status, 201);
  const created = (await json(checkout)).data.payment;
  assert.equal(created.status, 'created');
  assert.deepEqual(created.paymentMethod, { type: 'card', brand: 'visa', last4: '4242' });
  assert.equal('number' in created.paymentMethod, false);

  const replay = await request('/api/v1/payments/checkout', {
    method: 'POST',
    headers: { Authorization: `Bearer ${alice.token}`, 'Idempotency-Key': 'checkout-1' },
    body: JSON.stringify(checkoutBody),
  });
  assert.equal(replay.status, 201);
  assert.equal(replay.headers.get('idempotency-replayed'), 'true');
  assert.equal((await json(replay)).data.payment.id, created.id);

  const mismatch = await request('/api/v1/payments/checkout', {
    method: 'POST',
    headers: { Authorization: `Bearer ${alice.token}`, 'Idempotency-Key': 'checkout-1' },
    body: JSON.stringify({ ...checkoutBody, amountMinor: 3000 }),
  });
  assert.equal(mismatch.status, 409);

  const forbiddenRead = await request(`/api/v1/payments/${created.id}`, {
    headers: { Authorization: `Bearer ${bob.token}` },
  });
  assert.equal(forbiddenRead.status, 404);

  const confirm = await request(`/api/v1/payments/${created.id}/confirm`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${alice.token}`, 'Idempotency-Key': 'confirm-1' },
    body: JSON.stringify({}),
  });
  assert.equal(confirm.status, 200);
  assert.equal((await json(confirm)).data.payment.status, 'succeeded');

  const refund = await request(`/api/v1/payments/${created.id}/refund`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${alice.token}`, 'Idempotency-Key': 'refund-1' },
    body: JSON.stringify({}),
  });
  assert.equal(refund.status, 200);
  assert.equal((await json(refund)).data.payment.status, 'refunded');

  const notifications = await request('/api/v1/notifications?unread=true', {
    headers: { Authorization: `Bearer ${alice.token}` },
  });
  assert.equal(notifications.status, 200);
  assert.ok((await json(notifications)).data.notifications.some((item) => item.type === 'payment.succeeded'));
});

test('support tickets, staff metadata lookup, and signed webhook seam work', async () => {
  const customer = await register(`ticket-${Date.now()}`);
  const ticketResponse = await request('/api/v1/support/tickets', {
    method: 'POST',
    headers: { Authorization: `Bearer ${customer.token}` },
    body: JSON.stringify({ subject: 'Payment question', message: 'Please check my demo payment.', category: 'billing' }),
  });
  assert.equal(ticketResponse.status, 201);
  const ticket = (await json(ticketResponse)).data.ticket;

  const login = await request('/api/v1/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'admin@example.test', password: 'Admin123!' }),
  });
  assert.equal(login.status, 200);
  const admin = (await json(login)).data;
  const metadata = await request(`/api/v1/admin/users/${customer.user.id}/payment-metadata`, {
    headers: { Authorization: `Bearer ${admin.token}` },
  });
  assert.equal(metadata.status, 200);
  assert.equal((await json(metadata)).data.user.id, customer.user.id);

  const checkout = await request('/api/v1/payments/checkout', {
    method: 'POST',
    headers: { Authorization: `Bearer ${customer.token}`, 'Idempotency-Key': 'webhook-checkout' },
    body: JSON.stringify({
      amountMinor: 100,
      currency: 'EUR',
      paymentMethod: { type: 'wallet', brand: 'TestWallet', last4: '0001' },
    }),
  });
  const payment = (await json(checkout)).data.payment;
  const event = JSON.stringify({ eventId: 'evt-1', type: 'payment.succeeded', paymentId: payment.id });
  const signature = createHmac('sha256', webhookSecret).update(event).digest('hex');
  const webhook = await request('/api/v1/webhooks/payment-provider', {
    method: 'POST',
    headers: { 'X-PayLink-Signature': `sha256=${signature}` },
    body: event,
  });
  assert.equal(webhook.status, 200);
  assert.equal((await json(webhook)).data.received, true);

  const duplicate = await request('/api/v1/webhooks/payment-provider', {
    method: 'POST',
    headers: { 'X-PayLink-Signature': `sha256=${signature}` },
    body: event,
  });
  assert.equal((await json(duplicate)).data.duplicate, true);

  const staffUpdate = await request(`/api/v1/support/tickets/${ticket.id}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${admin.token}` },
    body: JSON.stringify({ status: 'resolved', priority: 'high' }),
  });
  assert.equal(staffUpdate.status, 200);
  assert.equal((await json(staffUpdate)).data.ticket.status, 'resolved');
});

test('the server-owned demo contract exposes safe account data and removal', async () => {
  const sessionResponse = await request('/api/checkout/session', {
    headers: { Origin: 'https://app.example.test' },
  });
  assert.equal(sessionResponse.status, 200);
  const session = await json(sessionResponse);
  assert.deepEqual(
    {
      id: session.id,
      amountCents: session.amountCents,
      currency: session.currency,
      description: session.description,
    },
    {
      id: 'checkout_demo_7H2Q',
      amountCents: 18900,
      currency: 'USD',
      description: 'Advanced Statistics · monthly plan',
    },
  );

  const methodsResponse = await request('/api/account/methods');
  assert.equal(methodsResponse.status, 200);
  const methods = await json(methodsResponse);
  assert.equal(methods.length, 2);
  assert.equal('number' in methods[0], false);
  assert.equal(methods[0].last4, '4242');

  const demoLogin = await request('/api/v1/auth/demo', { method: 'POST' });
  assert.equal(demoLogin.status, 200);
  const demo = (await json(demoLogin)).data;
  const me = await request('/api/v1/me', { headers: { Authorization: `Bearer ${demo.token}` } });
  assert.equal(me.status, 200);
  assert.equal((await json(me)).data.profile.email, 'jamie.lee@example.com');

  const profilePatch = await request('/api/v1/me', {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${demo.token}` },
    body: JSON.stringify({ phone: '+1 (555) 014-2099', twoFactorEnabled: false }),
  });
  assert.equal(profilePatch.status, 200);
  assert.equal((await json(profilePatch)).data.profile.phone, '+1 (555) 014-2099');

  const versionedMethods = await request('/api/v1/me/payment-methods', {
    headers: { Authorization: `Bearer ${demo.token}` },
  });
  assert.equal(versionedMethods.status, 200);
  assert.equal((await json(versionedMethods)).data.paymentMethods.length, 2);

  const removed = await request('/api/account/methods/method_bank_9012', { method: 'DELETE' });
  assert.equal(removed.status, 204);
  const afterRemoval = await request('/api/account/methods');
  assert.equal((await json(afterRemoval)).length, 1);
});

test('session payment creation ignores browser amount fields and supports pending processing', async () => {
  const login = await request('/api/v1/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'jamie.lee@example.com', password: 'Demo123!' }),
  });
  assert.equal(login.status, 200);
  const customer = (await json(login)).data;

  const paymentResponse = await request('/api/v1/payments', {
    method: 'POST',
    headers: { Authorization: `Bearer ${customer.token}`, 'Idempotency-Key': 'server-owned-session-payment' },
    body: JSON.stringify({
      checkoutSessionId: 'checkout_demo_7H2Q',
      paymentMethodId: 'method_visa_4242',
      amountMinor: 1,
      currency: 'JPY',
      description: 'browser-controlled description',
      testOutcome: 'pending',
    }),
  });
  assert.equal(paymentResponse.status, 201);
  const payment = (await json(paymentResponse)).data.payment;
  assert.equal(payment.amountMinor, 18900);
  assert.equal(payment.currency, 'USD');
  assert.equal(payment.description, 'Advanced Statistics · monthly plan');
  assert.equal(payment.status, 'processing');
  assert.deepEqual(payment.paymentMethod, { type: 'card', brand: 'visa', last4: '4242' });

  const rawCard = await request('/api/v1/payments', {
    method: 'POST',
    headers: { Authorization: `Bearer ${customer.token}`, 'Idempotency-Key': 'server-owned-raw-card' },
    body: JSON.stringify({
      checkoutSessionId: 'checkout_demo_7H2Q',
      paymentMethodId: 'method_visa_4242',
      number: '4242424242424242',
      testOutcome: 'success',
    }),
  });
  assert.equal(rawCard.status, 400);

  const uiPayment = await request('/api/payments', {
    method: 'POST',
    body: JSON.stringify({ checkoutId: 'checkout_demo_7H2Q', methodId: 'method_visa_4242', testOutcome: 'pending' }),
  });
  assert.equal(uiPayment.status, 201);
  assert.equal((await json(uiPayment)).status, 'pending');
});

test('development defaults include Angular CORS and production rejects the known webhook secret', () => {
  const development = loadConfig({ NODE_ENV: 'development' });
  assert.ok(development.corsOrigins.includes('http://localhost:8200'));
  assert.ok(development.corsOrigins.includes('http://127.0.0.1:8200'));
  assert.equal(development.rateLimitMax, 1000);
  assert.deepEqual(loadConfig({ NODE_ENV: 'production', PAYLINK_WEBHOOK_SECRET: 'strong-production-secret' }).corsOrigins, []);
  assert.throws(
    () => loadConfig({ NODE_ENV: 'production', PAYLINK_WEBHOOK_SECRET: 'dev-only-change-this-webhook-secret' }),
    /PAYLINK_WEBHOOK_SECRET must be set/,
  );
});
