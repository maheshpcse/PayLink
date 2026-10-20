import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'pl-faq',
  standalone: true,
  imports: [RouterLink],
  template: `
    <div class="page-stack info-page info-page--wide">
      <div class="info-intro"><p class="eyebrow">PayLink · FAQ</p><h1>Frequently asked questions.</h1><p>Quick answers about checkout, account access, and payment records.</p></div>
      <div class="faq-list">
        <details class="panel faq-item" open><summary>Can I use my real card?</summary><p>No. This workspace uses masked payment methods and simulated outcomes. No real money moves.</p></details>
        <details class="panel faq-item"><summary>Why do I need to sign in?</summary><p>Saved methods, payment history, notifications, and account changes are private account data. The public home page only explains PayLink and starts the sign-in flow.</p></details>
        <details class="panel faq-item"><summary>How do I change my password?</summary><p>Sign in, open your profile, and choose Change password.</p></details>
        <details class="panel faq-item"><summary>How can I contact support?</summary><p>Open the Help Center and use the contact form, or sign in to keep a support ticket in your account.</p></details>
      </div>
      <a class="text-button" routerLink="/help">Open Help Center</a>
    </div>
  `,
})
export class FaqComponent {}
