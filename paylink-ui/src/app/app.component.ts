import { AsyncPipe, NgIf } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter, map, startWith } from 'rxjs';
import { PayLinkStoreService } from './core/paylink-store.service';
import { IconComponent, LogoComponent, TestModeBadgeComponent } from './shared/ui.components';

@Component({
  selector: 'pl-root',
  standalone: true,
  imports: [AsyncPipe, NgIf, RouterLink, RouterLinkActive, RouterOutlet, IconComponent, LogoComponent, TestModeBadgeComponent],
  styleUrl: './app.component.scss',
  templateUrl: './app.component.html',
})
export class AppComponent implements OnInit {
  readonly store = inject(PayLinkStoreService);
  private readonly router = inject(Router);
  readonly focused$ = this.router.events.pipe(filter((event) => event instanceof NavigationEnd), startWith(null), map(() => !this.router.url.startsWith('/account')));
  readonly unreadCount$ = this.store.notifications$.pipe(map((items) => items.filter((item) => item.unread).length));

  ngOnInit(): void { this.store.initialize(); }
}
