import { NgIf } from '@angular/common';
import { Component, DestroyRef, inject } from '@angular/core';
import { AbstractControl, FormControl, FormGroup, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { take } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { PayLinkApiService } from '../core/paylink-api.service';
import { PayLinkStoreService } from '../core/paylink-store.service';
import { IconComponent, LogoComponent } from '../shared/ui.components';

function matchingPasswords(control: AbstractControl): ValidationErrors | null {
  const password = control.get('password')?.value;
  const confirmPassword = control.get('confirmPassword')?.value;
  return password && confirmPassword && password !== confirmPassword ? { passwordMismatch: true } : null;
}

@Component({
  selector: 'pl-sign-up',
  standalone: true,
  imports: [NgIf, ReactiveFormsModule, RouterLink, IconComponent, LogoComponent],
  template: `
    <div class="auth-page">
      <div class="auth-card panel">
        <a class="brand auth-brand" routerLink="/auth" aria-label="PayLink home"><pl-logo /><span class="brand-word">PayLink</span></a>
        <h1 class="sr-only">Create an account</h1>
        <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
          <label>Full name<input formControlName="name" autocomplete="name" placeholder="Your name" [attr.aria-invalid]="form.controls.name.invalid && form.controls.name.touched" />@if (form.controls.name.invalid && form.controls.name.touched) { <span class="field-error">Enter your name.</span> }</label>
          <label>Email address<input formControlName="email" autocomplete="email" type="email" placeholder="you@example.com" [attr.aria-invalid]="form.controls.email.invalid && form.controls.email.touched" />@if (form.controls.email.invalid && form.controls.email.touched) { <span class="field-error">Enter a valid email address.</span> }</label>
          <label>Password<input formControlName="password" autocomplete="new-password" type="password" placeholder="At least 8 characters" [attr.aria-invalid]="form.controls.password.invalid && form.controls.password.touched" />@if (form.controls.password.invalid && form.controls.password.touched) { <span class="field-error">Use at least 8 characters.</span> }</label>
          <label>Confirm password<input formControlName="confirmPassword" autocomplete="new-password" type="password" placeholder="Repeat your password" [attr.aria-invalid]="form.hasError('passwordMismatch') && form.controls.confirmPassword.touched" />@if (form.hasError('passwordMismatch') && form.controls.confirmPassword.touched) { <span class="field-error">Passwords must match.</span> }</label>
          <button class="primary-button primary-button--wide" type="submit" [disabled]="busy"><span>{{ busy ? 'Creating…' : 'Create account' }}</span><pl-icon name="arrow" [size]="17" /></button>
        </form>
        <p class="auth-switch">Already have an account? <a routerLink="/auth">Sign in</a></p>
        <p class="inline-notice inline-notice--error" *ngIf="message" role="alert"><pl-icon name="x" [size]="15" /> {{ message }}</p>
      </div>
    </div>
  `,
})
export class SignUpComponent {
  private readonly api = inject(PayLinkApiService);
  private readonly store = inject(PayLinkStoreService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  readonly form = new FormGroup({
    name: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(100)] }),
    email: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.email] }),
    password: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.minLength(8)] }),
    confirmPassword: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
  }, { validators: matchingPasswords });
  busy = false;
  message = '';

  submit(): void {
    if (this.form.invalid || this.busy) { this.form.markAllAsTouched(); return; }
    this.busy = true;
    const { name, email, password } = this.form.getRawValue();
    this.api.register(name, email, password).pipe(take(1), takeUntilDestroyed(this.destroyRef)).subscribe((result) => {
      if (!result.ok) { this.busy = false; this.message = result.warning ?? 'The account could not be created.'; return; }
      this.store.reload().pipe(take(1), takeUntilDestroyed(this.destroyRef)).subscribe({
        next: () => void this.router.navigateByUrl('/account/overview'),
        error: (error: Error) => { this.busy = false; this.message = error.message; },
      });
    });
  }
}
