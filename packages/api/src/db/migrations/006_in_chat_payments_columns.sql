-- Migration: 006_in_chat_payments_columns.sql
-- Add in_chat_payments_enabled and external_payment_details columns to businesses table

ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS in_chat_payments_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS external_payment_details JSONB;
