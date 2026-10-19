export type PaymentMethodKind = 'card' | 'bank';
export type PaymentStatus = 'success' | 'pending' | 'failed' | 'refunded';
export type TestOutcome = 'success' | 'pending' | 'failed';
export type ServerPaymentStatus = 'created' | 'processing' | 'succeeded' | 'failed' | 'refunded';
export type SupportTicketStatus = 'open' | 'pending' | 'resolved' | 'closed';

export interface PaymentMethodMetadata {
  type: 'card' | 'bank_transfer' | 'wallet';
  brand: string;
  last4: string;
}

export interface CheckoutSession {
  id: string;
  merchantName: string;
  merchantMark: string;
  description: string;
  amountCents: number;
  currency: string;
  dueLabel: string;
  expiresAt: string;
}

export interface SavedMethod {
  id: string;
  kind: PaymentMethodKind;
  label: string;
  detail: string;
  expiry?: string;
  isDefault: boolean;
  brandColor: string;
  paymentMethod?: PaymentMethodMetadata;
}

export interface PaymentActivity {
  id: string;
  merchantName: string;
  description: string;
  amountCents: number;
  currency: string;
  status: PaymentStatus;
  createdAt: string;
  reference: string;
  paymentMethod?: PaymentMethodMetadata;
}

export interface NotificationItem {
  id: string;
  title: string;
  body: string;
  time: string;
  unread: boolean;
  tone: 'green' | 'violet' | 'orange';
}

export interface Profile {
  name: string;
  email: string;
  phone: string;
  initials: string;
  memberSince: string;
  twoFactorEnabled: boolean;
}

export interface SupportTicket {
  id: string;
  subject: string;
  status: SupportTicketStatus;
  updatedAt: string;
  category: string;
}

export interface PaymentResult {
  paymentId?: string;
  status: PaymentStatus;
  reference: string;
  processedAt: string;
  message: string;
}

export interface ApiResult<T> {
  data: T;
  source: 'server' | 'demo';
  ok: boolean;
  serverConfigured: boolean;
  warning?: string;
}

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: 'customer' | 'support' | 'admin';
  createdAt: string;
}

export interface AuthSession {
  user: AuthUser;
  token: string;
  tokenType: 'Bearer';
  expiresAt: string;
}

export interface SupportTicketRequest {
  subject: string;
  message: string;
  category: string;
}

export interface ProfileUpdate {
  name: string;
  email: string;
  phone: string;
  twoFactorEnabled: boolean;
}

export type AppPage = 'checkout' | 'overview' | 'activity' | 'methods' | 'notifications' | 'profile' | 'support';

export const formatMoney = (cents: number, currency = 'USD'): string =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency, minimumFractionDigits: 2 }).format(cents / 100);

export const formatDate = (date: string): string =>
  new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(date));

export const initialsForName = (name: string): string =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? '').join('');
