-- Seed the default admin operator account
-- Password: Admin@1234 (bcrypt hash, 10 rounds)
INSERT INTO operators (email, password_hash, mfa_enabled)
VALUES (
  'admin@augustus.ai',
  '$2b$10$zJ5mdQdsMa1ESLcvHGWduu4hnjY3KSaHE4SRCJpGva1Sq9.iiXtUu',
  FALSE
)
ON CONFLICT (email) DO NOTHING;
