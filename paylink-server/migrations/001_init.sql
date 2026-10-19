-- PayLink relational schema reference.
-- The running demo uses src/repository.ts instead of this schema.
-- Never store raw PAN, CVV, passwords, or bearer tokens in these tables.

CREATE TABLE users (
  id CHAR(36) PRIMARY KEY,
  email VARCHAR(254) NOT NULL UNIQUE,
  name VARCHAR(100) NOT NULL,
  phone VARCHAR(40) NOT NULL DEFAULT '',
  two_factor_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('customer', 'support', 'admin') NOT NULL DEFAULT 'customer',
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
);

CREATE TABLE sessions (
  id CHAR(36) PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  token_hash CHAR(64) NOT NULL UNIQUE,
  expires_at DATETIME(3) NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  CONSTRAINT fk_sessions_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_sessions_user (user_id),
  INDEX idx_sessions_expiry (expires_at)
);

CREATE TABLE checkout_sessions (
  id CHAR(36) PRIMARY KEY,
  merchant_name VARCHAR(150) NOT NULL,
  merchant_mark VARCHAR(10) NOT NULL,
  description VARCHAR(200) NOT NULL,
  amount_minor BIGINT UNSIGNED NOT NULL,
  currency CHAR(3) NOT NULL,
  due_label VARCHAR(80) NOT NULL,
  expires_at DATETIME(3) NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX idx_checkout_sessions_expiry (expires_at)
);

CREATE TABLE payment_methods (
  id CHAR(36) PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  type ENUM('card', 'bank_transfer', 'wallet') NOT NULL,
  brand VARCHAR(30) NOT NULL,
  last4 CHAR(4) NOT NULL,
  label VARCHAR(120) NOT NULL,
  detail VARCHAR(150) NOT NULL,
  expiry VARCHAR(20) NULL,
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  brand_color CHAR(7) NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  CONSTRAINT fk_payment_methods_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_payment_methods_user (user_id)
);

CREATE TABLE payments (
  id CHAR(36) PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  checkout_session_id CHAR(36) NULL,
  amount_minor BIGINT UNSIGNED NOT NULL,
  currency CHAR(3) NOT NULL,
  description VARCHAR(200) NOT NULL,
  status ENUM('created', 'processing', 'succeeded', 'failed', 'refunded') NOT NULL,
  payment_method_type ENUM('card', 'bank_transfer', 'wallet') NOT NULL,
  payment_method_brand VARCHAR(30) NOT NULL,
  payment_method_last4 CHAR(4) NOT NULL,
  provider_reference VARCHAR(150) NOT NULL,
  failure_code VARCHAR(80) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  CONSTRAINT fk_payments_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT,
  CONSTRAINT fk_payments_checkout_session FOREIGN KEY (checkout_session_id) REFERENCES checkout_sessions(id) ON DELETE SET NULL,
  INDEX idx_payments_user_created (user_id, created_at),
  INDEX idx_payments_status (status)
);

CREATE TABLE idempotency_keys (
  user_id CHAR(36) NOT NULL,
  idempotency_key VARCHAR(128) NOT NULL,
  request_hash CHAR(64) NOT NULL,
  status_code SMALLINT UNSIGNED NOT NULL,
  response_body JSON NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (user_id, idempotency_key),
  CONSTRAINT fk_idempotency_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE support_tickets (
  id CHAR(36) PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  subject VARCHAR(120) NOT NULL,
  category ENUM('billing', 'account', 'technical', 'other') NOT NULL,
  status ENUM('open', 'pending', 'resolved', 'closed') NOT NULL DEFAULT 'open',
  priority ENUM('low', 'normal', 'high') NOT NULL DEFAULT 'normal',
  assigned_to CHAR(36) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  CONSTRAINT fk_tickets_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_tickets_assignee FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_tickets_user_updated (user_id, updated_at),
  INDEX idx_tickets_status (status)
);

CREATE TABLE support_ticket_messages (
  id CHAR(36) PRIMARY KEY,
  ticket_id CHAR(36) NOT NULL,
  author_id CHAR(36) NOT NULL,
  message TEXT NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  CONSTRAINT fk_ticket_messages_ticket FOREIGN KEY (ticket_id) REFERENCES support_tickets(id) ON DELETE CASCADE,
  CONSTRAINT fk_ticket_messages_author FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE RESTRICT,
  INDEX idx_ticket_messages_ticket_created (ticket_id, created_at)
);

CREATE TABLE notifications (
  id CHAR(36) PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  type VARCHAR(80) NOT NULL,
  title VARCHAR(150) NOT NULL,
  message VARCHAR(500) NOT NULL,
  read_at DATETIME(3) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  CONSTRAINT fk_notifications_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_notifications_user_read_created (user_id, read_at, created_at)
);

CREATE TABLE webhook_events (
  event_id VARCHAR(150) PRIMARY KEY,
  received_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
);
