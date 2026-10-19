import { AsyncPipe, NgIf } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { distinctUntilChanged, filter, map, shareReplay, startWith, take } from 'rxjs';
import { PayLinkApiService } from './core/paylink-api.service';
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
  private readonly api = inject(PayLinkApiService);
  private readonly router = inject(Router);
  private readonly url$ = this.router.events.pipe(
    filter((event): event is NavigationEnd => event instanceof NavigationEnd),
    map((event) => event.urlAfterRedirects),
    startWith(this.router.url),
    distinctUntilChanged(),
    shareReplay({ bufferSize: 1, refCount: true }),
  );
  readonly focused$ = this.url$.pipe(map((url) => !url.startsWith('/account') && !url.startsWith('/auth')));
  readonly authPage$ = this.url$.pipe(map((url) => url.startsWith('/auth')));
  readonly unreadCount$ = this.store.notifications$.pipe(map((items) => items.filter((item) => item.unread).length));
  signingOut = false;

  ngOnInit(): void { this.store.initialize(); }

  signOut(): void {
    if (this.signingOut) return;
    this.signingOut = true;
    this.api.logout().pipe(take(1)).subscribe((result) => {
      this.store.clearAccount();
      this.store.record(result);
      this.signingOut = false;
      void this.router.navigateByUrl('/auth');
    });
  }
}
