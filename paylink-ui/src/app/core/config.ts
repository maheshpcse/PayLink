import { InjectionToken } from '@angular/core';
import { environment } from '../../environments/environment';

export interface PayLinkRuntimeConfig {
  apiBaseUrl: string;
  enableApi: boolean;
}

declare global {
  // Optional non-secret runtime configuration supplied by a deployment shell.
  var __PAYLINK_CONFIG__: Partial<PayLinkRuntimeConfig> | undefined;
}

export const PAYLINK_CONFIG = new InjectionToken<PayLinkRuntimeConfig>('PAYLINK_CONFIG', {
  providedIn: 'root',
  factory: () => {
    const runtime = globalThis.__PAYLINK_CONFIG__ ?? {};
    return {
      apiBaseUrl: runtime.apiBaseUrl?.trim().replace(/\/$/, '') ?? environment.apiBaseUrl,
      enableApi: runtime.enableApi ?? environment.enableApi,
    };
  },
});
