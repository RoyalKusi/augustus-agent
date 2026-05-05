-- Migration: 029_fix_mindset_subscription.sql
-- Manually activate Silver subscription for mindset.skill.growth@gmail.com
-- This account paid via Paynow but the subscription was not recorded
-- (likely due to PAYNOW_RESULT_URL not being set to the correct webhook endpoint)

DO $$
DECLARE
  v_business_id UUID;
  v_now         TIMESTAMPTZ := NOW();
  v_cycle_start DATE        := CURRENT_DATE;
  v_renewal     DATE        := CURRENT_DATE + INTERVAL '1 month';
BEGIN
  -- Get the business ID
  SELECT id INTO v_business_id
  FROM businesses
  WHERE email = 'mindset.skill.growth@gmail.com';

  IF v_business_id IS NULL THEN
    RAISE EXCEPTION 'Business not found: mindset.skill.growth@gmail.com';
  END IF;

  -- Cancel any existing active subscriptions
  UPDATE subscriptions
  SET status = 'cancelled', updated_at = v_now
  WHERE business_id = v_business_id AND status = 'active';

  -- Insert the Silver subscription
  INSERT INTO subscriptions (
    business_id,
    plan,
    price_usd,
    status,
    activation_timestamp,
    renewal_date,
    billing_cycle_start,
    paynow_reference,
    billing_months
  ) VALUES (
    v_business_id,
    'silver',
    31.99,
    'active',
    v_now,
    v_renewal,
    v_cycle_start,
    'MANUAL-ADMIN-FIX-' || to_char(v_now, 'YYYYMMDD'),
    1
  );

  -- Ensure business status is active
  UPDATE businesses
  SET status = 'active', updated_at = v_now
  WHERE id = v_business_id;

  -- Ensure token_usage record exists for this billing cycle
  INSERT INTO token_usage (business_id, billing_cycle_start, accumulated_cost_usd)
  VALUES (v_business_id, v_cycle_start, 0)
  ON CONFLICT (business_id, billing_cycle_start) DO NOTHING;

  RAISE NOTICE 'Successfully activated Silver subscription for business_id: %', v_business_id;
END $$;
