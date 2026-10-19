import { Component, DestroyRef, inject } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { take } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { PayLinkApiService } from '../core/paylink-api.service';
import { IconComponent } from '../shared/ui.components';

@Component({
  selector: 'pl-change-password',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, IconComponent],
  template: `
    <div class="page-stack account-page password-page">
      <section class="panel data-panel password-panel">
        <h1 class="sr-only">Change password</h1>
        <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
          <label>Current password<input formControlName="currentPassword" autocomplete="current-password" type="password" [attr.aria-invalid]="form.controls.currentPassword.invalid && form.controls.currentPassword.touched" />@if (form.controls.currentPassword.invalid && form.controls.currentPassword.touched) { <span class="field-error">Enter your current password.</span> }</label>
          <label>New password<input formControlName="newPassword" autocomplete="new-password" type="password" [attr.aria-invalid]="form.controls.newPassword.invalid && form.controls.newPassword.touched" />@if (form.controls.newPassword.invalid && form.controls.newPassword.touched) { <span class="field-error">Use at least 8 characters.</span> }</label>
          <label>Confirm new password<input formControlName="confirmPassword" autocomplete="new-password" type="password" [attr.aria-invalid]="form.hasError('passwordMismatch') && form.controls.confirmPassword.touched" />@if (form.hasError('passwordMismatch') && form.controls.confirmPassword.touched) { <span class="field-error">Passwords must match.</span> }</label>
          <div class="form-actions"><button class="primary-button" type="submit" [disabled]="busy">{{ busy ? 'Updating…' : 'Change password' }}</button><a class="text-button" routerLink="/account/profile">Cancel</a></div>
        </form>
        @if (message) { <p class="inline-notice" [class.inline-notice--error]="messageIsError" role="status"><pl-icon [name]="messageIsError ? 'x' : 'check'" [size]="15" /> {{ message }}</p> }
      </section>
    </div>
  `,
})
export class ChangePasswordComponent {
  private readonly api = inject(PayLinkApiService);
  private readonly destroyRef = inject(DestroyRef);
  readonly form = new FormGroup({
    currentPassword: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    newPassword: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.minLength(8)] }),
    confirmPassword: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
  });
  busy = false;
  message = '';
  messageIsError = false;

  constructor() {
    this.form.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.form.setErrors(this.form.controls.newPassword.value && this.form.controls.confirmPassword.value && this.form.controls.newPassword.value !== this.form.controls.confirmPassword.value ? { passwordMismatch: true } : null);
    });
  }

  submit(): void {
    if (this.form.invalid || this.busy) { this.form.markAllAsTouched(); return; }
    this.busy = true;
    const { currentPassword, newPassword } = this.form.getRawValue();
    this.api.changePassword(currentPassword, newPassword).pipe(take(1), takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (result) => {
        this.busy = false;
        this.messageIsError = !result.ok;
        this.message = result.ok ? 'Password updated.' : result.warning ?? 'Password could not be updated.';
        if (result.ok) { this.form.reset(); this.form.markAsPristine(); this.form.markAsUntouched(); }
      },
      error: (error: Error) => { this.busy = false; this.messageIsError = true; this.message = error.message; },
    });
  }
}
