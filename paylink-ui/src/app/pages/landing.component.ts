import { AsyncPipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IconComponent } from '../shared/ui.components';
import { AuthService } from '../core/auth.service';

@Component({
  selector: 'pl-landing',
  standalone: true,
  imports: [AsyncPipe, RouterLink, IconComponent],
  template: `
    <div class="landing-page">
      <section class="landing-hero">
        <p class="eyebrow">Payment companion</p>
        <h1>Simple payments, with <em>clarity.</em></h1>
        <p class="landing-copy">Review an amount, choose a payment method, and keep your account details in one calm place.</p>
        @if (!(authSession$ | async)) { <div class="landing-actions"><a class="primary-button" routerLink="/auth">Sign in <pl-icon name="arrow" /></a><a class="outline-button" routerLink="/auth/sign-up">Create account</a></div> } @else { <div class="landing-actions"><a class="primary-button" routerLink="/account/overview">Open account <pl-icon name="arrow" /></a></div> }
      </section>
      <section class="landing-features" aria-label="PayLink features">
        <article class="landing-feature"><span class="landing-feature-icon"><pl-icon name="shield" /></span><h2>Clear before you pay</h2><p>The total and payment details stay visible before confirmation.</p></article>
        <article class="landing-feature"><span class="landing-feature-icon"><pl-icon name="activity" /></span><h2>Useful account history</h2><p>Find payment records, saved methods, notifications, and support in one place.</p></article>
        <article class="landing-feature"><span class="landing-feature-icon"><pl-icon name="lock" /></span><h2>Private by default</h2><p>Account actions are kept behind sign-in instead of being exposed on the public home page.</p></article>
      </section>
    </div>
  `,
})
export class LandingComponent { readonly authSession$ = inject(AuthService).session$; }
