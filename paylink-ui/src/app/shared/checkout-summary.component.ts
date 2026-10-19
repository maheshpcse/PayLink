import { Component, Input } from '@angular/core';
import { CheckoutSession, formatDate, formatMoney } from '../core/models';
import { DataSourceComponent, IconComponent, TestModeBadgeComponent } from './ui.components';

@Component({
  selector: 'pl-checkout-summary',
  standalone: true,
  imports: [DataSourceComponent, IconComponent, TestModeBadgeComponent],
  template: `
    <aside class="checkout-summary panel" aria-label="Order summary">
      <p class="eyebrow">Review your order</p><h2>Order summary</h2>
      <div class="merchant-row"><span class="merchant-mark">{{ session.merchantMark }}</span><span><strong>{{ session.merchantName }}</strong><small>Participating test merchant</small></span></div>
      <div class="summary-divider"></div>
      <div class="summary-line"><span>{{ session.description }}</span><strong>{{ money(session.amountCents, session.currency) }}</strong></div>
      <div class="summary-line summary-line--muted"><span>Processing fee</span><span>{{ money(0, session.currency) }}</span></div>
      <div class="summary-total"><span>Total due</span><strong>{{ money(session.amountCents, session.currency) }}</strong></div>
      <div class="fixed-amount-note"><pl-icon name="shield" /><span><strong>{{ source === 'server' ? 'Amount fixed by server' : 'Fixed demo amount' }}</strong><small>{{ source === 'server' ? 'The browser cannot change this payable total.' : 'Example order only. No server checkout is being processed.' }}</small></span></div>
      <div class="summary-due"><pl-icon name="clock" /> {{ session.dueLabel }} · expires {{ date(session.expiresAt) }}</div>
      <div class="summary-footer"><pl-test-badge /><pl-data-source [source]="source" [serverConfigured]="serverConfigured" [warning]="warning" /></div>
    </aside>
  `,
})
export class CheckoutSummaryComponent {
  @Input({ required: true }) session!: CheckoutSession;
  @Input() source: 'server' | 'demo' = 'demo';
  @Input() serverConfigured = false;
  @Input() warning = '';
  readonly money = formatMoney;
  readonly date = formatDate;
}
