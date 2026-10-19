import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, catchError, finalize, forkJoin, map, Observable, of, switchMap, take, tap, throwError } from 'rxjs';
import { PayLinkApiError, PayLinkApiService } from './paylink-api.service';
import { ApiResult, CheckoutSession, NotificationItem, PaymentActivity, PaymentResult, Profile, ProfileUpdate, SavedMethod, SupportTicket, SupportTicketRequest, TestOutcome } from './models';

@Injectable({ providedIn: 'root' })
export class PayLinkStoreService {
  private readonly api = inject(PayLinkApiService);
  private initialized = false;
  private readonly loadingSubject = new BehaviorSubject(true);
  private readonly sessionSubject = new BehaviorSubject<CheckoutSession | null>(null);
  private readonly methodsSubject = new BehaviorSubject<SavedMethod[]>([]);
  private readonly activitySubject = new BehaviorSubject<PaymentActivity[]>([]);
  private readonly notificationsSubject = new BehaviorSubject<NotificationItem[]>([]);
  private readonly profileSubject = new BehaviorSubject<Profile | null>(null);
  private readonly ticketsSubject = new BehaviorSubject<SupportTicket[]>([]);
  private readonly sourceSubject = new BehaviorSubject<'server' | 'demo'>('demo');
  private readonly configuredSubject = new BehaviorSubject(false);
  private readonly warningSubject = new BehaviorSubject('');

  readonly loading$ = this.loadingSubject.asObservable();
  readonly session$ = this.sessionSubject.asObservable();
  readonly methods$ = this.methodsSubject.asObservable();
  readonly activity$ = this.activitySubject.asObservable();
  readonly notifications$ = this.notificationsSubject.asObservable();
  readonly profile$ = this.profileSubject.asObservable();
  readonly tickets$ = this.ticketsSubject.asObservable();
  readonly source$ = this.sourceSubject.asObservable();
  readonly configured$ = this.configuredSubject.asObservable();
  readonly warning$ = this.warningSubject.asObservable();
  get source(): 'server' | 'demo' { return this.sourceSubject.value; }

  initialize(): void {
    if (this.initialized) return;
    this.initialized = true;
    this.api.loginDemoCustomer().pipe(
      switchMap(() => this.reload()),
      catchError((error: PayLinkApiError) => {
        if (error.status === 401 || error.status === 403) return throwError(() => error);
        this.api.useLocalDemo(`API unavailable: ${error.message}. Local demo data only; no server actions.`);
        return this.reload();
      }),
      take(1),
    ).subscribe({ error: (error: Error) => { this.showWarning(error.message); this.loadingSubject.next(false); } });
  }

  reload(): Observable<void> {
    this.loadingSubject.next(true);
    return forkJoin({
      session: this.api.getCheckoutSession(), methods: this.api.getSavedMethods(),
      activity: this.api.getActivity(), notifications: this.api.getNotifications(),
      profile: this.api.getProfile(), tickets: this.api.getSupportTickets(),
    }).pipe(tap((results) => {
      this.sessionSubject.next(results.session.data);
      this.methodsSubject.next(results.methods.data);
      this.activitySubject.next(results.activity.data);
      this.notificationsSubject.next(results.notifications.data);
      this.profileSubject.next(results.profile.data);
      this.ticketsSubject.next(results.tickets.data);
      this.warningSubject.next('');
      Object.values(results).forEach((result) => this.record<unknown>(result));
      this.loadingSubject.next(false);
    }), map(() => undefined), finalize(() => this.loadingSubject.next(false)));
  }

  clearAccount(): void {
    this.profileSubject.next(null);
    this.methodsSubject.next([]);
    this.activitySubject.next([]);
    this.notificationsSubject.next([]);
    this.ticketsSubject.next([]);
  }

  createPayment(checkoutId: string, methodId: string, outcome: TestOutcome, key: string): Observable<ApiResult<PaymentResult>> {
    return this.api.createPayment(checkoutId, methodId, outcome, key).pipe(
      tap((result) => this.record(result)),
      switchMap((result) => result.ok ? this.refreshActivity().pipe(map(() => result)) : of(result)),
    );
  }

  getPaymentResult(id: string): Observable<ApiResult<PaymentResult>> { return this.api.getPaymentResult(id); }

  refreshActivity(): Observable<void> {
    return forkJoin({ activity: this.api.getActivity(), notifications: this.api.getNotifications() }).pipe(
      tap(({ activity, notifications }) => { this.activitySubject.next(activity.data); this.notificationsSubject.next(notifications.data); }),
      map(() => undefined),
      // A history refresh failure must never change the authoritative payment result.
      catchError((error: Error) => { this.showWarning(`Activity could not refresh: ${error.message}`); return of(undefined); }),
    );
  }

  markNotificationRead(id: string): Observable<ApiResult<NotificationItem>> { return this.api.markNotificationRead(id); }
  markAllNotificationsRead(): Observable<ApiResult<boolean>> { return this.api.markAllNotificationsRead(); }
  removeMethod(id: string): Observable<ApiResult<boolean>> { return this.api.removeSavedMethod(id); }
  saveProfile(profile: ProfileUpdate): Observable<ApiResult<Profile>> { return this.api.saveProfile(profile); }
  createSupportTicket(request: SupportTicketRequest): Observable<ApiResult<SupportTicket>> { return this.api.createSupportTicket(request); }

  setMethods(methods: SavedMethod[]): void { this.methodsSubject.next(methods); }
  setActivity(activity: PaymentActivity[]): void { this.activitySubject.next(activity); }
  setNotifications(notifications: NotificationItem[]): void { this.notificationsSubject.next(notifications); }
  setProfile(profile: Profile): void { this.profileSubject.next(profile); }
  setTickets(tickets: SupportTicket[]): void { this.ticketsSubject.next(tickets); }
  showWarning(message: string): void { this.warningSubject.next(message); }

  record<T>(result: ApiResult<T>): void {
    this.sourceSubject.next(result.source);
    this.configuredSubject.next(result.serverConfigured);
    if (result.warning) this.warningSubject.next(result.warning);
  }
}
