import { Component } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'pl-preferences', standalone: true, imports: [ReactiveFormsModule, RouterLink],
  template: `
    <div class="page-stack">
      <div><p class="eyebrow">Local preview settings</p><h1>Your preferences.</h1><p class="page-heading-body">These switches preview consent only for this page session. The server has no preferences or delivery-provider endpoint.</p></div>
        <form class="panel data-panel" [formGroup]="form" (ngSubmit)="save()">
        <label class="checkbox-row"><input type="checkbox" formControlName="reminders" />Optional checkout reminders (preview only)</label>
        <label class="checkbox-row"><input type="checkbox" formControlName="updates" />Product updates (preview only)</label>
        <p>Essential test events appear in your in-app inbox. No email, SMS, browser push, marketing, or non-essential cookies are enabled by this UI.</p>
        <button type="submit" class="primary-button">Apply preview choices</button>
        @if (saved) { <p role="status">Preview choices applied locally. No subscription or delivery was requested.</p> }
      </form>
      <a class="text-button" routerLink="/privacy">Read the privacy notice</a>
    </div>
  `,
})
export class PreferencesComponent {
  readonly form = new FormGroup({ reminders: new FormControl(false, { nonNullable: true }), updates: new FormControl(false, { nonNullable: true }) });
  saved = false;
  save(): void { this.saved = true; this.form.markAsPristine(); this.form.markAsUntouched(); }
}
