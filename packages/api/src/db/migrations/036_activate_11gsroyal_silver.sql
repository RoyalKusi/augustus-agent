-- Migration 036: Activate silver subscription for 11gsroyal@gmail.com
-- Idempotent — skips if an active subscription already exists.
-- Cancels any stale non-active subscriptions first to keep records clean.
-- Renewal: 1 month from migration run date.

DO $$
DECLARE
  v_business_id UUID;
  v_sub_id      UUID;
  v_now         TIMESTAMPTZ := NOW();
  v_renewal     DATE        := (NOW() + INTERVAL '1 month')::DATE;
  v_cycle_start DATE        := NOW()::DATE;
BEGIN
  -- Resolve business
  SELECT id INTO v_business_id
  FROM businesses
  WHERE email = '11gsroyal@gmail.com'
  LIMIT 1;

  IF v_business_id IS NULL THEN
    RAISE NOTICE '[036] Business 11gsroyal@gmail.com not found — skipping.';
    RETURN;
  END IF;

  -- Skip if already active
  IF EXISTS (
    SELECT 1 FROM subscriptions
    WHERE business_id = v_business_id AND status = 'active'
  ) THEN
    RAISE NOTICE '[036] 11gsroyal@gmail.com already has an active subscription — skipping.';
    RETURN;
  END IF;

  -- Cancel any lingering suspended/cancelled rows so the account is clean
  UPDATE subscriptions
  SET status = 'cancelled', updated_at = v_now
  WHERE business_id = v_business_id AND status NOT IN ('active', 'cancelled');

  -- Activate business account
  UPDATE businesses
  SET status = 'active', updated_at = v_now
  WHERE id = v_business_id;

  -- Insert new active silver subscription
  INSERT INTO subscriptions
    (business_id, plan, price_usd, status, activation_timestamp,
     renewal_date, billing_cycle_start, paynow_reference, billing_months)
  VALUES
    (v_business_id, 'silver', 31.99, 'active', v_now,
     v_renewal, v_cycle_start, 'MANUAL-ADMIN-036-SILVER', 1)
  RETURNING id INTO v_sub_id;

  -- Initialise token_usage for this billing cycle
  INSERT INTO token_usage (business_id, billing_cycle_start, accumulated_cost_usd,
    alert_80_sent, alert_95_sent, alert_100_sent, suspended,
    input_tokens, output_tokens, message_count)
  VALUES (v_business_id, v_cycle_start, 0, FALSE, FALSE, FALSE, FALSE, 0, 0, 0)
  ON CONFLICT (business_id, billing_cycle_start) DO NOTHING;

  RAISE NOTICE '[036] Silver plan activated for 11gsroyal@gmail.com (business_id=%, subscription_id=%)',
    v_business_id, v_sub_id;
END;
$$;
