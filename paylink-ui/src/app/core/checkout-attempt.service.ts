import { Injectable } from '@angular/core';
import { TestOutcome } from './models';

export interface CheckoutAttempt {
  scope: string;
  key: string;
  methodId: string;
  outcome: TestOutcome;
  paymentId?: string;
}

@Injectable({ providedIn: 'root' })
export class CheckoutAttemptService {
  private readonly storageKey = 'paylink-test-checkout-attempt';
  private attempt: CheckoutAttempt | null = null;

  read(scope: string): CheckoutAttempt | null {
    try {
      const saved = JSON.parse(sessionStorage.getItem(this.storageKey) ?? 'null') as CheckoutAttempt | null;
      if (saved?.scope === scope && saved.key && saved.methodId && ['success', 'pending', 'failed'].includes(saved.outcome)) return saved;
    } catch { /* Storage can be disabled. In-memory retry safety is still available. */ }
    return this.attempt?.scope === scope ? this.attempt : null;
  }

  save(attempt: CheckoutAttempt): void {
    this.attempt = attempt;
    // Only opaque IDs and a test outcome are stored. Authentication tokens are never persisted.
    try { sessionStorage.setItem(this.storageKey, JSON.stringify(attempt)); } catch { /* Use in-memory state. */ }
  }

  clear(): void {
    this.attempt = null;
    try { sessionStorage.removeItem(this.storageKey); } catch { /* No storage to clear. */ }
  }
}
