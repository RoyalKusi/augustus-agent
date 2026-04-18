-- Referral system
-- Add referral_enabled flag and unique referral_code to businesses
ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS referral_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS referral_code    VARCHAR(32) UNIQUE;

CREATE INDEX IF NOT EXISTS idx_businesses_referral_code ON businesses(referral_code);

-- Track referrals: who referred whom
CREATE TABLE IF NOT EXISTS referrals (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id     UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  referred_id     UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  referred_email  VARCHAR(255) NOT NULL,
  referred_name   VARCHAR(255) NOT NULL,
  status          VARCHAR(16) NOT NULL DEFAULT 'registered'
                    CHECK (status IN ('registered', 'subscribed')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (referred_id)  -- a business can only be referred once
);

CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON referrals(referrer_id);
