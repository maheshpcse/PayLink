import { NgFor, NgIf } from '@angular/common';
import { Component, Input } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { SavedMethod } from '../core/models';
import { IconComponent } from './ui.components';

@Component({
  selector: 'pl-method-selector',
  standalone: true,
  imports: [NgFor, NgIf, ReactiveFormsModule, IconComponent],
  template: `
    <fieldset class="method-list native-fieldset" [disabled]="locked">
      <legend class="sr-only">Saved payment methods</legend>
      <label class="payment-method-option" *ngFor="let method of methods" [class.is-selected]="control.value === method.id">
        <input type="radio" [formControl]="control" [value]="method.id" name="saved-method" />
        <span class="method-brand" [class.bank-brand]="method.kind === 'bank'"><pl-icon [name]="method.kind === 'card' ? 'card' : 'wallet'" /></span>
        <span class="method-copy"><strong>{{ method.label }}</strong><small>{{ method.detail }}{{ method.expiry ? ' · ' + method.expiry : '' }}</small></span>
        <span class="default-tag" *ngIf="method.isDefault">Default</span>
      </label>
      <p *ngIf="methods.length === 0">No eligible saved methods. A gateway setup flow is not configured.</p>
    </fieldset>
  `,
})
export class MethodSelectorComponent {
  @Input({ required: true }) methods: SavedMethod[] = [];
  @Input({ required: true }) control!: FormControl<string>;
  @Input() locked = false;
}
