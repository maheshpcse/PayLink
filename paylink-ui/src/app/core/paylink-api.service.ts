import { HttpClient, HttpContext, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { catchError, map, Observable, of, tap, throwError } from 'rxjs';
import { PAYLINK_CONFIG } from './config';
import { AuthService } from './auth.service';
import { IDEMPOTENCY_KEY, PUBLIC_REQUEST } from './request.interceptor';
import {
  ApiResult,
  AuthSession,
  AuthUser,
  CheckoutSession,
  NotificationItem,
  PaymentActivity,
  PaymentMethodMetadata,
  PaymentResult,
  PaymentStatus,
  Profile,
  ProfileUpdate,
  SavedMethod,
  ServerPaymentStatus,
  SupportTicket,
  SupportTicketRequest,
  TestOutcome,
  initialsForName,
} from './models';

interface Envelope<T> {
  data: T;
}

interface ServerPayment {
  id: string;
  amountMinor: number;
  currency: string;
  description: string;
  status: ServerPaymentStatus;
  paymentMethod: PaymentMethodMetadata;
  providerReference: string;
  createdAt: string;
  updatedAt: string;
}

interface ServerPaymentMethod extends PaymentMethodMetadata {
  id: string;
  kind?: 'card' | 'bank';
  label: string;
  detail: string;
  expiry?: string;
  isDefault: boolean;
  brandColor: string;
}

interface ServerNotification {
  id: string;
  type: string;
  title: string;
  message: string;
  readAt?: string;
  createdAt: string;
}

interface ServerTicket {
  id: string;
  subject: string;
  category: 'billing' | 'account' | 'technical' | 'other';
  status: 'open' | 'pending' | 'resolved' | 'closed';
  updatedAt: string;
}

export class PayLinkApiError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
    this.name = 'PayLinkApiError';
  }
}

const demoSession: CheckoutSession = {
  id: 'checkout_demo_7H2Q',
  merchantName: 'Northstar Learning Co.',
  merchantMark: 'N',
  description: 'Advanced Statistics · monthly plan',
  amountCents: 18_900,
  currency: 'USD',
  dueLabel: 'Due today',
  expiresAt: '2026-10-31T23:59:59.000Z',
};

const demoMethods: SavedMethod[] = [
  { id: 'method_visa_4242', kind: 'card', label: 'Visa ending in 4242', detail: 'Personal card', expiry: 'Exp 08/28', isDefault: true, brandColor: '#182d69', paymentMethod: { type: 'card', brand: 'visa', last4: '4242' } },
  { id: 'method_bank_9012', kind: 'bank', label: 'Checking ending in 9012', detail: 'First Community Bank', isDefault: false, brandColor: '#496c4d', paymentMethod: { type: 'bank_transfer', brand: 'checking', last4: '9012' } },
];

const demoActivity: PaymentActivity[] = [
  { id: 'pay_1048', merchantName: 'Northstar Learning Co.', description: 'Advanced Statistics · monthly plan', amountCents: 18_900, currency: 'USD', status: 'success', createdAt: 'Today, 9:42 AM', reference: 'PL-1048-NS' },
  { id: 'pay_1004', merchantName: 'Frame & Field', description: 'Print subscription', amountCents: 2_400, currency: 'USD', status: 'success', createdAt: 'Sep 28, 2026', reference: 'PL-1004-FF' },
  { id: 'pay_988', merchantName: 'Northstar Learning Co.', description: 'Intro to Data · monthly plan', amountCents: 12_900, currency: 'USD', status: 'pending', createdAt: 'Sep 12, 2026', reference: 'PL-0988-NS' },
];

const demoNotifications: NotificationItem[] = [
  { id: 'note_receipt', title: 'Your Northstar receipt is ready', body: 'Payment PL-1048-NS was completed successfully.', time: '12 minutes ago', unread: true, tone: 'green' },
  { id: 'note_security', title: 'New sign-in verified', body: 'A sign-in from Chrome on Windows was approved.', time: 'Yesterday', unread: true, tone: 'violet' },
  { id: 'note_reminder', title: 'A payment is still pending', body: 'Your Intro to Data payment may take 1–2 business days.', time: 'Sep 12, 2026', unread: false, tone: 'orange' },
];

const demoProfile: Profile = {
  name: 'Jamie Lee', username: 'jamielee', email: 'jamie.lee@example.com', phone: '+1 (555) 014-2084', avatarUrl: '', initials: 'JL', memberSince: 'March 2024', twoFactorEnabled: true,
};

