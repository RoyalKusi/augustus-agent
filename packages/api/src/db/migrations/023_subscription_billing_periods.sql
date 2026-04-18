-- Subscription billing periods — admin-configurable multi-month options with discounts
CREATE TABLE subscription_billing_periods (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  months           INT NOT NULL CHECK (months > 0),
  discount_percent NUMERIC(5, 2) NOT NULL DEFAULT 0 CHECK (discount_percent >= 0 AND discount_percent < 100),
  is_active        BOOLEAN NOT NULL DEFAULT TRUE,
  label            VARCHAR(64),          -- e.g. "3 Months", "Best Value"
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (months)
);

-- Seed default periods
INSERT INTO subscription_billing_periods (months, discount_percent, is_active, label) VALUES
  (3,  5.00,  TRUE, '3 Months'),
  (6,  10.00, TRUE, '6 Months'),
  (12, 15.00, TRUE, '12 Months — Best Value'),
  (24, 20.00, TRUE, '24 Months — Max Savings')
ON CONFLICT (months) DO NOTHING;

-- Track which billing period was used on each subscription payment
ALTER TABLE subscription_payments
  ADD COLUMN IF NOT EXISTS billing_months INT NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS discount_percent NUMERIC(5, 2) NOT NULL DEFAULT 0;

-- Track billing period on the subscription itself so renewal knows the cycle length
ALTER TABLE subscriptions
  ADD COLUMN IF NOT EXISTS billing_months INT NOT NULL DEFAULT 1;
