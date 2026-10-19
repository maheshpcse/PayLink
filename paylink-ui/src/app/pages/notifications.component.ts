import { AsyncPipe } from '@angular/common';
import { Component, DestroyRef, inject } from '@angular/core';
import { take } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { PayLinkStoreService } from '../core/paylink-store.service';
import { IconComponent } from '../shared/ui.components';

@Component({ selector: 'pl-notifications', standalone: true, imports: [AsyncPipe, IconComponent], templateUrl: './notifications.component.html' })
export class NotificationsComponent {
  readonly store = inject(PayLinkStoreService);
  private readonly destroyRef = inject(DestroyRef);
  markRead(id: string): void { this.store.markNotificationRead(id).pipe(take(1), takeUntilDestroyed(this.destroyRef)).subscribe((result) => { this.store.record(result); if (result.ok) this.store.notifications$.pipe(take(1)).subscribe((items) => this.store.setNotifications(items.map((item) => item.id === id ? result.data : item))); }); }
  markAll(): void { this.store.markAllNotificationsRead().pipe(take(1), takeUntilDestroyed(this.destroyRef)).subscribe((result) => { this.store.record(result); if (result.ok) this.store.notifications$.pipe(take(1)).subscribe((items) => this.store.setNotifications(items.map((item) => ({ ...item, unread: false })))); }); }
}
