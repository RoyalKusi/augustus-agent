-- Migration: 009_conversation_engine_columns.sql
-- Add columns required by the conversation engine that are missing from the initial schema

-- conversations: add customer_wa_number alias, context_summary, session_start
ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS customer_wa_number VARCHAR(32),
  ADD COLUMN IF NOT EXISTS context_summary    TEXT,
  ADD COLUMN IF NOT EXISTS session_start      TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Backfill customer_wa_number from customer_phone
UPDATE conversations SET customer_wa_number = customer_phone WHERE customer_wa_number IS NULL;

-- messages: add content_type and sent_at columns
ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS content_type VARCHAR(32) NOT NULL DEFAULT 'text',
  ADD COLUMN IF NOT EXISTS sent_at      TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- whatsapp_integrations: add registered_at and webhook_verify_token columns
ALTER TABLE whatsapp_integrations
  ADD COLUMN IF NOT EXISTS registered_at        TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS webhook_verify_token VARCHAR(255) NOT NULL DEFAULT '';
