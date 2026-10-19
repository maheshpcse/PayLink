import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { AuthService } from './auth.service';
import { PAYLINK_CONFIG } from './config';
import { PayLinkApiService } from './paylink-api.service';
import { payLinkRequestInterceptor } from './request.interceptor';

const authSession = {
  token: 'memory-only-secret', tokenType: 'Bearer' as const, expiresAt: '2099-01-01T00:00:00Z',
  user: { id: 'customer-123', name: 'Customer', email: 'customer@example.test', role: 'customer' as const, createdAt: '2026-01-01T00:00:00Z' },
};
const serverPayment = {
  id: 'payment-123', amountMinor: 18900, currency: 'USD', description: 'Server-owned order', status: 'processing',
  paymentMethod: { type: 'card', brand: 'visa', last4: '4242' }, providerReference: 'test-provider-123',
  createdAt: '2026-10-19T10:00:00Z', updatedAt: '2026-10-19T10:00:00Z',
};

describe('Angular HTTP server contract', () => {
  let api: PayLinkApiService;
  let http: HttpTestingController;
  let auth: AuthService;
  beforeEach(() => {
    localStorage.clear(); sessionStorage.clear();
    TestBed.configureTestingModule({ providers: [
      provideHttpClient(withInterceptors([payLinkRequestInterceptor])), provideHttpClientTesting(),
      { provide: PAYLINK_CONFIG, useValue: { apiBaseUrl: 'https://api.example.test', enableApi: true } },
    ] });
    api = TestBed.inject(PayLinkApiService);
    http = TestBed.inject(HttpTestingController);
    auth = TestBed.inject(AuthService);
  });
  afterEach(() => http.verify());

  it('logs in with HttpClient, keeps tokens in memory and clears them on logout', async () => {
    const login = firstValueFrom(api.login('customer@example.test', 'Password123!'));
    const req = http.expectOne('https://api.example.test/api/v1/auth/login');
    expect(req.request.headers.has('Authorization')).toBe(false);
    expect(req.request.body).toEqual({ email: 'customer@example.test', password: 'Password123!' });
    req.flush({ data: authSession });
    expect((await login).source).toBe('server');
    expect(auth.token).toBe('memory-only-secret');
    expect(localStorage.length).toBe(0);
    expect(sessionStorage.length).toBe(0);
    const logout = firstValueFrom(api.logout());
    const logoutReq = http.expectOne('https://api.example.test/api/v1/auth/logout');
    expect(logoutReq.request.headers.get('Authorization')).toBe('Bearer memory-only-secret');
    expect(logoutReq.request.withCredentials).toBe(false);
    logoutReq.flush({ data: { loggedOut: true } });
    await logout;
    expect(auth.token).toBeUndefined();
  });

  it('maps server-owned totals and sends only IDs/test outcome with a stable payment key', async () => {
    auth.setSession(authSession);
    const session = firstValueFrom(api.getCheckoutSession());
    http.expectOne('https://api.example.test/api/v1/checkout/session').flush({ data: { session: { id: 'checkout-server', merchantName: 'Merchant', merchantMark: 'M', description: 'Fixed', amountMinor: 18900, currency: 'USD', dueLabel: 'Today', expiresAt: '2099-01-01T00:00:00Z' } } });
    expect((await session).data.amountCents).toBe(18900);
    const result = firstValueFrom(api.createPayment('checkout-server', 'arbitrary-owned-method', 'pending', 'same-attempt-key'));
    const req = http.expectOne('https://api.example.test/api/v1/payments');
    expect(req.request.body).toEqual({ checkoutSessionId: 'checkout-server', paymentMethodId: 'arbitrary-owned-method', testOutcome: 'pending' });
    expect(req.request.headers.get('Idempotency-Key')).toBe('same-attempt-key');
    expect(req.request.headers.get('Authorization')).toBe('Bearer memory-only-secret');
    expect(req.request.headers.get('X-Correlation-ID')).toBeTruthy();
    req.flush({ data: { payment: serverPayment } });
    expect((await result).data).toMatchObject({ status: 'pending', paymentId: 'payment-123' });
  });

  it('does not leak bearer/correlation headers or credentials to a lookalike external API', () => {
    auth.setSession(authSession);
    TestBed.inject(HttpClient).get('https://other.example.test/api/v1/payments').subscribe();
    const request = http.expectOne('https://other.example.test/api/v1/payments');
    expect(request.request.headers.has('Authorization')).toBe(false);
    expect(request.request.headers.has('X-Correlation-ID')).toBe(false);
    expect(request.request.withCredentials).toBe(false);
    request.flush({});
  });

  it('uses coherent, labeled local demo mode if demo startup cannot reach the API', async () => {
    const login = firstValueFrom(api.loginDemoCustomer());
    http.expectOne('https://api.example.test/api/v1/auth/demo').error(new ProgressEvent('network error'));
    expect(await login).toMatchObject({ source: 'demo', ok: true, warning: expect.stringContaining('Local demo') });
    const methods = await firstValueFrom(api.getSavedMethods());
    expect(methods.source).toBe('demo');
    const payment = await firstValueFrom(api.createPayment('checkout_demo_7H2Q', 'method_visa_4242', 'failed', 'local-test-key'));
    expect(payment.data.status).toBe('failed');
    http.expectNone('https://api.example.test/api/v1/payments');
  });

  it('rejects bad login rather than authenticating a fake user', async () => {
    const login = firstValueFrom(api.login('wrong@example.test', 'Wrong123!'));
    http.expectOne('https://api.example.test/api/v1/auth/login').flush({ error: { message: 'Email or password is incorrect' } }, { status: 401, statusText: 'Unauthorized' });
    expect((await login).ok).toBe(false);
    expect(auth.isAuthenticated).toBe(false);
  });

  it('never returns a successful outcome after an ambiguous payment network failure', async () => {
    auth.setSession(authSession);
    const payment = firstValueFrom(api.createPayment('session-1', 'method-1', 'success', 'retry-this-key'));
    http.expectOne('https://api.example.test/api/v1/payments').error(new ProgressEvent('lost response'));
    expect(await payment).toMatchObject({ source: 'server', ok: false, data: { status: 'pending' } });
  });

  it('handles server-generated notification/method IDs instead of requiring demo seed IDs', async () => {
    auth.setSession(authSession);
    const notification = firstValueFrom(api.markNotificationRead('server-only-notification'));
    http.expectOne('https://api.example.test/api/v1/notifications/server-only-notification/read').flush({ data: { notification: { id: 'server-only-notification', title: 'Payment event', message: 'Test event', type: 'payment.succeeded', readAt: '2026-10-19T10:00:00Z', createdAt: '2026-10-19T10:00:00Z' } } });
    expect((await notification).data.unread).toBe(false);
    const removal = firstValueFrom(api.removeSavedMethod('server-only-method'));
    const req = http.expectOne('https://api.example.test/api/v1/me/payment-methods/server-only-method');
    expect(req.request.method).toBe('DELETE');
    req.flush(null, { status: 204, statusText: 'No Content' });
    expect((await removal).ok).toBe(true);
  });

  it('maps support category and profile updates to the existing versioned contract', async () => {
    auth.setSession(authSession);
    const ticket = firstValueFrom(api.createSupportTicket({ subject: 'Receipt question', message: 'Where is my test receipt?', category: 'Receipts' }));
    const req = http.expectOne('https://api.example.test/api/v1/support/tickets');
    expect(req.request.body.category).toBe('billing');
    req.flush({ data: { ticket: { id: 'ticket-server', subject: 'Receipt question', status: 'open', category: 'billing', updatedAt: '2026-10-19' } } });
    expect((await ticket).data.id).toBe('ticket-server');
    const update = { name: 'Updated Customer', email: 'updated@example.test', phone: '', twoFactorEnabled: false };
    const profile = firstValueFrom(api.saveProfile(update));
    const patch = http.expectOne('https://api.example.test/api/v1/me');
    expect(patch.request.method).toBe('PATCH');
    expect(patch.request.body).toEqual(update);
    patch.flush({ data: { profile: { ...update, initials: 'UC', memberSince: 'January 2026' } } });
    expect((await profile).data.name).toBe('Updated Customer');
  });
});
