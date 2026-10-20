-- PayLink local/demo seed records.
-- Run after 001_init.sql against a disposable local database only.
-- Password hashes are deliberately unusable placeholders: register through the
-- API for an interactive account. No OTPs, raw card data, tokens, or secrets are
-- seeded here.

INSERT INTO users (id, email, username, name, phone, avatar_url, two_factor_enabled, password_hash, role)
VALUES
  ('00000000-0000-4000-8000-000000000001', 'jamie.lee@example.com', 'jamielee', 'Jamie Lee', '+1 (555) 014-2084', '', FALSE, 'seed-disabled', 'customer'),
  ('00000000-0000-4000-8000-000000000002', 'support@example.test', 'paylinksupport', 'PayLink Support', '', '', TRUE, 'seed-disabled', 'support'),
  ('00000000-0000-4000-8000-000000000003', 'admin@example.test', 'paylinkadmin', 'PayLink Admin', '', '', TRUE, 'seed-disabled', 'admin')
ON DUPLICATE KEY UPDATE id = VALUES(id);

INSERT INTO checkout_sessions (id, merchant_name, merchant_mark, description, amount_minor, currency, due_label, expires_at)
VALUES ('checkout_demo_7H2Q', 'Northstar Learning Co.', 'N', 'Advanced Statistics · monthly plan', 18900, 'USD', 'Due today', '2099-10-31 23:59:59.000')
ON DUPLICATE KEY UPDATE id = VALUES(id);

INSERT INTO payment_methods (id, user_id, type, brand, last4, label, detail, expiry, is_default, brand_color)
VALUES
  ('00000000-0000-4000-8000-000000000101', '00000000-0000-4000-8000-000000000001', 'card', 'visa', '4242', 'Visa ending in 4242', 'Personal card', 'Exp 08/28', TRUE, '#182d69'),
  ('00000000-0000-4000-8000-000000000102', '00000000-0000-4000-8000-000000000001', 'bank_transfer', 'first community bank', '9012', 'Checking ending in 9012', 'First Community Bank', NULL, FALSE, '#496c4d')
ON DUPLICATE KEY UPDATE id = VALUES(id);

INSERT INTO payments (id, user_id, checkout_session_id, amount_minor, currency, description, status, payment_method_type, payment_method_brand, payment_method_last4, provider_reference)
VALUES
  ('00000000-0000-4000-8000-000000000201', '00000000-0000-4000-8000-000000000001', 'checkout_demo_7H2Q', 18900, 'USD', 'Advanced Statistics · monthly plan', 'succeeded', 'card', 'visa', '4242', 'seed_PL-1048-NS'),
  ('00000000-0000-4000-8000-000000000202', '00000000-0000-4000-8000-000000000001', 'checkout_demo_7H2Q', 12900, 'USD', 'Intro to Data · monthly plan', 'processing', 'card', 'visa', '4242', 'seed_PL-0988-NS')
ON DUPLICATE KEY UPDATE id = VALUES(id);

INSERT INTO support_tickets (id, user_id, subject, category, status, priority)
VALUES
  ('00000000-0000-4000-8000-000000000301', '00000000-0000-4000-8000-000000000001', 'Question about a pending payment', 'billing', 'open', 'normal'),
  ('00000000-0000-4000-8000-000000000302', '00000000-0000-4000-8000-000000000001', 'Receipt resend request', 'billing', 'resolved', 'normal')
ON DUPLICATE KEY UPDATE id = VALUES(id);

INSERT INTO support_ticket_messages (id, ticket_id, author_id, message)
VALUES
  ('00000000-0000-4000-8000-000000000401', '00000000-0000-4000-8000-000000000301', '00000000-0000-4000-8000-000000000001', 'Please check my pending demo payment.'),
  ('00000000-0000-4000-8000-000000000402', '00000000-0000-4000-8000-000000000302', '00000000-0000-4000-8000-000000000001', 'Please resend the demo receipt.')
ON DUPLICATE KEY UPDATE id = VALUES(id);

INSERT INTO notifications (id, user_id, type, title, message)
VALUES
  ('00000000-0000-4000-8000-000000000501', '00000000-0000-4000-8000-000000000001', 'payment.succeeded', 'Your Northstar receipt is ready', 'Payment seed_PL-1048-NS was completed in test data.'),
  ('00000000-0000-4000-8000-000000000502', '00000000-0000-4000-8000-000000000001', 'security.sign-in', 'New sign-in verified', 'A local demo sign-in was recorded.'),
  ('00000000-0000-4000-8000-000000000503', '00000000-0000-4000-8000-000000000001', 'payment.processing', 'A payment is still pending', 'The seeded Intro to Data payment is processing.')
ON DUPLICATE KEY UPDATE id = VALUES(id);
