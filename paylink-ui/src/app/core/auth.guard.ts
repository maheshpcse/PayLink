import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { AuthService } from './auth.service';
import { PayLinkStoreService } from './paylink-store.service';
import { filter, map, take } from 'rxjs';

export const accountGuard: CanActivateFn = (_, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const store = inject(PayLinkStoreService);
  store.initialize();
  return store.loading$.pipe(filter((loading) => !loading), take(1), map(() => auth.isAuthenticated ? true : router.createUrlTree(['/auth'], { queryParams: { returnUrl: state.url } })));
};

export const guestGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  return auth.isAuthenticated ? router.createUrlTree(['/account/overview']) : true;
};
