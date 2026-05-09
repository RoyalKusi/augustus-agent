-- Migration 037: Update token budgets for Claude Sonnet pricing
-- Previous budgets were calibrated for Haiku ($0.25/$1.25 per 1M tokens).
-- New pricing: Sonnet + 10% margin = $3.30/$16.50 per 1M tokens (~13x more expensive).
-- Budgets are updated to reflect realistic Sonnet usage volumes per plan.
--
-- Estimated cost per message (avg 1,000 input + 300 output tokens):
--   Input:  1000 / 1,000,000 * 3.30  = $0.0033
--   Output:  300 / 1,000,000 * 16.50 = $0.00495
--   Total per message ≈ $0.00825
--
-- Silver  $15.00 → ~1,818 messages/month
-- Gold    $40.00 → ~4,848 messages/month
-- Platinum $100.00 → ~12,121 messages/month

-- Update plan_config table (operator-configurable source of truth)
UPDATE plan_config SET token_budget_usd = 15.00,  updated_at = NOW() WHERE tier = 'silver';
UPDATE plan_config SET token_budget_usd = 40.00,  updated_at = NOW() WHERE tier = 'gold';
UPDATE plan_config SET token_budget_usd = 100.00, updated_at = NOW() WHERE tier = 'platinum';

-- Lift any token_usage suspensions where accumulated_cost_usd is now below the new cap.
-- This unblocks accounts that were incorrectly suspended under the old Haiku budget caps.
-- Only lifts suspension for the current billing cycle (most recent row per business).
UPDATE token_usage tu
SET suspended = FALSE, updated_at = NOW()
FROM (
  SELECT DISTINCT ON (business_id) id, business_id, accumulated_cost_usd, billing_cycle_start
  FROM token_usage
  ORDER BY business_id, billing_cycle_start DESC
) latest
JOIN subscriptions s ON s.business_id = latest.business_id AND s.status = 'active'
JOIN plan_config pc ON pc.tier = s.plan
WHERE tu.id = latest.id
  AND tu.suspended = TRUE
  AND latest.accumulated_cost_usd < pc.token_budget_usd;

-- Log how many accounts were unblocked
DO $$
DECLARE
  v_count INT;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM token_usage tu
  JOIN (
    SELECT DISTINCT ON (business_id) id
    FROM token_usage
    ORDER BY business_id, billing_cycle_start DESC
  ) latest ON tu.id = latest.id
  WHERE tu.suspended = FALSE
    AND tu.updated_at >= NOW() - INTERVAL '5 seconds';

  RAISE NOTICE '[037] plan_config budgets updated to Sonnet rates. % account(s) had suspension lifted.', v_count;
END;
$$;
