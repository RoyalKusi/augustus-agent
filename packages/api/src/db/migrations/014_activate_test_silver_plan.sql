-- Migration: 014_activate_test_silver_plan.sql
-- NOTE: This migration activates a test account (11gsroyal@gmail.com) with a Silver plan.
-- This is a development/testing convenience. In production, this account should be
-- managed through the normal subscription flow. The migration is idempotent and will
-- skip if the account already has an active subscription.
-- TO DISABLE: Remove or comment out the INSERT INTO subscriptions block below.

DO $$
DECLARE
  v_business_id UUID;
  v_now         TIMESTAMPTZ := NOW();
  v_renewal     DATE        := (NOW() + INTERVAL '1 month')::DATE;
  v_cycle_start DATE        := NOW()::DATE;
BEGIN
  SELECT id INTO v_business_id
  FROM businesses
  WHERE email = '11gsroyal@gmail.com'
  LIMIT 1;

  IF v_business_id IS NULL THEN
    RAISE NOTICE 'Business 11gsroyal@gmail.com not found — skipping.';
    RETURN;
  END IF;

  -- Only activate if no active subscription already exists
  IF EXISTS (SELECT 1 FROM subscriptions WHERE business_id = v_business_id AND status = 'active') THEN
    RAISE NOTICE 'Business already has an active subscription — skipping.';
    RETURN;
  END IF;

  UPDATE businesses SET status = 'active', updated_at = v_now WHERE id = v_business_id;

  INSERT INTO subscriptions
    (business_id, plan, price_usd, status, activation_timestamp, renewal_date, billing_cycle_start, paynow_reference)
  VALUES
    (v_business_id, 'silver', 31.99, 'active', v_now, v_renewal, v_cycle_start, 'test-activation')
  ON CONFLICT DO NOTHING;

  INSERT INTO token_usage (business_id, billing_cycle_start)
  VALUES (v_business_id, v_cycle_start)
  ON CONFLICT (business_id, billing_cycle_start) DO NOTHING;

  RAISE NOTICE 'Silver plan activated for business % (11gsroyal@gmail.com)', v_business_id;
END;
$$;
