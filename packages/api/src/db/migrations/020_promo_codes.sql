-- Migration: 020_promo_codes.sql
-- Promo codes for subscription plan discounts

CREATE TABLE IF NOT EXISTS promo_codes (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code            VARCHAR(32) NOT NULL UNIQUE,
  description     VARCHAR(255),
  discount_type   VARCHAR(16) NOT NULL CHECK (discount_type IN ('percent', 'fixed')),
  discount_value  NUMERIC(10, 2) NOT NULL CHECK (discount_value > 0),
  applicable_tiers TEXT[] NOT NULL DEFAULT '{}',  -- empty = all tiers
  max_uses        INT,                             -- NULL = unlimited
  uses_count      INT NOT NULL DEFAULT 0,
  valid_from      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  valid_until     TIMESTAMPTZ,                     -- NULL = no expiry
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_by      VARCHAR(255) NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS promo_code_redemptions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  promo_code_id   UUID NOT NULL REFERENCES promo_codes(id) ON DELETE CASCADE,
  business_id     UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  tier            VARCHAR(16) NOT NULL,
  original_price  NUMERIC(10, 2) NOT NULL,
  discounted_price NUMERIC(10, 2) NOT NULL,
  discount_amount NUMERIC(10, 2) NOT NULL,
  paynow_reference VARCHAR(255),
  redeemed_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (promo_code_id, business_id)  -- one redemption per business per code
);

CREATE INDEX IF NOT EXISTS idx_promo_codes_code ON promo_codes(code);
CREATE INDEX IF NOT EXISTS idx_promo_redemptions_code ON promo_code_redemptions(promo_code_id);
CREATE INDEX IF NOT EXISTS idx_promo_redemptions_business ON promo_code_redemptions(business_id);
