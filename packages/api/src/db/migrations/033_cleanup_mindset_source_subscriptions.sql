-- Migration: 033_cleanup_mindset_source_subscriptions.sql
-- Corrective migration: ensure mindset.skill.growth@gmail.com has NO active
-- subscriptions after the transfer in migration 031.
--
-- The source account may still appear in active subscription lists if:
--   a) The subscription transfer in 031 left behind other active subscription rows, OR
--   b) The subscription was re-created by another process after the transfer.
--
-- This migration cancels ALL active subscriptions on the source account and
-- sets the business status to 'pending_verification' so it does not appear
-- as an active subscriber in the admin dashboard.

DO $$
DECLARE
  v_source_id UUID;
  v_now       TIMESTAMPTZ := NOW();
  v_cancelled INT;
BEGIN
  -- Resolve source business ID
  SELECT id INTO v_source_id
  FROM businesses
  WHERE email = 'mindset.skill.growth@gmail.com';

  IF v_source_id IS NULL THEN
    RAISE NOTICE 'Source business not found: mindset.skill.growth@gmail.com — nothing to do.';
    RETURN;
  END IF;

  RAISE NOTICE 'Source business_id: %', v_source_id;

  -- Cancel ALL active subscriptions on the source account
  UPDATE subscriptions
  SET status = 'cancelled', updated_at = v_now
  WHERE business_id = v_source_id
    AND status = 'active';

  GET DIAGNOSTICS v_cancelled = ROW_COUNT;
  RAISE NOTICE 'Cancelled % active subscription(s) on source account.', v_cancelled;

  -- Also cancel any suspended subscriptions to fully clean up
  UPDATE subscriptions
  SET status = 'cancelled', updated_at = v_now
  WHERE business_id = v_source_id
    AND status = 'suspended';

  -- Set business status to pending_verification so it does not appear as
  -- an active subscriber. The account is preserved so the owner can log in
  -- and subscribe again if needed.
  UPDATE businesses
  SET status = 'pending_verification', updated_at = v_now
  WHERE id = v_source_id;

  RAISE NOTICE 'Source account mindset.skill.growth@gmail.com:';
  RAISE NOTICE '  - All active/suspended subscriptions cancelled';
  RAISE NOTICE '  - Business status set to pending_verification';
  RAISE NOTICE '  - Account preserved (owner can still log in)';
END $$;
