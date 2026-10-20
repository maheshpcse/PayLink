import { validationError } from './errors.js';
import type { PaymentMethodMetadata, Role, TicketPriority, TicketStatus } from './types.js';

type Input = Record<string, unknown>;

function objectInput(input: unknown): Input {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw validationError('Request body must be a JSON object');
  }
  return input as Input;
}

function stringValue(value: unknown, field: string, min: number, max: number): string {
  if (typeof value !== 'string') throw validationError(`${field} must be a string`);
  const result = value.trim();
  if (result.length < min || result.length > max) {
    throw validationError(`${field} must contain between ${min} and ${max} characters`);
  }
  return result;
}

export interface RegistrationInput {
  email: string;
  username?: string;
  password: string;
  name: string;
}

export function registrationInput(input: unknown): RegistrationInput {
  const body = objectInput(input);
  const email = stringValue(body.email, 'email', 3, 254).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw validationError('email must be a valid email address');
  const password = stringValue(body.password, 'password', 8, 128);
  const name = stringValue(body.name ?? email.split('@')[0], 'name', 1, 100);
  const username = body.username === undefined ? undefined : stringValue(body.username, 'username', 3, 40);
  if (username && !/^[a-zA-Z0-9._-]+$/.test(username)) throw validationError('username may contain only letters, numbers, dots, dashes, and underscores');
  return { email, password, name, username };
}

export interface LoginInput {
  email: string;
  password: string;
}

export function loginInput(input: unknown): LoginInput {
  const body = objectInput(input);
  return {
    email: stringValue(body.email, 'email', 3, 254).toLowerCase(),
    password: stringValue(body.password, 'password', 1, 128),
  };
}

export interface PasswordChangeInput {
  currentPassword: string;
  newPassword: string;
}

export function passwordChangeInput(input: unknown): PasswordChangeInput {
  const body = objectInput(input);
  return {
    currentPassword: stringValue(body.currentPassword, 'currentPassword', 1, 128),
    newPassword: stringValue(body.newPassword, 'newPassword', 8, 128),
  };
}

function paymentMethodInput(value: unknown): PaymentMethodMetadata {
  const method = objectInput(value);
  const sensitiveFields = ['number', 'cardNumber', 'pan', 'cvc', 'cvv', 'securityCode'];
  const foundSensitive = sensitiveFields.find((field) => field in method);
  if (foundSensitive) {
    throw validationError(`Do not send ${foundSensitive}; use a provider token and masked metadata`);
  }
  const type = method.type;
  if (type !== 'card' && type !== 'bank_transfer' && type !== 'wallet') {
    throw validationError('paymentMethod.type must be card, bank_transfer, or wallet');
  }
  const brand = stringValue(method.brand ?? 'unknown', 'paymentMethod.brand', 2, 30).toLowerCase();
  const last4 = stringValue(method.last4, 'paymentMethod.last4', 4, 4);
  if (!/^\d{4}$/.test(last4)) throw validationError('paymentMethod.last4 must contain four digits');
  return { type, brand, last4 };
}

export interface CheckoutInput {
  amountMinor: number;
  currency: string;
  description: string;
  paymentMethod: PaymentMethodMetadata;
  testOutcome: 'succeeded' | 'failed';
}

export interface PaymentCreationInput {
  checkoutSessionId: string;
  paymentMethodId: string;
  testOutcome: 'success' | 'pending' | 'failed';
}

function rejectRawPaymentFields(body: Input): void {
  const sensitiveFields = ['number', 'cardNumber', 'pan', 'cvc', 'cvv', 'securityCode'];
  const foundSensitive = sensitiveFields.find((field) => field in body);
  if (foundSensitive) throw validationError(`Do not send ${foundSensitive}; use a saved payment method token`);
  if (body.paymentMethod !== undefined) {
    const method = objectInput(body.paymentMethod);
    const nestedSensitive = sensitiveFields.find((field) => field in method);
    if (nestedSensitive) throw validationError(`Do not send ${nestedSensitive}; use a saved payment method token`);
    throw validationError('paymentMethod is not accepted for session payments; use paymentMethodId');
  }
}

export function paymentCreationInput(input: unknown): PaymentCreationInput {
  const body = objectInput(input);
  rejectRawPaymentFields(body);
  const checkoutSessionId = stringValue(body.checkoutSessionId ?? body.checkoutId, 'checkoutSessionId', 1, 100);
  const paymentMethodId = stringValue(body.paymentMethodId ?? body.methodId, 'paymentMethodId', 1, 100);
  const testOutcome = body.testOutcome ?? 'success';
  if (testOutcome !== 'success' && testOutcome !== 'pending' && testOutcome !== 'failed' && testOutcome !== 'succeeded') {
    throw validationError('testOutcome must be success, pending, or failed');
  }
  return {
    checkoutSessionId,
    paymentMethodId,
    testOutcome: testOutcome === 'succeeded' ? 'success' : testOutcome,
  };
}

