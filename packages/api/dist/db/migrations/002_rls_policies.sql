-- Augustus AI Sales Platform — Row-Level Security Policies
-- Migration: 002_rls_policies.sql

-- Create application role (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'augustus_app') THEN
    CREATE ROLE augustus_app LOGIN PASSWORD 'change_in_production';
  END IF;
END
$$;

-- Grant table access to app role
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO augustus_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO augustus_app;

-- Helper function: returns the current business_id from session config
CREATE OR REPLACE FUNCTION current_business_id() RETURNS UUID AS $$
  SELECT NULLIF(current_setting('app.current_business_id', TRUE), '')::UUID;
$$ LANGUAGE SQL STABLE;

-- ─── Enable RLS on all tenant-scoped tables ───────────────────────────────────

ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE token_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_token_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE promo_combos ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE revenue_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE withdrawal_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE training_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;

-- ─── RLS Policies (idempotent) ────────────────────────────────────────────────

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='subscriptions' AND policyname='subscriptions_business_isolation') THEN
    CREATE POLICY subscriptions_business_isolation ON subscriptions USING (business_id = current_business_id());
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='token_usage' AND policyname='token_usage_business_isolation') THEN
    CREATE POLICY token_usage_business_isolation ON token_usage USING (business_id = current_business_id());
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='business_token_overrides' AND policyname='business_token_overrides_isolation') THEN
    CREATE POLICY business_token_overrides_isolation ON business_token_overrides USING (business_id = current_business_id());
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='whatsapp_integrations' AND policyname='whatsapp_integrations_business_isolation') THEN
    CREATE POLICY whatsapp_integrations_business_isolation ON whatsapp_integrations USING (business_id = current_business_id());
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='products' AND policyname='products_business_isolation') THEN
    CREATE POLICY products_business_isolation ON products USING (business_id = current_business_id());
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='promo_combos' AND policyname='promo_combos_business_isolation') THEN
    CREATE POLICY promo_combos_business_isolation ON promo_combos USING (business_id = current_business_id());
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='conversations' AND policyname='conversations_business_isolation') THEN
    CREATE POLICY conversations_business_isolation ON conversations USING (business_id = current_business_id());
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='messages' AND policyname='messages_business_isolation') THEN
    CREATE POLICY messages_business_isolation ON messages USING (business_id = current_business_id());
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='orders' AND policyname='orders_business_isolation') THEN
    CREATE POLICY orders_business_isolation ON orders USING (business_id = current_business_id());
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='revenue_balances' AND policyname='revenue_balances_business_isolation') THEN
    CREATE POLICY revenue_balances_business_isolation ON revenue_balances USING (business_id = current_business_id());
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='withdrawal_requests' AND policyname='withdrawal_requests_business_isolation') THEN
    CREATE POLICY withdrawal_requests_business_isolation ON withdrawal_requests USING (business_id = current_business_id());
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='training_data' AND policyname='training_data_business_isolation') THEN
    CREATE POLICY training_data_business_isolation ON training_data USING (business_id = current_business_id());
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='support_tickets' AND policyname='support_tickets_business_isolation') THEN
    CREATE POLICY support_tickets_business_isolation ON support_tickets USING (business_id = current_business_id());
  END IF;
END $$;
