-- Migration: 031_transfer_mindset_subscription_to_manduna.sql
-- Transfer the active Silver subscription from mindset.skill.growth@gmail.com
-- to manduna44@gmail.com. The subscription was seeded on the wrong account
-- (migration 029). This migration corrects that by re-pointing all related
-- records to the correct business and cleaning up the source account.
--
-- Affected tables:
--   subscriptions          — re-point business_id
--   subscription_payments  — re-point business_id
--   token_usage            — re-point business_id (merge if target already has a record)
--
-- Post-conditions:
--   manduna44@gmail.com    → has the active Silver subscription, status = 'active'
--   mindset.skill.growth@gmail.com → no active subscription, status = 'active' (account kept)

DO $$
DECLARE
  v_source_id   UUID;
  v_target_id   UUID;
  v_sub_id      UUID;
  v_cycle_start DATE;
  v_now         TIMESTAMPTZ := NOW();
BEGIN
  -- ── 1. Resolve business IDs ──────────────────────────────────────────────
  SELECT id INTO v_source_id
  FROM businesses
  WHERE email = 'mindset.skill.growth@gmail.com';

  IF v_source_id IS NULL THEN
    RAISE EXCEPTION 'Source business not found: mindset.skill.growth@gmail.com';
  END IF;

  SELECT id INTO v_target_id
  FROM businesses
  WHERE email = 'manduna44@gmail.com';

  IF v_target_id IS NULL THEN
    RAISE EXCEPTION 'Target business not found: manduna44@gmail.com';
  END IF;

  RAISE NOTICE 'Source business_id: %', v_source_id;
  RAISE NOTICE 'Target business_id: %', v_target_id;

  -- ── 2. Locate the active subscription on the source account ─────────────
  SELECT id, billing_cycle_start INTO v_sub_id, v_cycle_start
  FROM subscriptions
  WHERE business_id = v_source_id AND status = 'active'
  LIMIT 1;

  IF v_sub_id IS NULL THEN
    RAISE EXCEPTION 'No active subscription found on source account mindset.skill.growth@gmail.com';
  END IF;

  RAISE NOTICE 'Transferring subscription_id: %', v_sub_id;

  -- ── 3. Cancel any existing active subscription on the target account ─────
  UPDATE subscriptions
  SET status = 'cancelled', updated_at = v_now
  WHERE business_id = v_target_id AND status = 'active';

  -- ── 4. Re-point the subscription to the target business ──────────────────
  UPDATE subscriptions
  SET business_id = v_target_id, updated_at = v_now
  WHERE id = v_sub_id;

  -- ── 5. Re-point subscription_payments to the target business ─────────────
  UPDATE subscription_payments
  SET business_id = v_target_id, updated_at = v_now
  WHERE business_id = v_source_id;

  -- ── 6. Transfer token_usage records ──────────────────────────────────────
  -- If the target already has a token_usage row for the same billing cycle,
  -- merge the accumulated cost rather than creating a duplicate.
  UPDATE token_usage AS src
  SET business_id = v_target_id
  WHERE src.business_id = v_source_id
    AND NOT EXISTS (
      SELECT 1 FROM token_usage tgt
      WHERE tgt.business_id = v_target_id
        AND tgt.billing_cycle_start = src.billing_cycle_start
    );

  -- For any remaining source rows that collide with an existing target row,
  -- add the accumulated cost to the target and delete the source row.
  UPDATE token_usage AS tgt
  SET accumulated_cost_usd = tgt.accumulated_cost_usd + src.accumulated_cost_usd,
      updated_at            = v_now
  FROM token_usage AS src
  WHERE src.business_id = v_source_id
    AND tgt.business_id = v_target_id
    AND tgt.billing_cycle_start = src.billing_cycle_start;

  DELETE FROM token_usage
  WHERE business_id = v_source_id;

  -- ── 7. Activate the target business account ───────────────────────────────
  UPDATE businesses
  SET status = 'active', updated_at = v_now
  WHERE id = v_target_id;

  -- ── 8. Clean up source account — cancel all remaining subscriptions ────────
  -- Cancel any active or suspended subscriptions still on the source account.
  -- The transferred subscription was re-pointed to the target in step 4, but
  -- other subscription rows (e.g. from previous migrations) may still exist.
  UPDATE subscriptions
  SET status = 'cancelled', updated_at = v_now
  WHERE business_id = v_source_id
    AND status IN ('active', 'suspended');

  -- Set business status to pending_verification so the source account does not
  -- appear as an active subscriber in the admin dashboard. The account is kept
  -- so the owner can still log in and subscribe again if needed.
  UPDATE businesses
  SET status = 'pending_verification', updated_at = v_now
  WHERE id = v_source_id;

  RAISE NOTICE 'Subscription transfer complete.';
  RAISE NOTICE '  manduna44@gmail.com                    → active Silver subscription';
  RAISE NOTICE '  mindset.skill.growth@gmail.com         → no active subscription, status = pending_verification';
END $$;
