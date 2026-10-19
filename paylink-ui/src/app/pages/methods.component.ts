import { AsyncPipe, NgFor, NgIf } from '@angular/common';
import { Component, DestroyRef, inject } from '@angular/core';
import { take } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { PayLinkStoreService } from '../core/paylink-store.service';
import { IconComponent, EmptyStateComponent } from '../shared/ui.components';

@Component({ selector: 'pl-methods', standalone: true, imports: [AsyncPipe, IconComponent, EmptyStateComponent], templateUrl: './methods.component.html' })
export class MethodsComponent {
  readonly store = inject(PayLinkStoreService);
  private readonly destroyRef = inject(DestroyRef);
  notice = '';
  noticeIsError = false;
  selectedId = '';
  selectedLabel = '';
  busy = false;

  remove(id: string, dialog: HTMLDialogElement): void {
    if (this.busy) return;
    this.busy = true;
    this.store.removeMethod(id).pipe(take(1), takeUntilDestroyed(this.destroyRef)).subscribe((result) => {
      this.busy = false;
      dialog.close();
      this.store.record(result);
      this.noticeIsError = !result.ok;
      if (result.ok) {
        this.store.methods$.pipe(take(1)).subscribe((methods) => this.store.setMethods(methods.filter((method) => method.id !== id)));
         this.notice = result.source === 'server' ? 'Payment method removed from the account.' : 'Payment method removed from this demo session.';
      } else this.notice = result.warning ?? 'The payment method could not be removed.';
    });
  }

  addMethod(): void { this.noticeIsError = false; this.notice = 'New methods are available when PayLink is connected to a gateway setup flow.'; }
}
