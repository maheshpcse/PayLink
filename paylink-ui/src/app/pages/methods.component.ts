import { AsyncPipe, NgFor, NgIf } from '@angular/common';
import { Component, DestroyRef, inject } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { take } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { PayLinkStoreService } from '../core/paylink-store.service';
import { IconComponent, EmptyStateComponent } from '../shared/ui.components';

@Component({ selector: 'pl-methods', standalone: true, imports: [AsyncPipe, ReactiveFormsModule, RouterLink, IconComponent, EmptyStateComponent], templateUrl: './methods.component.html' })
export class MethodsComponent {
  readonly store = inject(PayLinkStoreService);
  private readonly destroyRef = inject(DestroyRef);
  notice = '';
  noticeIsError = false;
  selectedId = '';
  selectedLabel = '';
  busy = false;
  readonly addForm = new FormGroup({ kind: new FormControl<'card' | 'bank'>('card', { nonNullable: true }), label: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(80)] }), detail: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(80)] }), last4: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.pattern(/^\d{4}$/)] }) });

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

  addMethod(dialog: HTMLDialogElement): void { this.notice = ''; this.addForm.reset({ kind: 'card', label: '', detail: '', last4: '' }); dialog.showModal(); }

  saveMethod(dialog: HTMLDialogElement): void {
    if (this.addForm.invalid) { this.addForm.markAllAsTouched(); return; }
    const value = this.addForm.getRawValue();
    this.store.methods$.pipe(take(1)).subscribe((methods) => this.store.setMethods([{ id: `method_local_${Date.now()}`, kind: value.kind, label: value.label, detail: value.detail, isDefault: methods.length === 0, brandColor: value.kind === 'card' ? '#0066b3' : '#1f6b4d', paymentMethod: { type: value.kind === 'card' ? 'card' : 'bank_transfer', brand: value.kind === 'card' ? 'card' : 'checking', last4: value.last4 } }, ...methods]));
    this.noticeIsError = false;
    this.notice = 'Payment method added to this demo account.';
    dialog.close();
    this.addForm.markAsPristine();
    this.addForm.markAsUntouched();
  }
}
