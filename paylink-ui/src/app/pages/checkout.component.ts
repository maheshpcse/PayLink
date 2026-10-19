import { AsyncPipe } from '@angular/common';
import { Component, DestroyRef, OnInit, inject } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { BehaviorSubject, combineLatest, exhaustMap, filter, take, takeWhile, timer } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { PayLinkStoreService } from '../core/paylink-store.service';
import { CheckoutAttempt, CheckoutAttemptService } from '../core/checkout-attempt.service';
import { AuthService } from '../core/auth.service';
import { CheckoutSession, formatDate, formatMoney, PaymentResult, PaymentStatus, SavedMethod, TestOutcome } from '../core/models';
import { IconComponent, TestModeBadgeComponent } from '../shared/ui.components';
import { CheckoutSummaryComponent } from '../shared/checkout-summary.component';
import { MethodSelectorComponent } from '../shared/method-selector.component';

type CheckoutViewStatus = 'ready' | 'processing' | PaymentStatus;

@Component({
  selector: 'pl-checkout',
  standalone: true,
  imports: [AsyncPipe, ReactiveFormsModule, RouterLink, IconComponent, TestModeBadgeComponent, CheckoutSummaryComponent, MethodSelectorComponent],
  templateUrl: './checkout.component.html',
})
export class CheckoutComponent implements OnInit {
  readonly store = inject(PayLinkStoreService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly auth = inject(AuthService);
  private readonly attempts = inject(CheckoutAttemptService);
  readonly formatMoney = formatMoney;
  readonly formatDate = formatDate;
  readonly form = new FormGroup({
    methodId: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    outcome: new FormControl<TestOutcome>('success', { nonNullable: true }),
  });
  readonly status$ = new BehaviorSubject<CheckoutViewStatus>('ready');
  readonly result$ = new BehaviorSubject<PaymentResult | null>(null);
  private session: CheckoutSession | null = null;
  attempt: CheckoutAttempt | null = null;
  actionError = '';
  cancelled = false;
  expired = false;
  private scope = '';

  ngOnInit(): void {
    combineLatest([this.store.session$, this.store.loading$]).pipe(filter(([session, loading]) => Boolean(session) && !loading), take(1), takeUntilDestroyed(this.destroyRef)).subscribe(([session]) => {
      this.session = session;
      this.expired = Boolean(session && Date.parse(session.expiresAt) <= Date.now());
      this.scope = `${this.store.source}:${this.auth.userId}:${session?.id}`;
      this.attempt = this.attempts.read(this.scope);
      if (this.attempt) {
        this.form.patchValue({ methodId: this.attempt.methodId, outcome: this.attempt.outcome });
        if (this.attempt.paymentId && this.store.source === 'server') this.refreshResult(this.attempt.paymentId);
        else this.actionError = 'An earlier attempt exists. Retry safely with the same idempotency key to retrieve its outcome.';
      }
    });
    this.store.methods$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((methods) => {
      if (!this.form.controls.methodId.value && methods.length) this.form.controls.methodId.setValue(methods.find((method) => method.isDefault)?.id ?? methods[0].id);
    });
  }

  methodLabel(method: SavedMethod): string { return `${method.label}${method.expiry ? ` · ${method.expiry}` : ''}`; }
  methodIcon(method: SavedMethod): 'card' | 'wallet' { return method.kind === 'card' ? 'card' : 'wallet'; }
  isSelected(method: SavedMethod): boolean { return this.form.controls.methodId.value === method.id; }

  pay(): void {
    if (!this.session || this.status$.value === 'processing' || (this.expired && !this.attempt)) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.actionError = 'Choose a saved payment method before continuing.';
      return;
    }
    if (!this.attempt) {
      this.attempt = { scope: this.scope, key: crypto.randomUUID(), methodId: this.form.controls.methodId.value, outcome: this.form.controls.outcome.value };
      this.attempts.save(this.attempt);
    }
    this.actionError = '';
    this.status$.next('processing');
    this.result$.next(null);
    this.store.createPayment(this.session.id, this.attempt.methodId, this.attempt.outcome, this.attempt.key).pipe(take(1), takeUntilDestroyed(this.destroyRef)).subscribe((result) => {
      this.store.record(result);
      if (!result.ok) { this.status$.next('ready'); this.actionError = `${result.warning}. Outcome not confirmed; retry this same attempt safely.`; }
      else {
        this.status$.next(result.data.status);
        this.result$.next(result.data);
        if (this.attempt) { this.attempt.paymentId = result.data.paymentId; this.attempts.save(this.attempt); }
        if (result.data.status === 'pending' && result.data.paymentId && result.source === 'server') this.poll(result.data.paymentId);
      }
    });
  }

  reset(): void {
    if (this.result$.value?.status === 'pending') return;
    this.attempts.clear(); this.attempt = null; this.status$.next('ready'); this.result$.next(null);
    this.cancelled = false;
    this.actionError = '';
    this.form.reset({ methodId: '', outcome: 'success' });
    this.form.markAsPristine();
    this.form.markAsUntouched();
  }

  private refreshResult(id: string): void {
    this.status$.next('processing');
    this.store.getPaymentResult(id).pipe(take(1), takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (result) => { this.status$.next(result.data.status); this.result$.next(result.data); if (result.data.status === 'pending') this.poll(id); },
      error: (error: Error) => { this.status$.next('ready'); this.actionError = `Unable to verify the earlier attempt: ${error.message}. Retry safely.`; },
    });
  }

  private poll(id: string): void {
    timer(2000, 3000).pipe(
      take(5), exhaustMap(() => this.store.getPaymentResult(id)),
      takeWhile((result) => result.data.status === 'pending', true), takeUntilDestroyed(this.destroyRef),
    ).subscribe({
      next: (result) => {
        this.result$.next(result.data); this.status$.next(result.data.status);
        if (result.data.status !== 'pending') this.store.refreshActivity().pipe(takeUntilDestroyed(this.destroyRef)).subscribe();
      },
      error: (error: Error) => { this.actionError = `Status refresh stopped: ${error.message}. The last server-reported status is retained.`; },
    });
  }

  copyFor(result: PaymentResult): { eyebrow: string; title: string; icon: 'check' | 'clock' | 'x' } {
    return result.status === 'success'
      ? { eyebrow: 'Payment complete', title: 'That went through beautifully.', icon: 'check' }
      : result.status === 'pending'
        ? { eyebrow: 'Payment pending', title: 'We are waiting on a response.', icon: 'clock' }
        : { eyebrow: 'Payment not completed', title: 'That test payment was declined.', icon: 'x' };
  }
}
