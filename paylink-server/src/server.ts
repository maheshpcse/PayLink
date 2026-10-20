import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { AppConfig, loadConfig } from './config.js';
import { ApiError, conflict, forbidden, notFound, tooManyRequests, unauthorized, validationError } from './errors.js';
import { MemoryRepository } from './repository.js';
import { DevTestPaymentProvider } from './provider.js';
import {
  correlationIdFrom,
  hashPassword,
  hashRequest,
  newId,
  newToken,
  verifyPassword,
  verifyWebhookSignature,
} from './security.js';
import type {
  CheckoutSessionRecord,
  PaymentRecord,
  PaymentMethodRecord,
  PaymentStatus,
  Role,
  SupportTicketRecord,
  UserRecord,
} from './types.js';
import {
  checkoutInput,
  loginInput,
  passwordChangeInput,
  paymentCreationInput,
  paymentActionInput,
  profilePatchInput,
  registrationInput,
  roleIsStaff,
  ticketInput,
  ticketMessageInput,
  ticketPatchInput,
  webhookInput,
} from './validation.js';

type JsonRecord = Record<string, unknown>;

interface ActionResult {
  statusCode: number;
  body: unknown;
}

function header(request: IncomingMessage, name: string): string | undefined {
  const value = request.headers[name.toLowerCase()];
  return Array.isArray(value) ? value[0] : value;
}

function jsonResponse(res: ServerResponse, statusCode: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Content-Length', Buffer.byteLength(payload));
  res.end(payload);
}

function noContent(res: ServerResponse): void {
  res.statusCode = 204;
  res.removeHeader('Content-Type');
  res.removeHeader('Content-Length');
  res.end();
}

async function rawBody(request: IncomingMessage, limit: number): Promise<Buffer> {
  return new Promise((resolveBody, reject) => {
    const chunks: Buffer[] = [];
    let total = 0;
    let settled = false;
    request.on('data', (chunk: Buffer | string) => {
      if (settled) return;
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      total += buffer.length;
      if (total > limit) {
        settled = true;
        request.resume();
        reject(new ApiError(413, 'PAYLOAD_TOO_LARGE', 'Request body exceeds the configured limit'));
        return;
      }
      chunks.push(buffer);
    });
    request.on('end', () => {
      if (!settled) resolveBody(Buffer.concat(chunks));
    });
    request.on('error', (error) => {
      if (!settled) reject(error);
    });
  });
}

async function jsonBody(request: IncomingMessage, limit: number): Promise<unknown> {
  const raw = await rawBody(request, limit);
  if (raw.length === 0) return {};
  const contentType = header(request, 'content-type') ?? '';
  if (!contentType.toLowerCase().includes('application/json')) {
    throw validationError('Content-Type must be application/json');
  }
  try {
    return JSON.parse(raw.toString('utf8')) as unknown;
  } catch {
    throw validationError('Request body must contain valid JSON');
  }
}

function safeUser(user: UserRecord): JsonRecord {
  return {
    id: user.id,
    email: user.email,
    username: user.username,
    name: user.name,
    phone: user.phone,
    avatarUrl: user.avatarUrl,
    twoFactorEnabled: user.twoFactorEnabled,
    role: user.role,
    createdAt: user.createdAt,
  };
}

function checkoutSessionView(session: CheckoutSessionRecord): JsonRecord {
  return {
    id: session.id,
    merchantName: session.merchantName,
    merchantMark: session.merchantMark,
    description: session.description,
    amountCents: session.amountMinor,
    currency: session.currency,
    dueLabel: session.dueLabel,
    expiresAt: session.expiresAt,
  };
}

function checkoutSessionApiView(session: CheckoutSessionRecord): JsonRecord {
  return {
    id: session.id,
    merchantName: session.merchantName,
    merchantMark: session.merchantMark,
    description: session.description,
    amountMinor: session.amountMinor,
    currency: session.currency,
    dueLabel: session.dueLabel,
    expiresAt: session.expiresAt,
  };
}

function paymentMethodView(method: PaymentMethodRecord): JsonRecord {
  return {
    id: method.id,
    type: method.type,
    brand: method.brand,
    last4: method.last4,
    kind: method.type === 'card' ? 'card' : 'bank',
    label: method.label,
    detail: method.detail,
    ...(method.expiry ? { expiry: method.expiry } : {}),
    isDefault: method.isDefault,
    brandColor: method.brandColor,
  };
}

function profileView(user: UserRecord): JsonRecord {
  const initials = user.name
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
  const memberSince = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(
    new Date(user.createdAt),
  );
  return {
    name: user.name,
    username: user.username,
    email: user.email,
    phone: user.phone,
    avatarUrl: user.avatarUrl,
    initials,
    memberSince,
    twoFactorEnabled: user.twoFactorEnabled,
  };
}

function paymentView(payment: PaymentRecord): JsonRecord {
  return {
    id: payment.id,
    amountMinor: payment.amountMinor,
    currency: payment.currency,
    description: payment.description,
    status: payment.status,
    paymentMethod: payment.paymentMethod,
    providerReference: payment.providerReference,
    ...(payment.failureCode ? { failureCode: payment.failureCode } : {}),
    createdAt: payment.createdAt,
    updatedAt: payment.updatedAt,
  };
}

