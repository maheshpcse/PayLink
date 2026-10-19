import { AsyncPipe, NgFor, NgIf, SlicePipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PayLinkStoreService } from '../core/paylink-store.service';
import { formatMoney } from '../core/models';
import { IconComponent, StatusBadgeComponent } from '../shared/ui.components';

@Component({ selector: 'pl-overview', standalone: true, imports: [AsyncPipe, NgFor, NgIf, SlicePipe, RouterLink, IconComponent, StatusBadgeComponent], templateUrl: './overview.component.html' })
export class OverviewComponent {
  readonly store = inject(PayLinkStoreService);
  readonly formatMoney = formatMoney;
  completedTotal(activity: import('../core/models').PaymentActivity[]): number { return activity.filter((item) => item.status === 'success').reduce((sum, item) => sum + item.amountCents, 0); }
  completedCount(activity: import('../core/models').PaymentActivity[]): number { return activity.filter((item) => item.status === 'success').length; }
  pendingCount(activity: import('../core/models').PaymentActivity[]): number { return activity.filter((item) => item.status === 'pending').length; }
  cardCount(methods: import('../core/models').SavedMethod[]): number { return methods.filter((item) => item.kind === 'card').length; }
  bankCount(methods: import('../core/models').SavedMethod[]): number { return methods.filter((item) => item.kind === 'bank').length; }
}
