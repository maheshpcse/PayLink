import { Component } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { IconComponent } from '../shared/ui.components';

@Component({
  selector: 'pl-preferences', standalone: true, imports: [ReactiveFormsModule, RouterLink, IconComponent],
  template: `
    <div class="page-stack">
        <form class="panel data-panel preferences-panel" [formGroup]="form" (ngSubmit)="save()">
        <label class="checkbox-row"><input type="checkbox" formControlName="reminders" />Optional checkout reminders (preview only)</label>
        <label class="checkbox-row"><input type="checkbox" formControlName="updates" />Product updates (preview only)</label>
        <div class="info-callout preferences-info"><pl-icon name="bell" /><p>Essential payment events appear in your in-app inbox. No email, SMS, browser push, marketing, or non-essential cookies are enabled by this UI.</p></div>
        <button type="submit" class="primary-button">Apply preview choices</button>
        @if (saved) { <p role="status">Preview choices applied locally. No subscription or delivery was requested.</p> }
      </form>
      <a class="text-button" routerLink="/legal">Read the privacy notice</a>
    </div>
  `,
})
export class PreferencesComponent {
  readonly form = new FormGroup({ reminders: new FormControl(false, { nonNullable: true }), updates: new FormControl(false, { nonNullable: true }) });
  saved = false;
  constructor() { this.form.valueChanges.subscribe(() => { this.saved = false; }); }
  save(): void { this.saved = true; this.form.markAsPristine(); this.form.markAsUntouched(); }
}
