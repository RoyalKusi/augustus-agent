-- Fix admin operator password hash
-- Password: Admin@1234 (bcrypt, 10 rounds)
-- Generated fresh to ensure correct hash
UPDATE operators
SET password_hash = '$2b$10$ORBWvgb6bJbmc6y2XUWBieYj8IhpYNNTa5I30Xg7PChbffAsuYo3a',
    updated_at = NOW()
WHERE email = 'admin@augustus.ai';

-- Also ensure the account exists if it was never seeded
INSERT INTO operators (email, password_hash, mfa_enabled)
VALUES (
  'admin@augustus.ai',
  '$2b$10$ORBWvgb6bJbmc6y2XUWBieYj8IhpYNNTa5I30Xg7PChbffAsuYo3a',
  FALSE
)
ON CONFLICT (email) DO UPDATE SET
  password_hash = EXCLUDED.password_hash,
  updated_at = NOW();
