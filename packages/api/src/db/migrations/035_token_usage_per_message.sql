-- Migration 035: Add per-message token tracking columns to token_usage
-- Adds input_tokens, output_tokens, message_count so the admin dashboard
-- can show a meaningful per-message token summary.

ALTER TABLE token_usage
  ADD COLUMN IF NOT EXISTS input_tokens  BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS output_tokens BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS message_count INT    NOT NULL DEFAULT 0;