function ticketView(ticket: SupportTicketRecord): JsonRecord {
  return {
    id: ticket.id,
    userId: ticket.userId,
    subject: ticket.subject,
    category: ticket.category,
    status: ticket.status,
    priority: ticket.priority,
    ...(ticket.assignedTo ? { assignedTo: ticket.assignedTo } : {}),
    messages: ticket.messages,
    createdAt: ticket.createdAt,
    updatedAt: ticket.updatedAt,
  };
}

const PAYMENT_TRANSITIONS: Record<PaymentStatus, readonly PaymentStatus[]> = {
  created: ['processing'],
  processing: ['succeeded', 'failed'],
  succeeded: ['refunded'],
  failed: [],
  refunded: [],
};

const DEMO_CUSTOMER_EMAIL = 'jamie.lee@example.com';
const DEMO_CUSTOMER_PASSWORD = 'Demo123!';
const DEMO_CHECKOUT_SESSION: CheckoutSessionRecord = {
  id: 'checkout_demo_7H2Q',
  merchantName: 'Northstar Learning Co.',
  merchantMark: 'N',
  description: 'Advanced Statistics · monthly plan',
  amountMinor: 18_900,
  currency: 'USD',
  dueLabel: 'Due today',
  expiresAt: '2026-10-31T23:59:59.000Z',
};

function canTransition(from: PaymentStatus, to: PaymentStatus): boolean {
  return PAYMENT_TRANSITIONS[from].includes(to);
}

class RateLimiter {
  private readonly buckets = new Map<string, { startedAt: number; count: number }>();

  constructor(private readonly max: number, private readonly windowMs: number) {}

  check(key: string): number | undefined {
    const now = Date.now();
    const existing = this.buckets.get(key);
    if (!existing || now - existing.startedAt >= this.windowMs) {
      this.buckets.set(key, { startedAt: now, count: 1 });
      return undefined;
    }
    existing.count += 1;
    if (existing.count > this.max) return Math.ceil((this.windowMs - (now - existing.startedAt)) / 1_000);
    return undefined;
  }
}

export class PayLinkApplication {
  private readonly rateLimiter: RateLimiter;
  private readonly provider = new DevTestPaymentProvider();
  private demoCustomerId?: string;

  constructor(
    private readonly config: AppConfig,
    private readonly repository: MemoryRepository,
  ) {
    this.rateLimiter = new RateLimiter(config.rateLimitMax, config.rateLimitWindowMs);
  }

  async initialize(): Promise<void> {
    if (!this.config.demoUsers) return;
    await this.seedDemoUser('admin@example.test', 'Admin123!', 'PayLink Admin', 'admin');
    await this.seedDemoUser('support@example.test', 'Support123!', 'PayLink Support', 'support');
    const demoCustomer = await this.seedDemoUser(
      DEMO_CUSTOMER_EMAIL,
      DEMO_CUSTOMER_PASSWORD,
      'Jamie Lee',
      'customer',
      '+1 (555) 014-2084',
      true,
    );
    this.demoCustomerId = demoCustomer.id;
    if (!this.repository.findCheckoutSession(DEMO_CHECKOUT_SESSION.id)) {
      this.repository.createCheckoutSession(DEMO_CHECKOUT_SESSION);
    }
    this.seedDemoPaymentMethods(demoCustomer.id);
  }

  private async seedDemoUser(
    email: string,
    password: string,
    name: string,
    role: Role,
    phone?: string,
    twoFactorEnabled = false,
  ): Promise<UserRecord> {
    const existing = this.repository.findUserByEmail(email);
    if (existing) return existing;
    return this.repository.createUser({
      email,
      username: email.split('@')[0].replace(/[^a-zA-Z0-9._-]/g, '').slice(0, 40),
      name,
      phone,
      twoFactorEnabled,
      passwordHash: await hashPassword(password),
      role,
    });
  }

  private seedDemoPaymentMethods(userId: string): void {
    if (this.repository.listPaymentMethodsForUser(userId).length > 0) return;
    this.repository.createPaymentMethod({
      id: 'method_visa_4242',
      userId,
      type: 'card',
      brand: 'visa',
      last4: '4242',
      label: 'Visa ending in 4242',
      detail: 'Personal card',
      expiry: 'Exp 08/28',
      isDefault: true,
      brandColor: '#182d69',
    });
    this.repository.createPaymentMethod({
      id: 'method_bank_9012',
      userId,
      type: 'bank_transfer',
      brand: 'first community bank',
      last4: '9012',
      label: 'Checking ending in 9012',
      detail: 'First Community Bank',
      isDefault: false,
      brandColor: '#496c4d',
    });
  }