export function checkoutInput(input: unknown): CheckoutInput {
  const body = objectInput(input);
  const amountMinor = body.amountMinor;
  if (!Number.isSafeInteger(amountMinor) || (amountMinor as number) < 1 || (amountMinor as number) > 999_999_999_999) {
    throw validationError('amountMinor must be a positive integer in minor currency units');
  }
  const currency = stringValue(body.currency, 'currency', 3, 3).toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) throw validationError('currency must be an ISO-4217 three-letter code');
  const testOutcome = body.testOutcome ?? 'succeeded';
  if (testOutcome !== 'succeeded' && testOutcome !== 'failed') {
    throw validationError('testOutcome must be succeeded or failed');
  }
  return {
    amountMinor: amountMinor as number,
    currency,
    description: stringValue(body.description ?? 'PayLink checkout', 'description', 1, 200),
    paymentMethod: paymentMethodInput(body.paymentMethod),
    testOutcome,
  };
}

export function paymentActionInput(input: unknown): { testOutcome?: 'succeeded' | 'failed' } {
  const body = objectInput(input);
  if (body.testOutcome === undefined) return {};
  if (body.testOutcome !== 'succeeded' && body.testOutcome !== 'failed') {
    throw validationError('testOutcome must be succeeded or failed');
  }
  return { testOutcome: body.testOutcome };
}

export interface ProfilePatchInput {
  name?: string;
  username?: string;
  email?: string;
  phone?: string;
  avatarUrl?: string;
  twoFactorEnabled?: boolean;
}

export function profilePatchInput(input: unknown): ProfilePatchInput {
  const body = objectInput(input);
  const result: ProfilePatchInput = {};
  if (body.name !== undefined) result.name = stringValue(body.name, 'name', 1, 100);
  if (body.username !== undefined) {
    result.username = stringValue(body.username, 'username', 3, 40);
    if (!/^[a-zA-Z0-9._-]+$/.test(result.username)) throw validationError('username may contain only letters, numbers, dots, dashes, and underscores');
  }
  if (body.email !== undefined) {
    const email = stringValue(body.email, 'email', 3, 254).toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw validationError('email must be a valid email address');
    result.email = email;
  }
  if (body.phone !== undefined) result.phone = stringValue(body.phone, 'phone', 0, 40);
  if (body.avatarUrl !== undefined) result.avatarUrl = stringValue(body.avatarUrl, 'avatarUrl', 0, 500);
  if (body.twoFactorEnabled !== undefined) {
    if (typeof body.twoFactorEnabled !== 'boolean') throw validationError('twoFactorEnabled must be a boolean');
    result.twoFactorEnabled = body.twoFactorEnabled;
  }
  if (Object.keys(result).length === 0) throw validationError('At least one profile field is required');
  return result;
}

export interface TicketInput {
  subject: string;
  message: string;
  category: 'billing' | 'account' | 'technical' | 'other';
}

export function ticketInput(input: unknown): TicketInput {
  const body = objectInput(input);
  const category = body.category ?? 'other';
  if (category !== 'billing' && category !== 'account' && category !== 'technical' && category !== 'other') {
    throw validationError('category must be billing, account, technical, or other');
  }
  return {
    subject: stringValue(body.subject, 'subject', 3, 120),
    message: stringValue(body.message, 'message', 1, 4_000),
    category,
  };
}

export function ticketMessageInput(input: unknown): string {
  const body = objectInput(input);
  return stringValue(body.message, 'message', 1, 4_000);
}

export interface TicketPatchInput {
  status?: TicketStatus;
  priority?: TicketPriority;
}

export function ticketPatchInput(input: unknown): TicketPatchInput {
  const body = objectInput(input);
  const result: TicketPatchInput = {};
  if (body.status !== undefined) {
    if (!['open', 'pending', 'resolved', 'closed'].includes(body.status as string)) {
      throw validationError('status must be open, pending, resolved, or closed');
    }
    result.status = body.status as TicketStatus;
  }
  if (body.priority !== undefined) {
    if (!['low', 'normal', 'high'].includes(body.priority as string)) {
      throw validationError('priority must be low, normal, or high');
    }
    result.priority = body.priority as TicketPriority;
  }
  if (!result.status && !result.priority) throw validationError('At least one ticket field is required');
  return result;
}

export function roleIsStaff(role: Role): boolean {
  return role === 'admin' || role === 'support';
}

export function webhookInput(input: unknown): { eventId: string; type: 'payment.succeeded' | 'payment.failed'; paymentId: string } {
  const body = objectInput(input);
  const eventId = stringValue(body.eventId, 'eventId', 3, 150);
  const type = body.type;
  if (type !== 'payment.succeeded' && type !== 'payment.failed') {
    throw validationError('type must be payment.succeeded or payment.failed');
  }
  return {
    eventId,
    type,
    paymentId: stringValue(body.paymentId, 'paymentId', 1, 100),
  };
}
