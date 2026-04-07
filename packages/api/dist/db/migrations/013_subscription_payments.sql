-- Migration: 013_subscription_payments.sql
-- Track pending subscription Paynow payments so webhooks can resolve businessId + tier

CREATE TABLE IF NOT EXISTS subscription_payments (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id       UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  tier              VARCHAR(16) NOT NULL,
  paynow_reference  VARCHAR(255) NOT NULL UNIQUE,
  poll_url          TEXT,
  status            VARCHAR(16) NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending', 'paid', 'failed', 'cancelled')),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subscription_payments_business ON subscription_payments(business_id);
CREATE INDEX IF NOT EXISTS idx_subscription_payments_reference ON subscription_payments(paynow_reference);