  async handle(request: IncomingMessage, response: ServerResponse): Promise<void> {
    const correlationId = correlationIdFrom(header(request, 'x-correlation-id'));
    response.setHeader('X-Correlation-ID', correlationId);
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('X-Frame-Options', 'DENY');
    response.setHeader('Referrer-Policy', 'no-referrer');
    response.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    response.setHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'");
    if (this.config.nodeEnv === 'production') response.setHeader('Strict-Transport-Security', 'max-age=31536000');

    try {
      this.applyCors(request, response);
      const ip = request.socket.remoteAddress ?? 'unknown';
      const retryAfter = this.rateLimiter.check(ip);
      if (retryAfter !== undefined) {
        response.setHeader('Retry-After', retryAfter);
        throw tooManyRequests(retryAfter);
      }

      if (request.method === 'OPTIONS') {
        noContent(response);
        return;
      }

      const url = new URL(request.url ?? '/', `http://${header(request, 'host') ?? 'localhost'}`);
      if (request.method === 'GET' && url.pathname === '/health') {
        jsonResponse(response, 200, {
          data: { status: 'ok', service: 'paylink-server', environment: this.config.nodeEnv },
          correlationId,
        });
        return;
      }

      if (url.pathname === '/api/v1/webhooks/payment-provider' && request.method === 'POST') {
        await this.handleWebhook(request, response, correlationId);
        return;
      }

      const segments = url.pathname.split('/').filter(Boolean).map((segment) => decodeURIComponent(segment));
      if (segments[0] === 'api' && segments[1] !== 'v1') {
        await this.routeUiCompatibility(request, response, segments.slice(1), correlationId);
        return;
      }
      if (segments[0] !== 'api' || segments[1] !== 'v1') throw notFound('API route not found');
      await this.routeApi(request, response, segments.slice(2), url, correlationId);
    } catch (error) {
      this.sendError(response, error, correlationId);
    }
  }

  private applyCors(request: IncomingMessage, response: ServerResponse): void {
    const origin = header(request, 'origin');
    if (!origin) return;
    const allowed = this.config.corsOrigins.includes('*') || this.config.corsOrigins.includes(origin);
    if (!allowed) throw forbidden('Origin is not allowed by the CORS policy');
    response.setHeader('Access-Control-Allow-Origin', this.config.corsOrigins.includes('*') ? '*' : origin);
    response.setHeader('Vary', 'Origin');
    response.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS');
    response.setHeader(
      'Access-Control-Allow-Headers',
      'Content-Type, Authorization, Idempotency-Key, X-Correlation-ID, X-PayLink-Signature',
    );
    response.setHeader('Access-Control-Max-Age', '600');
  }

  private async routeApi(
    request: IncomingMessage,
    response: ServerResponse,
    segments: string[],
    url: URL,
    correlationId: string,
  ): Promise<void> {
    const method = request.method ?? 'GET';
    if (segments.length === 0 && method === 'GET') {
      jsonResponse(response, 200, {
        data: {
          name: 'PayLink API',
          version: 'v1',
          paymentProvider: this.provider.name,
          persistence: 'in-memory-demo-repository',
        },
        correlationId,
      });
      return;
    }

    if (segments[0] === 'auth') {
      await this.routeAuth(request, response, segments.slice(1), correlationId);
      return;
    }

    if (segments[0] === 'checkout' && segments[1] === 'session' && segments.length === 2 && method === 'GET') {
      const session = this.checkoutSession();
      jsonResponse(response, 200, { data: { session: checkoutSessionApiView(session) }, correlationId });
      return;
    }

    const user = await this.authenticate(request);
    if (segments[0] === 'me') {
      await this.routeMe(request, response, segments.slice(1), user, correlationId);
      return;
    }
    if (segments[0] === 'payments') {
      await this.routePayments(request, response, segments.slice(1), user, correlationId);
      return;
    }
    if (segments[0] === 'payment-methods') {
      await this.routePaymentMethods(request, response, segments.slice(1), user, correlationId);
      return;
    }
    if (segments[0] === 'support') {
      await this.routeSupport(request, response, segments.slice(1), user, correlationId);
      return;
    }
    if (segments[0] === 'notifications') {
      await this.routeNotifications(request, response, segments.slice(1), user, url, correlationId);
      return;
    }
    if (segments[0] === 'admin') {
      await this.routeAdmin(request, response, segments.slice(1), user, correlationId);
      return;
    }
    throw notFound('API route not found');
  }

