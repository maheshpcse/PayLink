import { Component, inject } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { IconComponent, LogoComponent } from '../shared/ui.components';

@Component({
  selector: 'pl-otp-login',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, IconComponent, LogoComponent],
  template: `
    <div class="auth-page"><div class="auth-card panel">
      <a class="brand auth-brand" routerLink="/auth" aria-label="PayLink home"><pl-logo /><span class="brand-word">PayLink</span></a>
      <h1 class="sr-only">{{ channelLabel }} OTP sign in</h1>
      @if (!requested) {
        <form [formGroup]="form" (ngSubmit)="requestCode()" novalidate><label>{{ channelLabel }} address<input [type]="channel === 'email' ? 'email' : 'tel'" [formControl]="identifier" [placeholder]="channel === 'email' ? 'you@example.com' : '+1 555 014 2084'" /></label><button class="primary-button primary-button--wide" type="submit">Send code <pl-icon name="arrow" /></button></form>
      } @else {
        <form [formGroup]="codeForm" (ngSubmit)="verify()" novalidate><label>One-time code<input formControlName="code" inputmode="numeric" maxlength="6" placeholder="000000" /></label><button class="primary-button primary-button--wide" type="submit">Verify code <pl-icon name="check" /></button></form>
        <p class="inline-notice" role="status">{{ message }}</p>
      }
      <p class="auth-switch"><a routerLink="/auth">Back to sign in</a></p>
    </div></div>
  `,
})
export class OtpLoginComponent {
  private readonly route = inject(ActivatedRoute);
  readonly channel = (this.route.snapshot.data['channel'] as 'email' | 'phone') ?? 'email';
  readonly channelLabel = this.channel === 'email' ? 'Email' : 'Phone';
  readonly identifier = new FormControl('', { nonNullable: true, validators: [Validators.required] });
  readonly form = new FormGroup({ identifier: this.identifier });
  readonly codeForm = new FormGroup({ code: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.pattern(/^\d{6}$/)] }) });
  requested = false;
  message = '';

  requestCode(): void { if (this.identifier.invalid) { this.identifier.markAsTouched(); return; } this.requested = true; this.message = `A ${this.channelLabel.toLowerCase()} code would be sent to ${this.identifier.value}. Delivery is not configured in this preview.`; }
  verify(): void { this.message = 'OTP delivery and verification require a configured identity provider.'; }
}
