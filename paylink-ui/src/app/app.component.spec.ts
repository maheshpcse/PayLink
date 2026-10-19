import { provideHttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
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
  });
});