  private async routeAuth(
    request: IncomingMessage,
    response: ServerResponse,
    segments: string[],
    correlationId: string,
  ): Promise<void> {
    const method = request.method ?? 'GET';
    if (method === 'POST' && segments[0] === 'demo' && segments.length === 1) {
      if (!this.config.demoUsers || !this.demoCustomerId) throw notFound('Demo customer login is disabled');
      const user = this.repository.findUserById(this.demoCustomerId);
      if (!user) throw notFound('Demo customer was not found');
      jsonResponse(response, 200, { data: { user: safeUser(user), ...this.createSession(user.id) }, correlationId });
      return;
    }
    if (method === 'POST' && segments[0] === 'register' && segments.length === 1) {
      const input = registrationInput(await jsonBody(request, this.config.bodyLimitBytes));
      if (this.repository.findUserByEmail(input.email)) throw conflict('An account with this email already exists');
      const user = this.repository.createUser({
        email: input.email,
        username: input.username,
        name: input.name,
        passwordHash: await hashPassword(input.password),
        role: 'customer',
      });
      const session = this.createSession(user.id);
      jsonResponse(response, 201, { data: { user: safeUser(user), ...session }, correlationId });
      return;
    }
    if (method === 'POST' && segments[0] === 'login' && segments.length === 1) {
      const input = loginInput(await jsonBody(request, this.config.bodyLimitBytes));
       const user = this.repository.findUserByIdentifier(input.email);
      if (!user || !(await verifyPassword(input.password, user.passwordHash))) {
        throw unauthorized('Email or password is incorrect');
      }
      jsonResponse(response, 200, { data: { user: safeUser(user), ...this.createSession(user.id) }, correlationId });
      return;
    }
    const user = await this.authenticate(request);
    if (method === 'POST' && segments[0] === 'change-password' && segments.length === 1) {
      const input = passwordChangeInput(await jsonBody(request, this.config.bodyLimitBytes));
      if (!(await verifyPassword(input.currentPassword, user.passwordHash))) throw unauthorized('Current password is incorrect');
      await this.repository.updatePassword(user.id, await hashPassword(input.newPassword));
      jsonResponse(response, 200, { data: { changed: true }, correlationId });
      return;
    }
    if (method === 'POST' && segments[0] === 'logout' && segments.length === 1) {
      const token = this.bearerToken(request);
      if (token) this.repository.deleteSession(token);
      jsonResponse(response, 200, { data: { loggedOut: true }, correlationId });
      return;
    }
    if (method === 'GET' && segments[0] === 'me' && segments.length === 1) {
      jsonResponse(response, 200, { data: { user: safeUser(user) }, correlationId });
      return;
    }
    throw notFound('Auth route not found');
  }

  private checkoutSession(): CheckoutSessionRecord {
    const session = this.repository.findCheckoutSession(DEMO_CHECKOUT_SESSION.id);
    if (!session) throw notFound('Checkout session not found');
    return session;
  }

  private demoCustomer(): UserRecord {
    if (!this.config.demoUsers || !this.demoCustomerId) throw notFound('Demo compatibility routes are disabled');
    const user = this.repository.findUserById(this.demoCustomerId);
    if (!user) throw notFound('Demo customer was not found');
    return user;
  }

  private async routeUiCompatibility(
    request: IncomingMessage,
    response: ServerResponse,
    segments: string[],
    correlationId: string,
  ): Promise<void> {
    const method = request.method ?? 'GET';
    const user = this.demoCustomer();
    if (segments[0] === 'checkout' && segments[1] === 'session' && segments.length === 2 && method === 'GET') {
      jsonResponse(response, 200, checkoutSessionView(this.checkoutSession()));
      return;
    }
    if (segments[0] === 'account' && segments[1] === 'methods') {
      if (method === 'GET' && segments.length === 2) {
        jsonResponse(response, 200, this.repository.listPaymentMethodsForUser(user.id).map(paymentMethodView));
        return;
      }
      if (method === 'DELETE' && segments.length === 3) {
        const paymentMethod = this.repository.findPaymentMethod(segments[2]);
        if (!paymentMethod || paymentMethod.userId !== user.id) throw notFound('Payment method not found');
        this.repository.deletePaymentMethod(paymentMethod.id);
        noContent(response);
        return;
      }
    }
    if (segments[0] === 'account' && segments[1] === 'activity' && segments.length === 2 && method === 'GET') {
      jsonResponse(response, 200, this.repository.listPaymentsForUser(user.id).map((payment) => this.activityView(payment)));
      return;
    }
    if (segments[0] === 'account' && segments[1] === 'notifications' && segments.length === 2 && method === 'GET') {
      jsonResponse(response, 200, this.repository.listNotifications(user.id, false).map((notification) => ({
        id: notification.id,
        title: notification.title,
        body: notification.message,
        time: notification.createdAt,
        unread: !notification.readAt,
        tone: notification.type.includes('failed') ? 'orange' : notification.type.includes('security') ? 'violet' : 'green',
      })));
      return;
    }
    if (segments[0] === 'account' && segments[1] === 'profile' && segments.length === 2) {
      if (method === 'GET') {
        jsonResponse(response, 200, profileView(user));
        return;
      }
      if (method === 'PATCH') {
        const update = profilePatchInput(await jsonBody(request, this.config.bodyLimitBytes));
        const updated = this.updateProfile(user, update);
        jsonResponse(response, 200, profileView(updated));
        return;
      }
    }
    if (segments[0] === 'support' && segments[1] === 'tickets' && segments.length === 2 && method === 'GET') {
      jsonResponse(response, 200, this.repository.listTickets(user.id).map((ticket) => ({
        id: ticket.id,
        subject: ticket.subject,
        status: ticket.status === 'resolved' || ticket.status === 'closed' ? 'resolved' : 'open',
        updatedAt: ticket.updatedAt,
        category: ticket.category,
      })));
      return;
    }
    if (segments[0] === 'payments' && segments.length === 1 && method === 'POST') {
      const input = paymentCreationInput(await jsonBody(request, this.config.bodyLimitBytes));
      const payment = await this.createSessionPayment(user, input);
      jsonResponse(response, 201, this.uiPaymentResult(payment));
      return;
    }
    throw notFound('Compatibility route not found');
  }

