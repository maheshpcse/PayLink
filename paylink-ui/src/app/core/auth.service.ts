import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { AuthSession } from './models';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly sessionSubject = new BehaviorSubject<AuthSession | null>(null);
  readonly session$ = this.sessionSubject.asObservable();

  get token(): string | undefined {
    const session = this.sessionSubject.value;
    return session && Date.parse(session.expiresAt) > Date.now() ? session.token : undefined;
  }

  get userId(): string | undefined { return this.sessionSubject.value?.user.id; }

  get isAuthenticated(): boolean {
    return Boolean(this.token);
  }

  setSession(session: AuthSession): void {
    this.sessionSubject.next(session);
  }

  clear(): void {
    this.sessionSubject.next(null);
  }
}
