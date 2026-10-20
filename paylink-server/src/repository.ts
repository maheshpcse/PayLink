import { newId } from './security.js';
import type {
  CheckoutSessionRecord,
  IdempotencyRecord,
  NotificationRecord,
  PaymentMethodRecord,
  PaymentRecord,
  SessionRecord,
  SupportTicketRecord,
  UserRecord,
  WebhookEventRecord,
} from './types.js';

export interface NewUser {
  email: string;
  username?: string;
  name: string;
  phone?: string;
  avatarUrl?: string;
  twoFactorEnabled?: boolean;
  passwordHash: string;
  role: UserRecord['role'];
}

export interface NewPaymentMethod extends Omit<PaymentMethodRecord, 'id'> {
  id?: string;
}

export class MemoryRepository {
  private readonly users = new Map<string, UserRecord>();
  private readonly usersByEmail = new Map<string, string>();
  private readonly sessions = new Map<string, SessionRecord>();
  private readonly checkoutSessions = new Map<string, CheckoutSessionRecord>();
  private readonly paymentMethods = new Map<string, PaymentMethodRecord>();
  private readonly payments = new Map<string, PaymentRecord>();
  private readonly idempotency = new Map<string, IdempotencyRecord>();
  private readonly tickets = new Map<string, SupportTicketRecord>();
  private readonly notifications = new Map<string, NotificationRecord>();
  private readonly webhookEvents = new Map<string, WebhookEventRecord>();

  createUser(input: NewUser): UserRecord {
    const user: UserRecord = {
      ...input,
      username: input.username ?? (input.email.split('@')[0].replace(/[^a-zA-Z0-9._-]/g, '').slice(0, 40) || `user${Date.now()}`),
      phone: input.phone ?? '',
      avatarUrl: input.avatarUrl ?? '',
      twoFactorEnabled: input.twoFactorEnabled ?? false,
      id: newId(),
      createdAt: new Date().toISOString(),
    };
    this.users.set(user.id, user);
    this.usersByEmail.set(user.email, user.id);
    return user;
  }

  findUserById(id: string): UserRecord | undefined {
    return this.users.get(id);
  }

  findUserByEmail(email: string): UserRecord | undefined {
    const id = this.usersByEmail.get(email.toLowerCase());
    return id ? this.users.get(id) : undefined;
  }

  findUserByIdentifier(identifier: string): UserRecord | undefined {
    const normalized = identifier.trim().toLowerCase();
    return this.findUserByEmail(normalized) ?? [...this.users.values()].find((user) => user.username.toLowerCase() === normalized || user.phone.toLowerCase() === normalized);
  }

  listUsers(): UserRecord[] {
    return [...this.users.values()];
  }

  saveSession(session: SessionRecord): void {
    this.sessions.set(session.token, session);
  }

  findSession(token: string): SessionRecord | undefined {
    const session = this.sessions.get(token);
    if (session && session.expiresAt <= Date.now()) {
      this.sessions.delete(token);
      return undefined;
    }
    return session;
  }

  deleteSession(token: string): void {
    this.sessions.delete(token);
  }

  createCheckoutSession(session: CheckoutSessionRecord): CheckoutSessionRecord {
    this.checkoutSessions.set(session.id, session);
    return session;
  }

  findCheckoutSession(id: string): CheckoutSessionRecord | undefined {
    return this.checkoutSessions.get(id);
  }

  updateUser(id: string, update: Partial<Pick<UserRecord, 'email' | 'username' | 'name' | 'phone' | 'avatarUrl' | 'twoFactorEnabled'>>): UserRecord {
    const user = this.users.get(id);
    if (!user) throw new Error(`User ${id} does not exist`);
    if (update.email && update.email !== user.email) {
      this.usersByEmail.delete(user.email);
      this.usersByEmail.set(update.email, id);
    }
    Object.assign(user, update);
    return user;
  }

  updatePassword(id: string, passwordHash: string): void {
    const user = this.users.get(id);
    if (!user) throw new Error(`User ${id} does not exist`);
    user.passwordHash = passwordHash;
  }

  createPaymentMethod(input: NewPaymentMethod): PaymentMethodRecord {
    const method: PaymentMethodRecord = { ...input, id: input.id ?? newId() };
    this.paymentMethods.set(method.id, method);
    return method;
  }