  private createSession(userId: string): JsonRecord {
    const token = newToken();
    const expiresAt = Date.now() + this.config.sessionTtlMs;
    this.repository.saveSession({ token, userId, expiresAt, createdAt: new Date().toISOString() });
    return { token, tokenType: 'Bearer', expiresAt: new Date(expiresAt).toISOString() };
  }

  private bearerToken(request: IncomingMessage): string | undefined {
    const value = header(request, 'authorization');
    if (!value?.startsWith('Bearer ')) return undefined;
    const token = value.slice('Bearer '.length).trim();
    return token || undefined;
  }

  private async authenticate(request: IncomingMessage): Promise<UserRecord> {
    const token = this.bearerToken(request);
    if (!token) throw unauthorized();
    const session = this.repository.findSession(token);
    const user = session ? this.repository.findUserById(session.userId) : undefined;
    if (!session || !user) throw unauthorized('Session is missing or expired');
    return user;
  }

  private async routeMe(
    request: IncomingMessage,
    response: ServerResponse,
    segments: string[],
    user: UserRecord,
    correlationId: string,
  ): Promise<void> {
    const method = request.method ?? 'GET';
    if (segments.length === 0 && method === 'GET') {
      jsonResponse(response, 200, { data: { user: safeUser(user), profile: profileView(user) }, correlationId });
      return;
    }
    if (segments.length === 0 && method === 'PATCH') {
      const update = profilePatchInput(await jsonBody(request, this.config.bodyLimitBytes));
      const updated = this.updateProfile(user, update);
      jsonResponse(response, 200, { data: { user: safeUser(updated), profile: profileView(updated) }, correlationId });
      return;
    }
    if (segments[0] === 'payment-methods') {
      await this.routePaymentMethods(request, response, segments.slice(1), user, correlationId);
      return;
    }
    throw notFound('Profile route not found');
  }

  private updateProfile(user: UserRecord, update: ReturnType<typeof profilePatchInput>): UserRecord {
    if (update.email && update.email !== user.email) {
      const existing = this.repository.findUserByEmail(update.email);
      if (existing && existing.id !== user.id) throw conflict('An account with this email already exists');
    }
    return this.repository.updateUser(user.id, update);
  }

  private async routePaymentMethods(
    request: IncomingMessage,
    response: ServerResponse,
    segments: string[],
    user: UserRecord,
    correlationId: string,
  ): Promise<void> {
    const method = request.method ?? 'GET';
    if (segments.length === 0 && method === 'GET') {
      jsonResponse(response, 200, {
        data: { paymentMethods: this.repository.listPaymentMethodsForUser(user.id).map(paymentMethodView) },
        correlationId,
      });
      return;
    }
    if (segments.length === 1 && method === 'DELETE') {
      const paymentMethod = this.repository.findPaymentMethod(segments[0]);
      if (!paymentMethod || paymentMethod.userId !== user.id) throw notFound('Payment method not found');
      this.repository.deletePaymentMethod(paymentMethod.id);
      noContent(response);
      return;
    }
    throw notFound('Payment method route not found');
  }

