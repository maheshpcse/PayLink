import { NgIf } from '@angular/common';
import { Component, DestroyRef, inject } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { take } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { PayLinkApiService } from '../core/paylink-api.service';
import { PayLinkStoreService } from '../core/paylink-store.service';
import { IconComponent, LogoComponent } from '../shared/ui.components';

@Component({ selector: 'pl-auth', standalone: true, imports: [NgIf, ReactiveFormsModule, RouterLink, IconComponent, LogoComponent], templateUrl: './auth.component.html' })
export class AuthComponent {
  private readonly api = inject(PayLinkApiService);
  private readonly store = inject(PayLinkStoreService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  readonly form = new FormGroup({ email: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.email] }), password: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.minLength(8)] }) });
  busy = false;
  message = '';
  messageIsError = false;

  submit(): void {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.busy = true;
    this.api.login(this.form.controls.email.value, this.form.controls.password.value).pipe(take(1), takeUntilDestroyed(this.destroyRef)).subscribe((result) => this.finish(result));
  }

  useDemo(): void { this.busy = true; this.api.loginDemoCustomer().pipe(take(1), takeUntilDestroyed(this.destroyRef)).subscribe((result) => this.finish(result)); }

  private finish(result: { ok: boolean; warning?: string }): void {
    this.busy = false;
    this.messageIsError = !result.ok;
    this.message = result.warning ?? (result.ok ? 'Signed in securely.' : 'The configured server was unavailable; local demo mode is active.');
    if (!result.ok) this.store.clearAccount();
    const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl');
    if (result.ok) this.store.reload().pipe(take(1), takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => { void this.router.navigateByUrl(returnUrl?.startsWith('/account/') ? returnUrl : '/account/overview'); },
      error: (error: Error) => { this.message = error.message; this.messageIsError = true; },
    });
  }
}
