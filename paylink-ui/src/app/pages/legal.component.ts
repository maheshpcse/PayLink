import { NgFor } from '@angular/common';
import { Component, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { IconComponent } from '../shared/ui.components';

interface LegalContent { eyebrow: string; title: string; intro: string; sections: Array<{ title: string; body: string }>; }

@Component({ selector: 'pl-legal', standalone: true, imports: [NgFor, ReactiveFormsModule, IconComponent], templateUrl: './legal.component.html' })
export class LegalComponent {
  private readonly route = inject(ActivatedRoute);
  readonly page = this.route.snapshot.data['page'] as string;
  readonly isHelp = this.page === 'help';
  readonly content: LegalContent = this.getContent(this.page);
  readonly contactForm = new FormGroup({ name: new FormControl('', { nonNullable: true, validators: [Validators.required] }), email: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.email] }), message: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.minLength(10)] }) });
  contactSent = false;
  submitContact(): void { if (this.contactForm.invalid) { this.contactForm.markAllAsTouched(); return; } this.contactSent = true; this.contactForm.reset(); }
  private getContent(page: string): LegalContent {
    if (page === 'legal') return { eyebrow: 'PayLink · legal', title: 'Terms and privacy.', intro: 'The essential legal context for this PayLink preview is kept together on one page.', sections: [{ title: 'Terms · the preview', body: 'PayLink is a customer experience preview. It does not process, authorize, settle, or store real payments. Any references, receipts, and statuses shown here are synthetic.' }, { title: 'Terms · availability', body: 'The preview is provided as-is for evaluation and product discussion. Review these templates with counsel before launch.' }, { title: 'Privacy · demo data', body: 'The bundled customer, merchant, method, and activity records are example data held in the application session. They are not real customer records.' }, { title: 'Privacy · connected servers', body: 'When a PayLink API base URL is configured, the client may request account data from that server. Review the server deployment’s privacy notice before using it with customer data.' }, { title: 'Privacy · your choices', body: 'You can sign out, remove demo methods, and contact support from the account area.' }] };
    return { eyebrow: 'PayLink guide', title: 'Help, without the runaround.', intro: 'A calm payment companion makes the amount, method, and server-verified outcome easier to understand.', sections: [{ title: 'What is this preview?', body: 'This is a safe preview. The payment flow is simulated locally or by the PayLink provider, so no card, bank account, or real money is involved. Choose an outcome at checkout to see success, pending, and declined states.' }, { title: 'How does the amount work?', body: 'The order summary displays a fixed amount supplied by the payment server. You can review it, but cannot edit it in the checkout UI.' }, { title: 'Can I use my real payment details?', body: 'No. This preview uses bundled masked methods and labeled payment outcomes. A real gateway-hosted setup flow must be added before production use.' }] };
  }
}
