import { provideHttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { PAYLINK_CONFIG } from '../core/config';
import { PayLinkStoreService } from '../core/paylink-store.service';
import { CheckoutComponent } from './checkout.component';
import { SupportComponent } from './support.component';
import { ProfileComponent } from './profile.component';
import { NotificationsComponent } from './notifications.component';

describe('Angular customer components', () => {
  beforeEach(() => {
    sessionStorage.clear();
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideRouter([]), { provide: PAYLINK_CONFIG, useValue: { apiBaseUrl: '', enableApi: false } }] });
    TestBed.inject(PayLinkStoreService).initialize();
  });

  it.each(['success', 'pending', 'failed'] as const)('shows a fixed labeled demo amount and the %s result', async (outcome) => {
    const fixture = TestBed.createComponent(CheckoutComponent);
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    expect(element.textContent).toContain('Fixed demo amount');
    expect(element.textContent).toContain('$189.00');
    fixture.componentInstance.form.controls.methodId.setValue('method_bank_9012');
    fixture.componentInstance.form.controls.outcome.setValue(outcome);
    fixture.componentInstance.pay();
    await fixture.whenStable();
    expect(element.textContent).toContain('No money moved');
    expect(fixture.componentInstance.result$.value?.status).toBe(outcome);
    if (outcome === 'pending') expect(element.textContent).not.toContain('Start another test');
    const activity = await firstValueFrom(TestBed.inject(PayLinkStoreService).activity$);
    expect(activity[0].status).toBe(outcome);
    expect(sessionStorage.getItem('paylink-test-checkout-attempt')).not.toContain('token');
  });

  it('validates the support form, then adds a ticket with a visible reference', async () => {
    const fixture = TestBed.createComponent(SupportComponent);
    fixture.componentInstance.submit();
    await fixture.whenStable();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Enter a topic');
    expect((await firstValueFrom(TestBed.inject(PayLinkStoreService).tickets$)).length).toBe(2);
    fixture.componentInstance.form.setValue({ subject: 'Receipt question', category: 'Receipts', message: 'Please check my test payment receipt.', reference: 'PL-1048-NS' });
    fixture.componentInstance.submit();
    await fixture.whenStable();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Local demo ticket created: PL-DEMO-');
    expect((await firstValueFrom(TestBed.inject(PayLinkStoreService).tickets$))[0].subject).toBe('Receipt question');
  });

  it('saves profile edits and restores saved values when editing is cancelled', async () => {
    const fixture = TestBed.createComponent(ProfileComponent);
    await fixture.whenStable();
    fixture.componentInstance.toggleEditing();
    fixture.componentInstance.form.controls.name.setValue('Jamie Updated');
    fixture.componentInstance.save();
    await fixture.whenStable();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Jamie Updated');
    fixture.componentInstance.toggleEditing();
    fixture.componentInstance.form.controls.name.setValue('Unsaved');
    fixture.componentInstance.cancel();
    expect(fixture.componentInstance.form.controls.name.value).toBe('Jamie Updated');
  });

  it('marks an inbox notification read without losing its content', async () => {
    const fixture = TestBed.createComponent(NotificationsComponent);
    await fixture.whenStable();
    fixture.componentInstance.markRead('note_receipt');
    await fixture.whenStable();
    const notification = (fixture.nativeElement as HTMLElement).querySelector('.notification-row');
    expect(notification?.classList.contains('is-unread')).toBe(false);
    expect(notification?.textContent).toContain('Your Northstar receipt is ready');
  });
});
