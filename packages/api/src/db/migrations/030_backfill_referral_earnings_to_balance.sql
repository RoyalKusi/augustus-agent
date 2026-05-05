-- Migration: 030_backfill_referral_earnings_to_balance.sql
-- Backfill existing referral earnings into revenue_balances so affiliates
-- who already earned commissions can see and withdraw them.
-- Going forward, earnings.service.ts credits revenue_balances on each calculation.

INSERT INTO revenue_balances (business_id, available_usd, lifetime_usd)
SELECT
  r.referrer_id                        AS business_id,
  COALESCE(SUM(r.earnings_usd), 0)     AS available_usd,
  COALESCE(SUM(r.earnings_usd), 0)     AS lifetime_usd
FROM referrals r
WHERE r.earnings_usd IS NOT NULL
  AND r.earnings_usd > 0
GROUP BY r.referrer_id
ON CONFLICT (business_id) DO UPDATE
  SET available_usd = revenue_balances.available_usd + EXCLUDED.available_usd,
      lifetime_usd  = revenue_balances.lifetime_usd  + EXCLUDED.lifetime_usd,
      updated_at    = NOW();
