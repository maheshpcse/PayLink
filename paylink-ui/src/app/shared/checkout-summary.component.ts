import { Component, Input } from '@angular/core';
import { CheckoutSession, formatDate, formatMoney } from '../core/models';
import { IconComponent } from './ui.components';

@Component({
  selector: 'pl-checkout-summary',
  standalone: true,
   imports: [IconComponent],
  template: `
    <aside class="checkout-summary panel" aria-label="Order summary">
      <p class="eyebrow">Review your order</p><h2>Order summary</h2>
       <div class="merchant-row"><span class="merchant-mark">{{ session.merchantMark }}</span><span><strong>{{ session.merchantName }}</strong><small>Participating merchant</small></span></div>
      <div class="summary-divider"></div>
      <div class="summary-line"><span>{{ session.description }}</span><strong>{{ money(session.amountCents, session.currency) }}</strong></div>
      <div class="summary-line summary-line--muted"><span>Processing fee</span><span>{{ money(0, session.currency) }}</span></div>
      <div class="summary-total"><span>Total due</span><strong>{{ money(session.amountCents, session.currency) }}</strong></div>
       <div class="fixed-amount-note"><pl-icon name="shield" /><span><strong>Amount fixed for checkout</strong><small>The payable total cannot be changed here.</small></span></div>
      <div class="summary-due"><pl-icon name="clock" /> {{ session.dueLabel }} · expires {{ date(session.expiresAt) }}</div>
    </aside>
  `,
})
export class CheckoutSummaryComponent {
  @Input({ required: true }) session!: CheckoutSession;
  readonly money = formatMoney;
  readonly date = formatDate;
}
