import { newId } from './security.js';
import type { PaymentRecord } from './types.js';

export interface AuthorizationResult {
  status: 'succeeded' | 'processing' | 'failed';
  providerReference: string;
  failureCode?: string;
}

/**
 * Deliberately deterministic test seam. It never contacts a payment network and
 * must be replaced by a real provider adapter before production use.
 */
export class DevTestPaymentProvider {
  readonly name = 'dev-test-provider';

  authorize(payment: PaymentRecord, outcome: 'succeeded' | 'processing' | 'failed'): AuthorizationResult {
    if (outcome === 'processing') {
      return {
        status: 'processing',
        providerReference: `dev_pending_${newId()}`,
      };
    }
    if (outcome === 'failed') {
      return {
        status: 'failed',
        providerReference: `dev_fail_${newId()}`,
        failureCode: 'test_declined',
      };
    }
    return { status: 'succeeded', providerReference: `dev_ok_${newId()}` };
  }

  refund(payment: PaymentRecord): { providerReference: string } {
    return { providerReference: `dev_refund_${newId()}` };
  }
}