  private async routePayments(
    request: IncomingMessage,
    response: ServerResponse,
    segments: string[],
    user: UserRecord,
    correlationId: string,
  ): Promise<void> {
    const method = request.method ?? 'GET';
    if (
      method === 'POST' &&
      ((segments[0] === 'checkout' && segments.length === 1) ||
        (segments.length === 0) ||
        ((segments[0] === 'from-session' || segments[0] === 'checkout-session') && segments.length === 1))
    ) {
      const rawBodyValue = await jsonBody(request, this.config.bodyLimitBytes);
      if (segments.length === 0 || segments[0] === 'from-session' || segments[0] === 'checkout-session' || this.looksLikeSessionPayment(rawBodyValue)) {
        const body = paymentCreationInput(rawBodyValue);
        await this.idempotent(request, response, user, body, correlationId, async () => {
          const payment = await this.createSessionPayment(user, body);
          return { statusCode: 201, body: { data: { payment: paymentView(payment) } } };
        });
        return;
      }
      const body = checkoutInput(rawBodyValue);
      await this.idempotent(request, response, user, body, correlationId, async () => {
        const payment = this.repository.createPayment({
          userId: user.id,
          amountMinor: body.amountMinor,
          currency: body.currency,
          description: body.description,
          status: 'created',
          paymentMethod: body.paymentMethod,
          providerReference: `dev_checkout_${newId()}`,
          testOutcome: body.testOutcome,
        });
        this.notify(user.id, 'payment.created', 'Checkout created', `Payment ${payment.id} is ready for confirmation.`);
        return { statusCode: 201, body: { data: { payment: paymentView(payment) } } };
      });
      return;
    }
    if (method === 'GET' && segments.length === 0) {
      const payments = this.repository.listPaymentsForUser(user.id).map(paymentView);
      jsonResponse(response, 200, { data: { payments }, correlationId });
      return;
    }
    const payment = segments[0] ? this.ownedPayment(user, segments[0]) : undefined;
    if (!payment) throw notFound('Payment route not found');
    if (method === 'GET' && segments.length === 1) {
      jsonResponse(response, 200, { data: { payment: paymentView(payment) }, correlationId });
      return;
    }
    if (method === 'POST' && segments[1] === 'confirm' && segments.length === 2) {
      const body = paymentActionInput(await jsonBody(request, this.config.bodyLimitBytes));
      await this.idempotent(request, response, user, { paymentId: payment.id, ...body }, correlationId, async () => {
        if (!canTransition(payment.status, 'processing')) {
          throw conflict(`Payment cannot be confirmed from ${payment.status} state`);
        }
        this.repository.updatePayment(payment.id, { status: 'processing' });
        const result = this.provider.authorize(payment, body.testOutcome ?? payment.testOutcome ?? 'succeeded');
        const updated = this.repository.updatePayment(payment.id, {
          status: result.status,
          providerReference: result.providerReference,
          ...(result.failureCode ? { failureCode: result.failureCode } : {}),
        });
        this.notify(
          user.id,
          `payment.${result.status}`,
          result.status === 'succeeded' ? 'Payment succeeded' : 'Payment failed',
          `Payment ${updated.id} is ${updated.status}.`,
        );
        return { statusCode: 200, body: { data: { payment: paymentView(updated) } } };
      });
      return;
    }
    if (method === 'POST' && segments[1] === 'refund' && segments.length === 2) {
      await this.idempotent(request, response, user, { paymentId: payment.id, action: 'refund' }, correlationId, async () => {
        if (!canTransition(payment.status, 'refunded')) {
          throw conflict(`Payment cannot be refunded from ${payment.status} state`);
        }
        const result = this.provider.refund(payment);
        const updated = this.repository.updatePayment(payment.id, {
          status: 'refunded',
          providerReference: result.providerReference,
        });
        this.notify(user.id, 'payment.refunded', 'Payment refunded', `Payment ${updated.id} was refunded.`);
        return { statusCode: 200, body: { data: { payment: paymentView(updated) } } };
      });
      return;
    }
    throw notFound('Payment route not found');
  }

  private looksLikeSessionPayment(input: unknown): boolean {
    return Boolean(
      input &&
        typeof input === 'object' &&
        ('checkoutSessionId' in input || 'checkoutId' in input || 'paymentMethodId' in input || 'methodId' in input),
    );
  }

  private async createSessionPayment(
    user: UserRecord,
    input: ReturnType<typeof paymentCreationInput>,
  ): Promise<PaymentRecord> {
    const session = this.repository.findCheckoutSession(input.checkoutSessionId);
    if (!session) throw notFound('Checkout session not found');
    if (new Date(session.expiresAt).getTime() <= Date.now()) throw conflict('Checkout session has expired');
    const savedMethod = this.repository.findPaymentMethod(input.paymentMethodId);
    if (!savedMethod || savedMethod.userId !== user.id) throw notFound('Saved payment method not found');
    const outcome = input.testOutcome === 'success' ? 'succeeded' : input.testOutcome === 'pending' ? 'processing' : 'failed';
    const payment = this.repository.createPayment({
      userId: user.id,
      amountMinor: session.amountMinor,
      currency: session.currency,
      description: session.description,
      status: 'created',
      paymentMethod: {
        type: savedMethod.type,
        brand: savedMethod.brand,
        last4: savedMethod.last4,
      },
      providerReference: `dev_checkout_${newId()}`,
      testOutcome: outcome,
    });
    this.repository.updatePayment(payment.id, { status: 'processing' });
    const result = this.provider.authorize(payment, outcome);
    const updated = this.repository.updatePayment(payment.id, {
      status: result.status,
      providerReference: result.providerReference,
      ...(result.failureCode ? { failureCode: result.failureCode } : {}),
    });
    const title = result.status === 'succeeded' ? 'Payment succeeded' : result.status === 'failed' ? 'Payment failed' : 'Payment processing';
    this.notify(user.id, `payment.${result.status}`, title, `Payment ${updated.id} is ${updated.status}.`);
    return updated;
  }

  private activityView(payment: PaymentRecord): JsonRecord {
    const session = this.repository.findCheckoutSession(DEMO_CHECKOUT_SESSION.id);
    const status = payment.status === 'succeeded' || payment.status === 'refunded' ? 'success' : payment.status === 'failed' ? 'failed' : 'pending';
    return {
      id: payment.id,
      merchantName: session?.merchantName ?? 'PayLink merchant',
      description: payment.description,
      amountCents: payment.amountMinor,
      currency: payment.currency,
      status,
      createdAt: payment.createdAt,
      reference: payment.providerReference,
    };
  }