const demoTickets: SupportTicket[] = [
  { id: 'PL-2841', subject: 'Question about a pending payment', status: 'open', updatedAt: 'Updated 2 hours ago', category: 'Payment status' },
  { id: 'PL-2712', subject: 'Receipt resend request', status: 'resolved', updatedAt: 'Closed Sep 30, 2026', category: 'Receipts' },
];

const demoUser: AuthUser = {
  id: 'demo_customer_jamie', email: demoProfile.email, name: demoProfile.name, role: 'customer', createdAt: '2024-03-01T00:00:00.000Z',
};

const clone = <T>(value: T): T => structuredClone(value);
const nowLabel = (): string => new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date());
const formatServerDate = (value: string): string => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(date);
};

const mapPaymentStatus = (status: ServerPaymentStatus): PaymentStatus => status === 'succeeded' ? 'success' : status === 'failed' ? 'failed' : status === 'refunded' ? 'refunded' : 'pending';

@Injectable({ providedIn: 'root' })
export class PayLinkApiService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly config = inject(PAYLINK_CONFIG);
  private methods = clone(demoMethods);
  private activity = clone(demoActivity);
  private notifications = clone(demoNotifications);
  private profile = clone(demoProfile);
  private tickets = clone(demoTickets);
  private localDemo = false;
  private fallbackWarning = '';

  get isConfigured(): boolean { return this.config.enableApi; }

  useLocalDemo(warning = ''): void {
    this.localDemo = true;
    this.fallbackWarning = warning;
    this.auth.setSession(this.demoSessionResult());
  }

  private result<T>(data: T, source: 'server' | 'demo', ok: boolean, warning?: string): ApiResult<T> {
    const notice = warning || (source === 'demo' ? this.fallbackWarning : '');
    return { data, source, ok, serverConfigured: this.isConfigured, ...(notice ? { warning: notice } : {}) };
  }

  private request<T>(path: string, options: { method?: string; body?: unknown; key?: string } = {}, requiresAuth = true): Observable<T> {
    if (!this.isConfigured) return throwError(() => new PayLinkApiError('No PayLink API base URL configured'));
    const context = new HttpContext().set(PUBLIC_REQUEST, !requiresAuth).set(IDEMPOTENCY_KEY, options.key ?? '');
    return this.http.request<Envelope<T>>(options.method ?? 'GET', `${this.config.apiBaseUrl}/api/v1${path}`, { body: options.body, context, timeout: 8000 }).pipe(
      map((payload) => payload && 'data' in payload ? payload.data : payload as unknown as T),
      catchError((error: HttpErrorResponse) => {
        const message = error.error?.error?.message ?? error.message ?? 'PayLink API request failed';
        return throwError(() => new PayLinkApiError(message, error.status));
      }),
    );
  }

  private demoSessionResult(): AuthSession {
    return { user: clone(demoUser), token: 'demo-token-in-memory', tokenType: 'Bearer', expiresAt: '2099-01-01T00:00:00.000Z' };
  }

  login(email?: string, password?: string): Observable<ApiResult<AuthSession>> {
    if (!this.isConfigured) {
      const session = this.demoSessionResult();
      this.localDemo = true;
      this.auth.setSession(session);
      return of(this.result(session, 'demo', true));
    }
    if (!email || !password) return throwError(() => new PayLinkApiError('Email and password are required.'));
    return this.request<AuthSession>('/auth/login', { method: 'POST', body: { email, password } }, false).pipe(
      tap((session) => { this.localDemo = false; this.fallbackWarning = ''; this.auth.setSession(session); }),
      map((session) => this.result(session, 'server', true)),
      catchError((error: Error) => {
        this.auth.clear();
        return of(this.result(this.demoSessionResult(), 'server', false, error.message));
      }),
    );
  }

  register(name: string, email: string, password: string): Observable<ApiResult<AuthSession>> {
    if (!this.isConfigured) {
      const session = this.demoSessionResult();
      session.user = { ...session.user, id: `demo_customer_${email.toLowerCase()}`, email: email.toLowerCase(), name };
      this.localDemo = true;
      this.profile = { ...this.profile, name, username: email.split('@')[0].toLowerCase(), email: email.toLowerCase(), initials: initialsForName(name) };
      this.auth.setSession(session);
      return of(this.result(session, 'demo', true));
    }
    return this.request<AuthSession>('/auth/register', { method: 'POST', body: { name, email, password } }, false).pipe(
      tap((session) => { this.localDemo = false; this.fallbackWarning = ''; this.auth.setSession(session); }),
      map((session) => this.result(session, 'server', true)),
      catchError((error: Error) => of(this.result(this.demoSessionResult(), 'server', false, error.message))),
    );
  }

  loginDemoCustomer(): Observable<ApiResult<AuthSession>> {
    if (!this.isConfigured) return this.login();
    return this.request<AuthSession>('/auth/demo', { method: 'POST' }, false).pipe(
      tap((session) => { this.localDemo = false; this.fallbackWarning = ''; this.auth.setSession(session); }),
      map((session) => this.result(session, 'server', true)),
      catchError((error: Error) => {
        const warning = `API unavailable: ${error.message}. Local demo only; no server actions or real charges.`;
        this.useLocalDemo(warning);
        return of(this.result(this.demoSessionResult(), 'demo', true));
      }),
    );
  }

  logout(): Observable<ApiResult<boolean>> {
    if (!this.isConfigured || this.localDemo || !this.auth.token) {
      this.auth.clear();
      return of(this.result(true, 'demo', true));
    }
    return this.request<{ loggedOut: boolean }>('/auth/logout', { method: 'POST' }).pipe(
      map(() => this.result(true, 'server', true)),
      tap(() => this.auth.clear()),
      catchError((error: Error) => {
        this.auth.clear();
        return of(this.result(true, 'demo', false, error.message));
      }),
    );
  }

  changePassword(currentPassword: string, newPassword: string): Observable<ApiResult<boolean>> {
    if (!this.isConfigured || this.localDemo) return of(this.result(true, 'demo', true));
    return this.authenticatedRequest<{ changed: boolean }>('/auth/change-password', { method: 'POST', body: { currentPassword, newPassword } }).pipe(
      map((result) => this.result(result.changed, 'server', true)),
    );
  }

  private authenticatedRequest<T>(path: string, options: { method?: string; body?: unknown; key?: string } = {}): Observable<T> {
    if (this.auth.token) return this.request<T>(path, options);
    return throwError(() => new PayLinkApiError('Your session expired. Please sign in again.', 401));
  }

  private withDemo<T>(serverCall: () => Observable<T>, fallback: () => T): Observable<ApiResult<T>> {
    if (!this.isConfigured || this.localDemo) return of(this.result(fallback(), 'demo', true));
    return serverCall().pipe(
      map((data) => this.result(data, 'server', true)),
    );
  }

  getCheckoutSession(): Observable<ApiResult<CheckoutSession>> {
    return this.withDemo(
      () => this.request<{ session: CheckoutSession & { amountMinor?: number } }>('/checkout/session', {}, false).pipe(map(({ session }) => ({ ...session, amountCents: session.amountCents ?? session.amountMinor ?? 0 }))),
      () => clone(demoSession),
    );
  }

  getSavedMethods(): Observable<ApiResult<SavedMethod[]>> {
    return this.withDemo(() => this.authenticatedRequest<{ paymentMethods: ServerPaymentMethod[] }>('/me/payment-methods').pipe(map(({ paymentMethods }) => paymentMethods.map((method) => ({
      id: method.id, kind: method.type === 'bank_transfer' ? 'bank' : 'card', label: method.label || `${method.brand} ending in ${method.last4}`, detail: method.detail, ...(method.expiry ? { expiry: method.expiry } : {}), isDefault: method.isDefault, brandColor: method.brandColor || '#182d69', paymentMethod: { type: method.type, brand: method.brand, last4: method.last4 },
    })))), () => clone(this.methods));
  }

  getActivity(): Observable<ApiResult<PaymentActivity[]>> {
    return this.withDemo(() => this.authenticatedRequest<{ payments: ServerPayment[] }>('/payments').pipe(map(({ payments }) => payments.map((payment) => ({
      id: payment.id, merchantName: 'PayLink merchant', description: payment.description, amountCents: payment.amountMinor, currency: payment.currency, status: mapPaymentStatus(payment.status), createdAt: payment.createdAt, reference: payment.providerReference || payment.id, paymentMethod: payment.paymentMethod,
    })))), () => clone(this.activity));
  }

  getPaymentDetail(id: string): Observable<ApiResult<PaymentActivity>> {
    if (!this.isConfigured || this.localDemo) {
      const payment = this.activity.find((item) => item.id === id);
      return payment ? of(this.result(clone(payment), 'demo', true)) : throwError(() => new PayLinkApiError('Payment not found', 404));
    }
    return this.authenticatedRequest<{ payment: ServerPayment }>(`/payments/${encodeURIComponent(id)}`).pipe(
      map(({ payment }) => this.result<PaymentActivity>({ id: payment.id, merchantName: 'PayLink merchant', description: payment.description, amountCents: payment.amountMinor, currency: payment.currency, status: mapPaymentStatus(payment.status), createdAt: payment.createdAt, reference: payment.providerReference || payment.id, paymentMethod: payment.paymentMethod }, 'server', true)),
    );
  }

  getNotifications(): Observable<ApiResult<NotificationItem[]>> {
    return this.withDemo(() => this.authenticatedRequest<{ notifications: ServerNotification[] }>('/notifications').pipe(map(({ notifications }) => notifications.map((item) => ({
      id: item.id, title: item.title, body: item.message, time: formatServerDate(item.createdAt), unread: !item.readAt, tone: item.type.includes('security') ? 'violet' : item.type.includes('failed') ? 'orange' : 'green',
    })))), () => clone(this.notifications));
  }

  getProfile(): Observable<ApiResult<Profile>> {
    return this.withDemo(() => this.authenticatedRequest<{ profile: Profile; user: AuthUser }>('/me').pipe(map(({ profile, user }) => profile ?? {
      name: user.name, username: user.username ?? user.email.split('@')[0], email: user.email, phone: user.phone ?? '', avatarUrl: user.avatarUrl ?? '', initials: initialsForName(user.name), memberSince: formatServerDate(user.createdAt), twoFactorEnabled: false,
    })), () => clone(this.profile));
  }

  getSupportTickets(): Observable<ApiResult<SupportTicket[]>> {
    return this.withDemo(() => this.authenticatedRequest<{ tickets: ServerTicket[] }>('/support/tickets').pipe(map(({ tickets }) => tickets.map((ticket) => ({
      id: ticket.id, subject: ticket.subject, status: ticket.status, updatedAt: formatServerDate(ticket.updatedAt), category: ticket.category === 'billing' ? 'Billing' : ticket.category === 'account' ? 'Account security' : ticket.category === 'technical' ? 'Technical' : 'Something else',
    })))), () => clone(this.tickets));
  }

  createPayment(checkoutId: string, methodId: string, outcome: TestOutcome, key: string): Observable<ApiResult<PaymentResult>> {
    const fallback: PaymentResult = outcome === 'success'
      ? { status: 'success', reference: 'PL-DEMO-2048', processedAt: nowLabel(), message: 'The payment completed successfully. No money moved.' }
      : outcome === 'pending'
        ? { status: 'pending', reference: 'PL-DEMO-2049', processedAt: nowLabel(), message: 'The payment is waiting for a bank response. No money moved.' }
        : { status: 'failed', reference: 'PL-DEMO-2050', processedAt: nowLabel(), message: 'The payment was declined. No money moved.' };
    if (!this.isConfigured || this.localDemo) {
      const paymentId = `local-${key}`;
      this.activity = [{ id: paymentId, merchantName: demoSession.merchantName, description: demoSession.description, amountCents: demoSession.amountCents, currency: demoSession.currency, status: fallback.status, createdAt: nowLabel(), reference: fallback.reference, paymentMethod: this.methods.find((method) => method.id === methodId)?.paymentMethod }, ...this.activity.filter((payment) => payment.id !== paymentId)];
      return of(this.result({ ...fallback, paymentId }, 'demo', true));
    }
    return this.authenticatedRequest<{ payment: ServerPayment }>('/payments', { method: 'POST', key, body: { checkoutSessionId: checkoutId, paymentMethodId: methodId, testOutcome: outcome } }).pipe(
      map(({ payment }) => this.mapPaymentResult(payment)),
      map((payment) => this.result(payment, 'server', true)),
      catchError((error: Error) => of(this.result({ ...fallback, status: 'pending' as const, message: 'The outcome is unknown. Retry this same request safely; do not start another payment.' }, 'server', false, error.message))),
    );
  }

  getPaymentResult(id: string): Observable<ApiResult<PaymentResult>> {
    return this.authenticatedRequest<{ payment: ServerPayment }>(`/payments/${encodeURIComponent(id)}`).pipe(map(({ payment }) => this.result(this.mapPaymentResult(payment), 'server', true)));
  }

  private mapPaymentResult(payment: ServerPayment): PaymentResult {
    const status = mapPaymentStatus(payment.status);
    return {
      paymentId: payment.id, status, reference: payment.providerReference || payment.id, processedAt: payment.updatedAt,
      message: status === 'success' ? 'The server confirmed this payment. No money moved.' : status === 'pending' ? 'The server still reports processing. This is not a successful payment. No money moved.' : status === 'refunded' ? 'The server reports this payment was refunded. No money moved.' : 'The server declined this payment. No money moved.',
    };
  }

  markNotificationRead(id: string): Observable<ApiResult<NotificationItem>> {
    const fallback = this.notifications.find((item) => item.id === id);
    if (!this.isConfigured || this.localDemo) {
      if (!fallback) return throwError(() => new PayLinkApiError('Notification not found'));
      fallback.unread = false;
      return of(this.result(clone(fallback), 'demo', true));
    }
    return this.authenticatedRequest<{ notification: ServerNotification }>(`/notifications/${encodeURIComponent(id)}/read`, { method: 'POST' }).pipe(
      map(({ notification }) => this.result<NotificationItem>({ id: notification.id, title: notification.title, body: notification.message, time: formatServerDate(notification.createdAt), unread: !notification.readAt, tone: notification.type.includes('security') ? 'violet' : 'green' }, 'server', true)),
      catchError((error: Error) => of(this.result<NotificationItem>({ id, title: '', body: '', time: '', unread: true, tone: 'green' }, 'server', false, error.message))),
    );
  }

  markAllNotificationsRead(): Observable<ApiResult<boolean>> {
    if (!this.isConfigured || this.localDemo) {
      this.notifications = this.notifications.map((item) => ({ ...item, unread: false }));
      return of(this.result(true, 'demo', true));
    }
    return this.authenticatedRequest<{ markedRead: boolean }>('/notifications/read-all', { method: 'POST' }).pipe(
      map(() => this.result(true, 'server', true)),
      catchError((error: Error) => of(this.result(false, 'server', false, error.message))),
    );
  }

  createSupportTicket(request: SupportTicketRequest): Observable<ApiResult<SupportTicket>> {
    const fallback: SupportTicket = { id: `PL-DEMO-${Date.now().toString().slice(-4)}`, subject: request.subject, status: 'open', updatedAt: 'Created just now', category: request.category };
    if (!this.isConfigured || this.localDemo) {
      this.tickets = [fallback, ...this.tickets];
      return of(this.result(clone(fallback), 'demo', true));
    }
    const category = /receipt|payment|billing/i.test(request.category) ? 'billing' : /security|account/i.test(request.category) ? 'account' : /technical/i.test(request.category) ? 'technical' : 'other';
    return this.authenticatedRequest<{ ticket: ServerTicket }>('/support/tickets', { method: 'POST', body: { subject: request.subject, message: request.message, category } }).pipe(
      map(({ ticket }) => this.result({ id: ticket.id, subject: ticket.subject, status: ticket.status, updatedAt: formatServerDate(ticket.updatedAt), category: ticket.category }, 'server', true)),
      catchError((error: Error) => of(this.result(fallback, 'server', false, error.message))),
    );
  }

  saveProfile(profile: ProfileUpdate): Observable<ApiResult<Profile>> {
    if (!this.isConfigured || this.localDemo) {
      this.profile = { ...this.profile, ...profile, initials: initialsForName(profile.name) };
      return of(this.result(clone(this.profile), 'demo', true));
    }
    return this.authenticatedRequest<{ profile: Profile }>('/me', { method: 'PATCH', body: profile }).pipe(
      map(({ profile: updated }) => this.result(updated, 'server', true)),
      catchError((error: Error) => of(this.result({ ...this.profile, ...profile, initials: initialsForName(profile.name) }, 'server', false, error.message))),
    );
  }

  removeSavedMethod(id: string): Observable<ApiResult<boolean>> {
    if (!this.isConfigured || this.localDemo) {
      if (!this.methods.some((method) => method.id === id)) return throwError(() => new PayLinkApiError('Payment method not found'));
      this.methods = this.methods.filter((method) => method.id !== id);
      return of(this.result(true, 'demo', true));
    }
    return this.authenticatedRequest<unknown>(`/me/payment-methods/${encodeURIComponent(id)}`, { method: 'DELETE' }).pipe(
      map(() => this.result(true, 'server', true)),
      catchError((error: Error) => of(this.result(false, 'server', false, error.message))),
    );
  }
}