  findPaymentMethod(id: string): PaymentMethodRecord | undefined {
    return this.paymentMethods.get(id);
  }

  listPaymentMethodsForUser(userId: string): PaymentMethodRecord[] {
    return [...this.paymentMethods.values()]
      .filter((method) => method.userId === userId)
      .sort((left, right) => Number(right.isDefault) - Number(left.isDefault) || left.id.localeCompare(right.id));
  }

  deletePaymentMethod(id: string): boolean {
    const method = this.paymentMethods.get(id);
    if (!method) return false;
    this.paymentMethods.delete(id);
    if (method.isDefault) {
      const replacement = this.listPaymentMethodsForUser(method.userId)[0];
      if (replacement) replacement.isDefault = true;
    }
    return true;
  }

  createPayment(payment: Omit<PaymentRecord, 'id' | 'createdAt' | 'updatedAt'>): PaymentRecord {
    const now = new Date().toISOString();
    const record: PaymentRecord = { ...payment, id: newId(), createdAt: now, updatedAt: now };
    this.payments.set(record.id, record);
    return record;
  }

  findPayment(id: string): PaymentRecord | undefined {
    return this.payments.get(id);
  }

  listPaymentsForUser(userId: string): PaymentRecord[] {
    return [...this.payments.values()]
      .filter((payment) => payment.userId === userId)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  }

  updatePayment(id: string, update: Partial<PaymentRecord>): PaymentRecord {
    const payment = this.payments.get(id);
    if (!payment) throw new Error(`Payment ${id} does not exist`);
    Object.assign(payment, update, { updatedAt: new Date().toISOString() });
    return payment;
  }

  findIdempotency(userId: string, key: string): IdempotencyRecord | undefined {
    return this.idempotency.get(`${userId}:${key}`);
  }

  saveIdempotency(record: IdempotencyRecord): void {
    this.idempotency.set(`${record.userId}:${record.key}`, record);
  }

  createTicket(ticket: Omit<SupportTicketRecord, 'id' | 'createdAt' | 'updatedAt'>): SupportTicketRecord {
    const now = new Date().toISOString();
    const record: SupportTicketRecord = { ...ticket, id: newId(), createdAt: now, updatedAt: now };
    this.tickets.set(record.id, record);
    return record;
  }

  findTicket(id: string): SupportTicketRecord | undefined {
    return this.tickets.get(id);
  }

  listTickets(userId?: string): SupportTicketRecord[] {
    return [...this.tickets.values()]
      .filter((ticket) => !userId || ticket.userId === userId)
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  }

  updateTicket(id: string, update: Partial<SupportTicketRecord>): SupportTicketRecord {
    const ticket = this.tickets.get(id);
    if (!ticket) throw new Error(`Ticket ${id} does not exist`);
    Object.assign(ticket, update, { updatedAt: new Date().toISOString() });
    return ticket;
  }

  createNotification(notification: Omit<NotificationRecord, 'id' | 'createdAt'>): NotificationRecord {
    const record: NotificationRecord = { ...notification, id: newId(), createdAt: new Date().toISOString() };
    this.notifications.set(record.id, record);
    return record;
  }

  listNotifications(userId: string, unreadOnly: boolean): NotificationRecord[] {
    return [...this.notifications.values()]
      .filter((notification) => notification.userId === userId && (!unreadOnly || !notification.readAt))
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  }

  findNotification(id: string): NotificationRecord | undefined {
    return this.notifications.get(id);
  }

  markNotificationRead(id: string): NotificationRecord {
    const notification = this.notifications.get(id);
    if (!notification) throw new Error(`Notification ${id} does not exist`);
    notification.readAt ??= new Date().toISOString();
    return notification;
  }

  markAllNotificationsRead(userId: string): void {
    const now = new Date().toISOString();
    for (const notification of this.notifications.values()) {
      if (notification.userId === userId && !notification.readAt) notification.readAt = now;
    }
  }

  recordWebhookEvent(eventId: string): boolean {
    if (this.webhookEvents.has(eventId)) return false;
    this.webhookEvents.set(eventId, { eventId, receivedAt: new Date().toISOString() });
    return true;
  }
}
