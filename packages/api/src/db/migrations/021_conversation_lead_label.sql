-- Migration: 021_conversation_lead_label.sql
-- Add lead warmth label to conversations

ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS lead_label VARCHAR(16)
    CHECK (lead_label IN ('hot', 'warm', 'cold', 'browsing'));
