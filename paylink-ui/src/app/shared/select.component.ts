import { NgFor, NgIf } from '@angular/common';
import { ElementRef, HostListener, Component, Input, inject } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { IconComponent } from './ui.components';

export interface SelectOption {
  value: string;
  label: string;
}

@Component({
  selector: 'pl-select',
  standalone: true,
  imports: [NgFor, NgIf, ReactiveFormsModule, IconComponent],
  template: `
    <div class="themed-select" [class.is-open]="open">
      <button class="select-trigger" type="button" role="combobox" [attr.aria-expanded]="open" [attr.aria-controls]="menuId" [attr.aria-invalid]="control.invalid && control.touched" (click)="toggle()" (keydown)="onKeydown($event)">
        <span>{{ selectedLabel }}</span><pl-icon name="chevron" [size]="16" />
      </button>
      <div class="select-menu" *ngIf="open" [id]="menuId" role="listbox">
        <button class="select-option" *ngFor="let option of options" type="button" role="option" [attr.aria-selected]="control.value === option.value" [class.is-selected]="control.value === option.value" (click)="choose(option)">{{ option.label }}</button>
      </div>
    </div>
  `,
})
export class SelectComponent {
  private static nextId = 0;
  private readonly host = inject(ElementRef<HTMLElement>);
  @Input({ required: true }) control!: FormControl<string>;
  @Input({ required: true }) options: SelectOption[] = [];
  open = false;
  readonly menuId = `paylink-select-${SelectComponent.nextId++}`;

  get selectedLabel(): string {
    return this.options.find((option) => option.value === this.control?.value)?.label ?? this.options[0]?.label ?? 'Choose an option';
  }

  toggle(): void { this.open = !this.open; }

  choose(option: SelectOption): void {
    this.control.setValue(option.value);
    this.control.markAsDirty();
    this.control.markAsTouched();
    this.open = false;
  }

  onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') { this.open = false; return; }
    if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); this.toggle(); return; }
    if (event.key === 'ArrowDown') { event.preventDefault(); this.open = true; }
  }

  @HostListener('document:click', ['$event'])
  closeWhenOutside(event: MouseEvent): void {
    if (!this.host.nativeElement.contains(event.target as Node)) this.open = false;
  }
}
