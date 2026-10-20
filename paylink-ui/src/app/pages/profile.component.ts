import { AsyncPipe, NgIf } from '@angular/common';
import { Component, DestroyRef, inject } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { take } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { PayLinkStoreService } from '../core/paylink-store.service';
import { IconComponent } from '../shared/ui.components';

@Component({ selector: 'pl-profile', standalone: true, imports: [AsyncPipe, ReactiveFormsModule, RouterLink, IconComponent], templateUrl: './profile.component.html' })
export class ProfileComponent {
  readonly store = inject(PayLinkStoreService);
  private readonly destroyRef = inject(DestroyRef);
  readonly form = new FormGroup({ name: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(80)] }), username: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.pattern(/^[a-zA-Z0-9._-]{3,40}$/)] }), email: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.email] }), phone: new FormControl('', { nonNullable: true }), avatarUrl: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(500)] }), twoFactorEnabled: new FormControl(true, { nonNullable: true }) });
  editing = false;
  notice = '';
  noticeIsError = false;
  busy = false;

  constructor() { this.store.profile$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((profile) => { if (profile && !this.editing) { this.form.patchValue(profile); this.form.markAsPristine(); this.form.markAsUntouched(); } }); }
  toggleEditing(): void { this.notice = ''; this.editing = true; this.form.markAsPristine(); this.form.markAsUntouched(); }
  cancel(): void { this.editing = false; this.notice = ''; this.store.profile$.pipe(take(1)).subscribe((profile) => { if (profile) { this.form.patchValue(profile); this.form.markAsPristine(); this.form.markAsUntouched(); } }); }
  save(): void {
    if (this.form.invalid || this.busy) { this.form.markAllAsTouched(); return; }
    this.busy = true;
    this.store.saveProfile(this.form.getRawValue()).pipe(take(1), takeUntilDestroyed(this.destroyRef)).subscribe((result) => { this.busy = false; this.store.record(result); this.noticeIsError = !result.ok; this.notice = result.ok ? `Profile changes saved${result.source === 'demo' ? ' locally in this demo session' : ' by the server'}.` : result.warning ?? 'Profile changes could not be saved.'; if (result.ok) { this.editing = false; this.form.markAsPristine(); this.form.markAsUntouched(); this.store.setProfile(result.data); } });
  }
}
