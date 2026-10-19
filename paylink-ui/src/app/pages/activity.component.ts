import { AsyncPipe, NgFor } from '@angular/common';
import { Component, DestroyRef, inject } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { BehaviorSubject, combineLatest, debounceTime, distinctUntilChanged, map, shareReplay, startWith } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
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
  readonly pageSize = 10;
  readonly page$ = new BehaviorSubject(1);
  readonly filtered$ = combineLatest([
    this.store.activity$,
    this.search.valueChanges.pipe(startWith(''), debounceTime(200), distinctUntilChanged()),
    this.status.valueChanges.pipe(startWith('all')),
  ]).pipe(map(([payments, search, status]) => payments.filter((payment) =>
    `${payment.merchantName} ${payment.description} ${payment.reference}`.toLowerCase().includes(search.trim().toLowerCase()) && (status === 'all' || status === payment.status),
  )), shareReplay({ bufferSize: 1, refCount: true }));
  readonly pageCount$ = this.filtered$.pipe(map((payments) => Math.max(1, Math.ceil(payments.length / this.pageSize))));
  readonly paged$ = combineLatest([this.filtered$, this.page$]).pipe(map(([payments, page]) => payments.slice((page - 1) * this.pageSize, page * this.pageSize)));

  constructor() {
    const destroyRef = inject(DestroyRef);
    combineLatest([
      this.search.valueChanges.pipe(startWith(this.search.value), debounceTime(200), distinctUntilChanged()),
      this.status.valueChanges.pipe(startWith(this.status.value)),
    ]).pipe(takeUntilDestroyed(destroyRef)).subscribe(() => this.page$.next(1));
  }

  previousPage(): void { this.page$.next(Math.max(1, this.page$.value - 1)); }
  nextPage(): void { this.page$.next(this.page$.value + 1); }
}
