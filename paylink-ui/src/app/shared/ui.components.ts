import { Component, Input } from '@angular/core';
import { PaymentStatus } from '../core/models';

export type IconName = 'activity' | 'arrow' | 'bell' | 'card' | 'check' | 'chevron' | 'clock' | 'external' | 'help' | 'home' | 'lock' | 'logout' | 'mail' | 'plus' | 'shield' | 'spark' | 'support' | 'user' | 'wallet' | 'x';

const iconPaths: Record<IconName, string> = {
  logout: 'M10 5H5v14h5m5-4 4-3-4-3m4 3H9',
  activity: 'M3 12h4l2.1-7 4.3 14L16 12h5', arrow: 'M5 12h14m-6-6 6 6-6 6', bell: 'M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4', card: 'M3 6.5h18v11H3zM3 10.5h18M7 15h3', check: 'm5 12 4 4L19 6', chevron: 'm7 10 5 5 5-5', clock: 'M12 7v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z', external: 'M14 5h5v5m0-5-8 8M18 13v5a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5', help: 'M9.1 9a3 3 0 1 1 5.1 2.1c-1.3 1.1-2.2 1.5-2.2 3.4M12 18h.01M21 12a9 9 0 1 1-18 0Z', home: 'm3 10 9-7 9 7v10H3zM9 20v-6h6v6', lock: 'M6 10h12v10H6zM8 10V7a4 4 0 0 1 8 0v3', mail: 'M3 5h18v14H3zM3 6l9 7 9-7', plus: 'M12 5v14M5 12h14', shield: 'M12 3 20 6v5c0 5-3.4 8.5-8 10-4.6-1.5-8-5-8-10V6zM9 12l2 2 4-4', spark: 'm12 3 1.4 5.6L19 10l-5.6 1.4L12 17l-1.4-5.6L5 10l5.6-1.4z', support: 'M4 14v-2a8 8 0 0 1 16 0v2M4 14h3v5H5a1 1 0 0 1-1-1zM20 14h-3v5h2a1 1 0 0 0 1-1zM9 21h6', user: 'M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z', wallet: 'M4 6h16v13H4zM4 9h16M16 14h2', x: 'm6 6 12 12M18 6 6 18',
};

@Component({ selector: 'pl-icon', standalone: true, template: '<svg aria-hidden="true" class="icon" [attr.height]="size" [attr.width]="size" viewBox="0 0 24 24"><path [attr.d]="path" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" [attr.stroke-width]="strokeWidth" /></svg>' })
export class IconComponent {
  @Input({ required: true }) name!: IconName;
  @Input() size = 18;
  @Input() strokeWidth = 1.8;
  get path(): string { return iconPaths[this.name]; }
}

@Component({ selector: 'pl-logo', standalone: true, template: '<span class="logo-mark" aria-hidden="true"><span class="logo-mark-letter">P</span><span class="logo-mark-link"></span><span class="logo-mark-arrow"></span></span>' })
export class LogoComponent {}

@Component({ selector: 'pl-status-badge', standalone: true, template: '<span class="status-badge" [class.status-badge--success]="status === \'success\'" [class.status-badge--pending]="status === \'pending\'" [class.status-badge--failed]="status === \'failed\'" [class.status-badge--refunded]="status === \'refunded\'">{{ label }}</span>' })
export class StatusBadgeComponent {
  @Input({ required: true }) status!: PaymentStatus;
  get label(): string { return { success: 'Completed', pending: 'Pending', failed: 'Declined', refunded: 'Refunded' }[this.status]; }
}

@Component({ selector: 'pl-empty-state', standalone: true, imports: [IconComponent], template: '<div class="empty-state"><span class="empty-state-icon"><pl-icon [name]="icon" [size]="20" /></span><h3>{{ title }}</h3><p>{{ body }}</p><ng-content /></div>' })
export class EmptyStateComponent {
  @Input({ required: true }) icon!: IconName;
  @Input({ required: true }) title!: string;
  @Input({ required: true }) body!: string;
}
