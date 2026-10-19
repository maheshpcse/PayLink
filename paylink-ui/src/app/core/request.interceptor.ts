import { HttpContextToken, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from './auth.service';
import { PAYLINK_CONFIG } from './config';

export const IDEMPOTENCY_KEY = new HttpContextToken<string>(() => '');
export const PUBLIC_REQUEST = new HttpContextToken<boolean>(() => false);
export const requestId = (): string => crypto.randomUUID();

export const payLinkRequestInterceptor: HttpInterceptorFn = (request, next) => {
  const config = inject(PAYLINK_CONFIG);
  const auth = inject(AuthService);
  const base = new URL(`${config.apiBaseUrl}/api/v1/`, document.baseURI);
  const target = new URL(request.url, document.baseURI);
  const trusted = config.enableApi && target.origin === base.origin && target.pathname.startsWith(base.pathname);
  if (!trusted) return next(request);

  let headers = request.headers.set('Accept', 'application/json').set('X-Correlation-ID', requestId());
  const key = request.context.get(IDEMPOTENCY_KEY);
  if (key) headers = headers.set('Idempotency-Key', key);
  if (auth.token && auth.token !== 'demo-token-in-memory' && !request.context.get(PUBLIC_REQUEST)) {
    headers = headers.set('Authorization', `Bearer ${auth.token}`);
  }
  // This server uses bearer authentication. Cookies are never sent cross-origin; Angular's
  // same-origin XSRF support remains available if a future backend adopts cookie authentication.
  return next(request.clone({ headers, withCredentials: false, credentials: 'omit' }));
};
