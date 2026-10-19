import { AsyncPipe, NgFor } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { combineLatest, debounceTime, distinctUntilChanged, map, startWith } from 'rxjs';
import { PayLinkStoreService } from '../core/paylink-store.service';
import { formatMoney } from '../core/models';
import { IconComponent, PageHeadingComponent, StatusBadgeComponent } from '../shared/ui.components';

@Component({
  selector: 'pl-activity', standalone: true,
  imports: [AsyncPipe, NgFor, ReactiveFormsModule, RouterLink, IconComponent, PageHeadingComponent, StatusBadgeComponent],
  templateUrl: './activity.component.html',
})
export class ActivityComponent {
  readonly store = inject(PayLinkStoreService);
  readonly formatMoney = formatMoney;
  readonly search = new FormControl('', { nonNullable: true });
  readonly status = new FormControl('all', { nonNullable: true });
  readonly filtered$ = combineLatest([
    this.store.activity$,
    this.search.valueChanges.pipe(startWith(''), debounceTime(200), distinctUntilChanged()),
    this.status.valueChanges.pipe(startWith('all')),
  ]).pipe(map(([payments, search, status]) => payments.filter((payment) =>
    `${payment.merchantName} ${payment.description} ${payment.reference}`.toLowerCase().includes(search.trim().toLowerCase()) && (status === 'all' || status === payment.status),
  )));
}
