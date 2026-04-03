-- Migration: 004_token_budget_columns.sql
-- Adds columns needed for Token Budget Controller (Tasks 4.5, 4.10)

ALTER TABLE token_usage
  ADD COLUMN IF NOT EXISTS suspended               BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS unavailability_msg_sent BOOLEAN NOT NULL DEFAULT FALSE;
