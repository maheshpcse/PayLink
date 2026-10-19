import { provideHttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { AppComponent } from './app.component';
import { routes } from './app.routes';
import { PAYLINK_CONFIG } from './core/config';

describe('PayLink application shell', () => {
  it('exposes help/legal links, a skip link and the test-environment label', async () => {
    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [provideHttpClient(), provideRouter(routes), { provide: PAYLINK_CONFIG, useValue: { apiBaseUrl: '', enableApi: false } }],
    }).compileComponents();
    const fixture = TestBed.createComponent(AppComponent);
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('a[href="#main-content"]')?.textContent).toContain('Skip');
    expect(element.querySelector('footer a[href="/terms"]')).not.toBeNull();
    expect(element.querySelector('footer a[href="/privacy"]')).not.toBeNull();
    expect(element.textContent).toContain('test environment');
    expect(element.textContent).toContain('PayLink');
    expect(element.querySelector('.sidebar-note')).toBeNull();
  });

  it('uses the root route for checkout and keeps the old checkout URL as a redirect', () => {
    expect(routes.find((route) => route.path === '')?.loadComponent).toBeTypeOf('function');
    expect(routes.find((route) => route.path === 'checkout')?.redirectTo).toBe('');
  });

  it('removes the app navigation and footer on the auth route', async () => {
    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [provideHttpClient(), provideRouter(routes), { provide: PAYLINK_CONFIG, useValue: { apiBaseUrl: '', enableApi: false } }],
    }).compileComponents();
    const fixture = TestBed.createComponent(AppComponent);
    const router = TestBed.inject(Router);
    await router.navigateByUrl('/auth');
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('header')).toBeNull();
    expect(fixture.nativeElement.querySelector('footer')).toBeNull();
    expect(fixture.nativeElement.querySelector('.auth-page')).not.toBeNull();
  });
});