  private uiPaymentResult(payment: PaymentRecord): JsonRecord {
    const status = payment.status === 'succeeded' ? 'success' : payment.status === 'processing' || payment.status === 'created' ? 'pending' : 'failed';
    const message = status === 'success'
      ? 'The test payment completed successfully. No money moved.'
      : status === 'pending'
        ? 'The test payment is waiting for a bank response. No money moved.'
        : 'The test payment was declined. No money moved.';
    return {
      status,
      reference: payment.providerReference,
      processedAt: payment.updatedAt,
      message,
    };
  }

  private ownedPayment(user: UserRecord, paymentId: string): PaymentRecord {
    const payment = this.repository.findPayment(paymentId);
    if (!payment || payment.userId !== user.id) throw notFound('Payment not found');
    return payment;
  }

  private async routeSupport(
    request: IncomingMessage,
    response: ServerResponse,
    segments: string[],
    user: UserRecord,
    correlationId: string,
  ): Promise<void> {
    const method = request.method ?? 'GET';
    if (method === 'POST' && segments[0] === 'tickets' && segments.length === 1) {
      const input = ticketInput(await jsonBody(request, this.config.bodyLimitBytes));
      const ticket = this.repository.createTicket({
        userId: user.id,
        subject: input.subject,
        category: input.category,
        status: 'open',
        priority: 'normal',
        messages: [{ id: newId(), authorId: user.id, message: input.message, createdAt: new Date().toISOString() }],
      });
      jsonResponse(response, 201, { data: { ticket: ticketView(ticket) }, correlationId });
      return;
    }
    if (method === 'GET' && segments[0] === 'tickets' && segments.length === 1) {
      const tickets = this.repository.listTickets(roleIsStaff(user.role) ? undefined : user.id).map(ticketView);
      jsonResponse(response, 200, { data: { tickets }, correlationId });
      return;
    }
    const ticket = segments[1] ? this.repository.findTicket(segments[1]) : undefined;
    if (!ticket || (!roleIsStaff(user.role) && ticket.userId !== user.id)) throw notFound('Support ticket not found');
    if (method === 'GET' && segments[0] === 'tickets' && segments.length === 2) {
      jsonResponse(response, 200, { data: { ticket: ticketView(ticket) }, correlationId });
      return;
    }
    if (method === 'POST' && segments[2] === 'messages' && segments.length === 3) {
      const message = ticketMessageInput(await jsonBody(request, this.config.bodyLimitBytes));
      ticket.messages.push({ id: newId(), authorId: user.id, message, createdAt: new Date().toISOString() });
      this.repository.updateTicket(ticket.id, { messages: ticket.messages });
      jsonResponse(response, 201, { data: { ticket: ticketView(ticket) }, correlationId });
      return;
    }
    if (method === 'PATCH' && segments[0] === 'tickets' && segments.length === 2) {
      if (!roleIsStaff(user.role)) throw forbidden('Only support staff can update ticket status or priority');
      const update = ticketPatchInput(await jsonBody(request, this.config.bodyLimitBytes));
      const updated = this.repository.updateTicket(ticket.id, update);
      jsonResponse(response, 200, { data: { ticket: ticketView(updated) }, correlationId });
      return;
    }
    throw notFound('Support ticket route not found');
  }

  private async routeNotifications(
    request: IncomingMessage,
    response: ServerResponse,
    segments: string[],
    user: UserRecord,
    url: URL,
    correlationId: string,
  ): Promise<void> {
    const method = request.method ?? 'GET';
    if (method === 'GET' && segments.length === 0) {
      const unreadOnly = url.searchParams.get('unread') === 'true';
      const notifications = this.repository.listNotifications(user.id, unreadOnly);
      jsonResponse(response, 200, { data: { notifications }, correlationId });
      return;
    }
    if (method === 'POST' && segments[0] === 'read-all' && segments.length === 1) {
      this.repository.markAllNotificationsRead(user.id);
      jsonResponse(response, 200, { data: { markedRead: true }, correlationId });
      return;
    }
    if (method === 'POST' && segments[0] && segments[1] === 'read' && segments.length === 2) {
      const notification = this.repository.findNotification(segments[0]);
      if (!notification || notification.userId !== user.id) throw notFound('Notification not found');
      this.repository.markNotificationRead(notification.id);
      jsonResponse(response, 200, { data: { notification }, correlationId });
      return;
    }
    throw notFound('Notification route not found');
  }

