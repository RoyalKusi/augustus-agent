-- Migration: 008_withdrawal_amount_usd.sql
-- Add amount_usd column to withdrawal_requests (the service uses amount_usd, schema has amount)
-- Also add approved_by column used by processWithdrawal

ALTER TABLE withdrawal_requests
  ADD COLUMN IF NOT EXISTS amount_usd NUMERIC(12, 2),
  ADD COLUMN IF NOT EXISTS approved_by VARCHAR(255);

-- Backfill amount_usd from amount
UPDATE withdrawal_requests SET amount_usd = amount WHERE amount_usd IS NULL;

-- Make amount_usd NOT NULL after backfill
ALTER TABLE withdrawal_requests
  ALTER COLUMN amount_usd SET NOT NULL,
  ALTER COLUMN amount_usd SET DEFAULT 0;
