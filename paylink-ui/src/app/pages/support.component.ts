import { AsyncPipe } from '@angular/common';
import { Component, DestroyRef, inject } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { take } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { PayLinkStoreService } from '../core/paylink-store.service';
import { IconComponent, EmptyStateComponent } from '../shared/ui.components';
import { SelectComponent, SelectOption } from '../shared/select.component';

@Component({ selector: 'pl-support', standalone: true, imports: [AsyncPipe, ReactiveFormsModule, RouterLink, IconComponent, EmptyStateComponent, SelectComponent], templateUrl: './support.component.html' })
export class SupportComponent {
  readonly store = inject(PayLinkStoreService);
  private readonly destroyRef = inject(DestroyRef);
  readonly form = new FormGroup({
    subject: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.minLength(3), Validators.maxLength(120), Validators.pattern(/\S/)] }),
    category: new FormControl('Payment status', { nonNullable: true, validators: [Validators.required] }),
    message: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.minLength(10), Validators.maxLength(2_000), Validators.pattern(/\S/)] }),
    reference: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(150)] }),
  });
  readonly categoryOptions: SelectOption[] = [
    { value: 'Payment status', label: 'Payment status' },
    { value: 'Receipts', label: 'Receipts' },
    { value: 'Account security', label: 'Account security' },
    { value: 'Something else', label: 'Something else' },
  ];
  notice = '';
  noticeIsError = false;
  busy = false;
  submit(): void {
    if (this.form.invalid || this.busy) { this.form.markAllAsTouched(); return; }
    this.busy = true;
    const value = this.form.getRawValue();
    const message = `${value.message.trim()}${value.reference.trim() ? '\nPayment reference: ' + value.reference.trim() : ''}`;
    this.store.createSupportTicket({ subject: value.subject.trim(), category: value.category, message }).pipe(take(1), takeUntilDestroyed(this.destroyRef)).subscribe((result) => {
      this.busy = false;
      this.store.record(result);
      this.noticeIsError = !result.ok;
      this.notice = result.ok ? `${result.source === 'demo' ? 'Local demo ticket' : 'Support ticket'} created: ${result.data.id}.` : result.warning ?? 'The ticket could not be created.';
       if (result.ok) { this.store.tickets$.pipe(take(1)).subscribe((tickets) => this.store.setTickets([result.data, ...tickets])); this.form.reset({ subject: '', category: 'Payment status', message: '', reference: '' }); this.form.markAsPristine(); this.form.markAsUntouched(); }
    });
  }
}
