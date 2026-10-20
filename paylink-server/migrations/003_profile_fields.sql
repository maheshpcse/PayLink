-- Profile fields added after the original local schema.
-- MySQL 8 supports IF NOT EXISTS for additive column/index migrations.

ALTER TABLE users
  ADD COLUMN username VARCHAR(40) NULL AFTER email,
  ADD COLUMN avatar_url VARCHAR(500) NOT NULL DEFAULT '' AFTER phone;

UPDATE users
SET username = LEFT(REPLACE(REPLACE(REPLACE(SUBSTRING_INDEX(email, '@', 1), '.', ''), '-', ''), '_', ''), 40)
WHERE username IS NULL OR username = '';

ALTER TABLE users
  MODIFY COLUMN username VARCHAR(40) NOT NULL,
  ADD UNIQUE KEY uq_users_username (username);
