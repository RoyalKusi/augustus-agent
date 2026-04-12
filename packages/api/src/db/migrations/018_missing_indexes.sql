-- Migration: 018_missing_indexes.sql
-- Add missing indexes for common query patterns

-- Subscriptions: filter by business + status (most common query pattern)
CREATE INDEX IF NOT EXISTS idx_subscriptions_business_status
  ON subscriptions(business_id, status);

-- Subscriptions: unique active subscription per business (data integrity)
CREATE UNIQUE INDEX IF NOT EXISTS idx_subscriptions_one_active_per_business
  ON subscriptions(business_id)
  WHERE status = 'active';

-- Token usage: current cycle lookup
CREATE INDEX IF NOT EXISTS idx_token_usage_business_cycle
  ON token_usage(business_id, billing_cycle_start DESC);

-- Orders: filter by business + status
CREATE INDEX IF NOT EXISTS idx_orders_business_status
  ON orders(business_id, payment_status);

-- Orders: pending orders by conversation (for duplicate check)
CREATE INDEX IF NOT EXISTS idx_orders_conversation_pending
  ON orders(conversation_id, payment_status)
  WHERE payment_status = 'pending';

-- Messages: conversation thread lookup
CREATE INDEX IF NOT EXISTS idx_messages_conversation_created
  ON messages(conversation_id, created_at DESC);

-- Conversations: active conversations per business
CREATE INDEX IF NOT EXISTS idx_conversations_business_active
  ON conversations(business_id, status)
  WHERE status = 'active';
