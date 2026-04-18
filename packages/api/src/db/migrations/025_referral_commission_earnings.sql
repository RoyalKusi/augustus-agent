-- Referral Commission Earnings System
-- Add commission settings table and earnings tracking to referrals

-- Create referral_commission_settings table
CREATE TABLE IF NOT EXISTS referral_commission_settings (
  id                    SERIAL PRIMARY KEY,
  commission_percentage DECIMAL(5,2) NOT NULL DEFAULT 10.00 
                        CHECK (commission_percentage >= 0 AND commission_percentage <= 100),
  earnings_period_months INTEGER NOT NULL DEFAULT 12 
                        CHECK (earnings_period_months > 0),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed default values: 10% commission, 12-month validity period
INSERT INTO referral_commission_settings (commission_percentage, earnings_period_months)
VALUES (10.00, 12);

-- Add earnings tracking columns to referrals table
ALTER TABLE referrals
  ADD COLUMN IF NOT EXISTS earnings_usd              DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS commission_percentage_used DECIMAL(5,2),
  ADD COLUMN IF NOT EXISTS earnings_calculated_at    TIMESTAMPTZ;

-- Create indexes for query optimization
CREATE INDEX IF NOT EXISTS idx_referrals_created_at ON referrals(created_at);
CREATE INDEX IF NOT EXISTS idx_referrals_status ON referrals(status);
