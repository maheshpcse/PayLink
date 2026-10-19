import { Routes } from '@angular/router';
import { accountGuard } from './core/auth.guard';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'checkout' },
  { path: 'checkout', loadComponent: () => import('./pages/checkout.component').then((page) => page.CheckoutComponent) },
  { path: 'auth', loadComponent: () => import('./pages/auth.component').then((page) => page.AuthComponent) },
  {
    path: 'account',
    canActivate: [accountGuard],
    loadComponent: () => import('./pages/account-layout.component').then((page) => page.AccountLayoutComponent),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'overview' },
      { path: 'overview', loadComponent: () => import('./pages/overview.component').then((page) => page.OverviewComponent) },
      { path: 'activity', loadComponent: () => import('./pages/activity.component').then((page) => page.ActivityComponent) },
      { path: 'activity/:id', loadComponent: () => import('./pages/payment-detail.component').then((page) => page.PaymentDetailComponent) },
      { path: 'preferences', loadComponent: () => import('./pages/preferences.component').then((page) => page.PreferencesComponent) },
      { path: 'methods', loadComponent: () => import('./pages/methods.component').then((page) => page.MethodsComponent) },
      { path: 'notifications', loadComponent: () => import('./pages/notifications.component').then((page) => page.NotificationsComponent) },
      { path: 'profile', loadComponent: () => import('./pages/profile.component').then((page) => page.ProfileComponent) },
      { path: 'support', loadComponent: () => import('./pages/support.component').then((page) => page.SupportComponent) },
    ],
  },
  { path: 'help', data: { page: 'help' }, loadComponent: () => import('./pages/legal.component').then((page) => page.LegalComponent) },
  { path: 'terms', data: { page: 'terms' }, loadComponent: () => import('./pages/legal.component').then((page) => page.LegalComponent) },
  { path: 'privacy', data: { page: 'privacy' }, loadComponent: () => import('./pages/legal.component').then((page) => page.LegalComponent) },
  { path: '**', redirectTo: 'checkout' },
];
