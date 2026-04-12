-- Migration: 017_operator_otp_columns.sql
-- Add email OTP columns to operators table for login verification

ALTER TABLE operators
  ADD COLUMN IF NOT EXISTS otp_hash        VARCHAR(64),
  ADD COLUMN IF NOT EXISTS otp_expires_at  TIMESTAMPTZ;
