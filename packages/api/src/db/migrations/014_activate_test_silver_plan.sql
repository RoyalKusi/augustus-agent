-- Migration: 014_activate_test_silver_plan.sql
-- Programmatically activate silver plan for test account: 11gsroyal@gmail.com

DO $$
DECLARE
  v_business_id UUID;
  v_now         TIMESTAMPTZ := NOW();
  v_renewal     DATE        := (NOW() + INTERVAL '1 month')::DATE;
  v_cycle_start DATE        := NOW()::DATE;
BEGIN
  -- Look up the business by email
  SELECT id INTO v_business_id
  FROM businesses
  WHERE email = '11gsroyal@gmail.com'
  LIMIT 1;

  IF v_business_id IS NULL THEN
    RAISE NOTICE 'Business 11gsroyal@gmail.com not found — skipping silver plan activation.';
    RETURN;
  END IF;

  -- Ensure business status is active
  UPDATE businesses
  SET status = 'active', updated_at = v_now
  WHERE id = v_business_id;

  -- Cancel any existing active subscription
  UPDATE subscriptions
  SET status = 'cancelled', updated_at = v_now
  WHERE business_id = v_business_id AND status = 'active';

  -- Insert silver subscription
  INSERT INTO subscriptions
    (business_id, plan, price_usd, status, activation_timestamp, renewal_date, billing_cycle_start, paynow_reference)
  VALUES
    (v_business_id, 'silver', 10.00, 'active', v_now, v_renewal, v_cycle_start, 'test-activation')
  ON CONFLICT DO NOTHING;

  -- Initialise token_usage for this billing cycle
  INSERT INTO token_usage (business_id, billing_cycle_start)
  VALUES (v_business_id, v_cycle_start)
  ON CONFLICT (business_id, billing_cycle_start) DO NOTHING;

  RAISE NOTICE 'Silver plan activated for business % (11gsroyal@gmail.com)', v_business_id;
END;
$$;
