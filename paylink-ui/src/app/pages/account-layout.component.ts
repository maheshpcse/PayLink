import { AsyncPipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { PayLinkStoreService } from '../core/paylink-store.service';

@Component({
  selector: 'pl-account-layout',
  standalone: true,
  imports: [AsyncPipe, RouterOutlet],
  template: `
    @if (store.loading$ | async) {
      <div class="loading-screen account-loading" role="status" aria-live="polite">
        <div class="skeleton-stack" aria-hidden="true">
          <span class="skeleton skeleton--heading"></span>
          <span class="skeleton skeleton--line"></span>
          <span class="skeleton skeleton--panel"></span>
        </div>
        <span>Loading your PayLink account…</span>
      </div>
    } @else {
      <router-outlet />
    }
  `,
})
export class AccountLayoutComponent {
  readonly store = inject(PayLinkStoreService);
}
