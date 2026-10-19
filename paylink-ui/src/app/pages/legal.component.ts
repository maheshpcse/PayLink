import { NgFor } from '@angular/common';
import { Component, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { IconComponent } from '../shared/ui.components';

interface LegalContent { eyebrow: string; title: string; intro: string; sections: Array<{ title: string; body: string }>; }

@Component({ selector: 'pl-legal', standalone: true, imports: [NgFor, RouterLink, IconComponent], templateUrl: './legal.component.html' })
export class LegalComponent {
  private readonly route = inject(ActivatedRoute);
  readonly content: LegalContent = this.getContent(this.route.snapshot.data['page'] as string);
  private getContent(page: string): LegalContent {
    if (page === 'terms') return { eyebrow: 'PayLink · terms', title: 'Simple terms for a simple companion.', intro: 'These preview terms describe the behavior of this UI and are not production legal terms.', sections: [{ title: 'The preview', body: 'PayLink is a customer experience preview. It does not process, authorize, settle, or store real payments. Any references, receipts, and statuses shown in test mode are synthetic.' }, { title: 'Your information', body: 'The demo uses example records. A connected deployment must publish its own production terms and explain its provider, retention, and support practices.' }, { title: 'Availability', body: 'The demo is provided as-is for evaluation and product discussion. Review these templates with counsel before launch.' }] };
    if (page === 'privacy') return { eyebrow: 'PayLink · privacy', title: 'Privacy that is easy to find.', intro: 'This preview keeps the explanation close to the action.', sections: [{ title: 'Demo data', body: 'The bundled customer, merchant, method, and activity records are example data held in the application session. They are not real customer records.' }, { title: 'Connected servers', body: 'When a PayLink API base URL is configured, the client may request account data from that server. Review the server deployment’s privacy notice before using it with customer data.' }, { title: 'Your choices', body: 'You can use the demo without an account, sign out, remove demo methods, and contact support from the account area.' }] };
    return { eyebrow: 'PayLink guide', title: 'Help, without the runaround.', intro: 'A calm payment companion makes the amount, method, and server-verified outcome easier to understand.', sections: [{ title: 'What is test mode?', body: 'Test mode is a safe preview. The payment flow is simulated locally or by the PayLink test provider, so no card, bank account, or real money is involved. Choose an outcome at checkout to see success, pending, and declined states.' }, { title: 'How does the amount work?', body: 'The order summary displays a fixed amount supplied by the payment server. You can review it, but cannot edit it in the checkout UI.' }, { title: 'Can I use my real payment details?', body: 'No. This MVP uses bundled masked demo methods and labeled test outcomes. A real gateway-hosted setup flow must be added before production use.' }] };
  }
}
