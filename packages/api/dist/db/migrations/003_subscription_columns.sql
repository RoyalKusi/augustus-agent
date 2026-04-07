-- Migration: 003_subscription_columns.sql
-- Adds columns needed for subscription management (Tasks 3.3, 3.4, 3.6)

ALTER TABLE subscriptions
  ADD COLUMN IF NOT EXISTS reminder_7_sent         BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS reminder_1_sent         BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS failed_payment_attempts INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS next_retry_at           TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS pending_downgrade_tier  VARCHAR(16)
    CHECK (pending_downgrade_tier IN ('silver', 'gold', 'platinum'));
