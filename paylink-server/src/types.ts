export type Role = 'customer' | 'support' | 'admin';

export type PaymentStatus = 'created' | 'processing' | 'succeeded' | 'failed' | 'refunded';

export type TicketStatus = 'open' | 'pending' | 'resolved' | 'closed';

export type TicketPriority = 'low' | 'normal' | 'high';

export interface UserRecord {
  id: string;
  email: string;
  username: string;
  name: string;
  phone: string;
  avatarUrl: string;
  twoFactorEnabled: boolean;
  passwordHash: string;
  role: Role;
  createdAt: string;
}

export interface SessionRecord {
  token: string;
  userId: string;
  expiresAt: number;
  createdAt: string;
}

export interface PaymentMethodMetadata {
  type: 'card' | 'bank_transfer' | 'wallet';
  brand: string;
  last4: string;
}

export interface PaymentMethodRecord extends PaymentMethodMetadata {
  id: string;
  userId: string;
  label: string;
  detail: string;
  expiry?: string;
  isDefault: boolean;
  brandColor: string;
}

export interface CheckoutSessionRecord {
  id: string;
  merchantName: string;
  merchantMark: string;
  description: string;
  amountMinor: number;
  currency: string;
  dueLabel: string;
  expiresAt: string;
}

export interface PaymentRecord {
  id: string;
  userId: string;
  amountMinor: number;
  currency: string;
  description: string;
  status: PaymentStatus;
  paymentMethod: PaymentMethodMetadata;
  providerReference: string;
  testOutcome?: 'succeeded' | 'processing' | 'failed';
  failureCode?: string;
  createdAt: string;
  updatedAt: string;
}

export interface IdempotencyRecord {
  userId: string;
  key: string;
  requestHash: string;
  statusCode: number;
  responseBody: unknown;
  createdAt: string;
}

export interface TicketMessage {
  id: string;
  authorId: string;
  message: string;
  createdAt: string;
}

export interface SupportTicketRecord {
  id: string;
  userId: string;
  subject: string;
  category: 'billing' | 'account' | 'technical' | 'other';
  status: TicketStatus;
  priority: TicketPriority;
  assignedTo?: string;
  messages: TicketMessage[];
  createdAt: string;
  updatedAt: string;
}

export interface NotificationRecord {
  id: string;
  userId: string;
  type: string;
  title: string;
  message: string;
  readAt?: string;
  createdAt: string;
}

export interface WebhookEventRecord {
  eventId: string;
  receivedAt: string;
}
