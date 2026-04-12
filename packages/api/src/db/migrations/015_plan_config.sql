-- Migration: 015_plan_config.sql
-- Operator-configurable plan settings. Seeded with current hardcoded defaults.

CREATE TABLE IF NOT EXISTS plan_config (
  tier              VARCHAR(16) PRIMARY KEY CHECK (tier IN ('silver', 'gold', 'platinum')),
  display_name      VARCHAR(64)    NOT NULL,
  price_usd         NUMERIC(10, 2) NOT NULL,
  token_budget_usd  NUMERIC(10, 2) NOT NULL,
  is_available      BOOLEAN        NOT NULL DEFAULT TRUE,
  updated_at        TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

-- Seed with current defaults
INSERT INTO plan_config (tier, display_name, price_usd, token_budget_usd, is_available)
VALUES
  ('silver',   'Silver',   31.99, 12.00, TRUE),
  ('gold',     'Gold',     61.99, 30.00, TRUE),
  ('platinum', 'Platinum', 129.99, 70.00, TRUE)
ON CONFLICT (tier) DO NOTHING;