  private async routeAdmin(
    request: IncomingMessage,
    response: ServerResponse,
    segments: string[],
    user: UserRecord,
    correlationId: string,
  ): Promise<void> {
    if (!roleIsStaff(user.role)) throw forbidden('Support or admin role is required');
    if (request.method !== 'GET' || segments[0] !== 'users' || segments[2] !== 'payment-metadata') {
      throw notFound('Admin route not found');
    }
    const target = this.repository.findUserById(segments[1] ?? '');
    if (!target) throw notFound('User not found');
    const payments = this.repository.listPaymentsForUser(target.id);
    const tickets = this.repository.listTickets(target.id);
    const totals = new Map<string, number>();
    for (const payment of payments) totals.set(payment.currency, (totals.get(payment.currency) ?? 0) + payment.amountMinor);
    jsonResponse(response, 200, {
      data: {
        user: safeUser(target),
        paymentSummary: {
          count: payments.length,
          totalsByCurrency: Object.fromEntries(totals),
          byStatus: Object.fromEntries(
            ['created', 'processing', 'succeeded', 'failed', 'refunded'].map((status) => [
              status,
              payments.filter((payment) => payment.status === status).length,
            ]),
          ),
        },
        payments: payments.map(paymentView),
        supportTicketCount: tickets.length,
      },
      correlationId,
    });
  }

  private async handleWebhook(request: IncomingMessage, response: ServerResponse, correlationId: string): Promise<void> {
    const raw = await rawBody(request, this.config.bodyLimitBytes);
    if (!verifyWebhookSignature(raw, header(request, 'x-paylink-signature'), this.config.webhookSecret)) {
      throw unauthorized('Webhook signature is invalid');
    }
    let input: unknown;
    try {
      input = JSON.parse(raw.toString('utf8')) as unknown;
    } catch {
      throw validationError('Webhook body must contain valid JSON');
    }
    const event = webhookInput(input);
    const payment = this.repository.findPayment(event.paymentId);
    if (!payment) throw notFound('Payment referenced by webhook was not found');
    const nextStatus = event.type === 'payment.succeeded' ? 'succeeded' : 'failed';
    if (payment.status !== nextStatus && payment.status !== 'refunded') {
      const transitionFrom = payment.status === 'created' ? 'processing' : payment.status;
      if (!canTransition(transitionFrom, nextStatus)) {
        throw conflict(`Webhook cannot transition payment from ${payment.status} state`);
      }
    }
    if (!this.repository.recordWebhookEvent(event.eventId)) {
      jsonResponse(response, 200, { data: { received: true, duplicate: true }, correlationId });
      return;
    }
    if (payment.status !== nextStatus && payment.status !== 'refunded') {
      if (payment.status === 'created') this.repository.updatePayment(payment.id, { status: 'processing' });
      const updated = this.repository.updatePayment(payment.id, {
        status: nextStatus,
        ...(nextStatus === 'failed' ? { failureCode: 'provider_declined' } : {}),
      });
      this.notify(payment.userId, `payment.${nextStatus}`, `Payment ${nextStatus}`, `Payment ${updated.id} is ${nextStatus}.`);
    }
    jsonResponse(response, 200, { data: { received: true, duplicate: false }, correlationId });
  }

  private notify(userId: string, type: string, title: string, message: string): void {
    this.repository.createNotification({ userId, type, title, message });
  }

  private async idempotent(
    request: IncomingMessage,
    response: ServerResponse,
    user: UserRecord,
    requestBody: unknown,
    correlationId: string,
    action: () => Promise<ActionResult>,
  ): Promise<void> {
    const key = header(request, 'idempotency-key');
    if (!key || key.length < 1 || key.length > 128) {
      throw validationError('Idempotency-Key header is required and must be at most 128 characters');
    }
    const requestHash = hashRequest(requestBody);
    const existing = this.repository.findIdempotency(user.id, key);
    if (existing) {
      if (existing.requestHash !== requestHash) {
        throw conflict('Idempotency-Key was already used with a different request');
      }
      response.setHeader('Idempotency-Replayed', 'true');
      jsonResponse(response, existing.statusCode, { ...(existing.responseBody as JsonRecord), correlationId });
      return;
    }
    const result = await action();
    this.repository.saveIdempotency({
      userId: user.id,
      key,
      requestHash,
      statusCode: result.statusCode,
      responseBody: result.body,
      createdAt: new Date().toISOString(),
    });
    jsonResponse(response, result.statusCode, { ...(result.body as JsonRecord), correlationId });
  }

  private sendError(response: ServerResponse, error: unknown, correlationId: string): void {
    if (response.headersSent) {
      response.destroy();
      return;
    }
    const apiError = error instanceof ApiError ? error : new ApiError(500, 'INTERNAL_ERROR', 'An unexpected error occurred');
    if (!(error instanceof ApiError)) {
      console.error(JSON.stringify({ level: 'error', correlationId, error: error instanceof Error ? error.message : String(error) }));
    }
    const details = apiError.details === undefined ? {} : { details: apiError.details };
    jsonResponse(response, apiError.statusCode, {
      error: { code: apiError.code, message: apiError.message, correlationId, ...details },
    });
  }
}

export async function createApplication(
  config: AppConfig = loadConfig(),
  repository = new MemoryRepository(),
): Promise<PayLinkApplication> {
  const application = new PayLinkApplication(config, repository);
  await application.initialize();
  return application;
}

export function createHttpServer(application: PayLinkApplication): Server {
  return createServer((request, response) => {
    void application.handle(request, response);
  });
}
