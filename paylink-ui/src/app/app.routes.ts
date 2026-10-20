import { Routes } from '@angular/router';
import { accountGuard } from './core/auth.guard';

export const routes: Routes = [
  { path: '', pathMatch: 'full', loadComponent: () => import('./pages/landing.component').then((page) => page.LandingComponent) },
  { path: 'checkout', loadComponent: () => import('./pages/checkout.component').then((page) => page.CheckoutComponent) },
  { path: 'auth/sign-up', loadComponent: () => import('./pages/sign-up.component').then((page) => page.SignUpComponent) },
  { path: 'auth/forgot-password', loadComponent: () => import('./pages/forgot-password.component').then((page) => page.ForgotPasswordComponent) },
  { path: 'auth/email-otp', data: { channel: 'email' }, loadComponent: () => import('./pages/otp-login.component').then((page) => page.OtpLoginComponent) },
  { path: 'auth/phone-otp', data: { channel: 'phone' }, loadComponent: () => import('./pages/otp-login.component').then((page) => page.OtpLoginComponent) },
  { path: 'auth', pathMatch: 'full', loadComponent: () => import('./pages/auth.component').then((page) => page.AuthComponent) },
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
      { path: 'change-password', loadComponent: () => import('./pages/change-password.component').then((page) => page.ChangePasswordComponent) },
      { path: 'support', loadComponent: () => import('./pages/support.component').then((page) => page.SupportComponent) },
    ],
  },
  { path: 'help', data: { page: 'help' }, loadComponent: () => import('./pages/legal.component').then((page) => page.LegalComponent) },
  { path: 'faq', loadComponent: () => import('./pages/faq.component').then((page) => page.FaqComponent) },
  { path: 'legal', data: { page: 'legal' }, loadComponent: () => import('./pages/legal.component').then((page) => page.LegalComponent) },
  { path: 'terms', pathMatch: 'full', redirectTo: 'legal' },
  { path: 'privacy', pathMatch: 'full', redirectTo: 'legal' },
  { path: '**', redirectTo: '' },
];
