import { NgIf } from '@angular/common';
import { Component } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { IconComponent, LogoComponent } from '../shared/ui.components';

@Component({
  selector: 'pl-forgot-password',
  standalone: true,
  imports: [NgIf, ReactiveFormsModule, RouterLink, IconComponent, LogoComponent],
  template: `
    <div class="auth-page">
      <div class="auth-card panel">
        <a class="brand auth-brand" routerLink="/auth" aria-label="PayLink home"><pl-logo /><span class="brand-word">PayLink</span></a>
        <h1 class="sr-only">Forgot password</h1>
        <form [formGroup]="form" (ngSubmit)="submit()" novalidate *ngIf="!submitted">
          <label>Email address<input formControlName="email" autocomplete="email" type="email" placeholder="you@example.com" [attr.aria-invalid]="form.invalid && form.touched" />@if (form.invalid && form.touched) { <span class="field-error">Enter a valid email address.</span> }</label>
          <button class="primary-button primary-button--wide" type="submit">Send reset instructions <pl-icon name="arrow" [size]="17" /></button>
        </form>
        <div class="auth-result" *ngIf="submitted" role="status"><pl-icon name="mail" [size]="22" /><p>If an account exists for {{ form.controls.email.value }}, reset instructions can be sent.</p><small>Email delivery is not configured in this workspace.</small></div>
        <p class="auth-switch"><a routerLink="/auth">Back to sign in</a></p>
      </div>
    </div>
  `,
})
export class ForgotPasswordComponent {
  readonly form = new FormGroup({ email: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.email] }) });
  submitted = false;
  submit(): void { if (this.form.invalid) { this.form.markAllAsTouched(); return; } this.submitted = true; }
}
