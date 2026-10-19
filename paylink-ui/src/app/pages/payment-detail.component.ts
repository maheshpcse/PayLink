import { AsyncPipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { catchError, map, of, switchMap } from 'rxjs';
import { PayLinkApiService } from '../core/paylink-api.service';
import { formatMoney } from '../core/models';
import { StatusBadgeComponent } from '../shared/ui.components';

@Component({
  selector: 'pl-payment-detail', standalone: true, imports: [AsyncPipe, RouterLink, StatusBadgeComponent],
  template: `
    <div class="page-stack">
      <a class="text-button" routerLink="/account/activity">← Back to payment activity</a>
      @if (detail$ | async; as view) {
        @if (view.result; as result) {
          <section class="panel data-panel">
            <p class="eyebrow">{{ result.source === 'server' ? 'Server-reported test payment' : 'Local demo payment' }}</p>
            <h1>Payment details.</h1><h2 class="detail-amount">{{ money(result.data.amountCents, result.data.currency) }}</h2>
            <pl-status-badge [status]="result.data.status" />
            <dl class="detail-list"><dt>Merchant</dt><dd>{{ result.data.merchantName }}{{ result.source === 'server' ? ' (name not supplied by this API)' : '' }}</dd><dt>Description</dt><dd>{{ result.data.description }}</dd><dt>Date and time</dt><dd>{{ result.data.createdAt }}</dd><dt>Reference</dt><dd><code>{{ result.data.reference }}</code></dd><dt>Masked method</dt><dd>{{ result.data.paymentMethod ? result.data.paymentMethod.brand + ' •••• ' + result.data.paymentMethod.last4 : 'Not included in this demo record' }}</dd></dl>
            <p class="muted">No money moved. Downloadable receipts and return-to-merchant URLs are not supplied by the current server.</p>
          </section>
        } @else { <section class="panel data-panel" role="alert"><h1>Payment unavailable</h1><p>{{ view.error }}</p></section> }
      }
    </div>
  `,
})
export class PaymentDetailComponent {
  private readonly api = inject(PayLinkApiService);
  private readonly route = inject(ActivatedRoute);
  readonly money = formatMoney;
  readonly detail$ = this.route.paramMap.pipe(
    switchMap((params) => this.api.getPaymentDetail(params.get('id') ?? '')),
    map((result) => ({ result, error: '' })),
    catchError((error: Error) => of({ result: null, error: error.message })),
  );
}
