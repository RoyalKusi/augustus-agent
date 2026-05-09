-- Migration: 032_withdrawal_otp_columns.sql
-- Add withdrawal OTP columns to businesses table for withdrawal 2FA verification

ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS withdrawal_otp_hash          VARCHAR(64),
  ADD COLUMN IF NOT EXISTS withdrawal_otp_expires_at    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS withdrawal_otp_request_count INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS withdrawal_otp_fail_count    INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS withdrawal_otp_window_start  TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_businesses_withdrawal_otp_expires
  ON businesses(withdrawal_otp_expires_at)
  WHERE withdrawal_otp_expires_at IS NOT NULL;
