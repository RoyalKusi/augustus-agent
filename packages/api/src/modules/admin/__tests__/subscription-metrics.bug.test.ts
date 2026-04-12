/**
 * Bug Condition Exploration Tests — Subscription Metrics Accuracy
 *
 * These tests are EXPECTED TO FAIL on unfixed code.
 * Failure confirms the bug exists. Do NOT fix the code when these fail.
 *
 * Validates: Requirements 2.1, 2.2, 2.3
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mock the db/client module before importing admin.service ─────────────────
// vi.mock is hoisted, so we must use vi.hoisted to declare the mock fn first.

const { mockQuery } = vi.hoisted(() => {
  return { mockQuery: vi.fn() };
});

vi.mock('../../../db/client.js', () => ({
  pool: {
    query: mockQuery,
  },
}));

// ─── Import after mock is set up ──────────────────────────────────────────────

import { getSubscriptionMetrics } from '../admin.service.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * The fixed function makes 4 pool.query() calls in order:
 *   Call 1: SELECT plan AS tier, COUNT(*) FROM subscriptions WHERE status='active' GROUP BY plan
 *   Call 2: SELECT tier, COALESCE(SUM(amount), 0) AS mrr FROM subscription_payments WHERE status='paid' AND ... GROUP BY tier
 *   Call 3: SELECT COUNT(*) FROM subscriptions WHERE status IN ('cancelled','suspended') AND updated_at >= ...
 *   Call 4: SELECT s.plan, accumulated_cost_usd FROM subscriptions s LEFT JOIN token_usage tu ...
 *
 * We inspect the SQL string to route each call to the right mock data.
 */
function makePoolMock(
  countRows: Array<{ tier: string; count: string }>,
  mrrRows: Array<{ tier: string; mrr: string }>,
  churnCount: string,
  utilRows: Array<{ plan: string; avg_utilisation_pct: string }>,
) {
  mockQuery.mockImplementation((sql: string) => {
    const s = typeof sql === 'string' ? sql : '';
    // Call 2: MRR from subscription_payments (fixed code path)
    if (s.includes('subscription_payments') && s.includes('paid')) {
      return Promise.resolve({ rows: mrrRows });
    }
    // Call 4: utilisation — new per-tier query with avg_utilisation_pct
    if (s.includes('avg_utilisation_pct') || (s.includes('token_usage') && s.includes('GROUP BY s.plan'))) {
      return Promise.resolve({ rows: utilRows });
    }
    // Call 1: count query — hits subscriptions, groups by plan (no token_usage, no SUM(price_usd))
    if (s.includes('subscriptions') && s.includes('GROUP BY plan') && !s.includes('token_usage') && !s.includes('SUM(price_usd)')) {
      return Promise.resolve({ rows: countRows });
    }
    // Unfixed code path: SUM(price_usd) from subscriptions
    if (s.includes('SUM(price_usd)')) {
      return Promise.resolve({ rows: countRows });
    }
    // Call 3: churn count
    if (s.includes("status IN ('cancelled', 'suspended')") || s.includes("status IN ('cancelled','suspended')") || (s.includes('subscriptions') && s.includes('cancelled'))) {
      return Promise.resolve({ rows: [{ count: churnCount }] });
    }
    // Fallback for old token_usage queries
    if (s.includes('token_usage') || s.includes('accumulated_cost_usd')) {
      return Promise.resolve({ rows: utilRows });
    }
    // Fallback
    return Promise.resolve({ rows: [] });
  });
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('Bug Condition Exploration: getSubscriptionMetrics', () => {
  beforeEach(() => {
    mockQuery.mockReset();
  });

  /**
   * Test case 1 — MRR from confirmed payments
   *
   * Setup:
   *   - subscription_payments: { status: 'paid', amount: 7.00, tier: 'silver' } (current month)
   *   - subscriptions: { plan: 'silver', status: 'active', price_usd: 5.00 }
   *
   * Expected: perTier.silver.mrr === 7
   * Unfixed code returns: 5 (from price_usd) — TEST FAILS as expected
   */
  it('Test 1: MRR should come from confirmed payments (paid amount=7), not price_usd (5)', async () => {
    makePoolMock(
      [{ tier: 'silver', count: '1' }],          // count from subscriptions
      [{ tier: 'silver', mrr: '7' }],             // mrr from subscription_payments (paid amount=7)
      '0',
      [{ plan: 'silver', avg_utilisation_pct: '0' }],
    );

    const result = await getSubscriptionMetrics();

    expect(result.perTier.silver.mrr).toBe(7);
  });

  /**
   * Test case 2 — MRR excludes non-paid payments
   *
   * Setup:
   *   - subscription_payments: { status: 'pending', amount: 5.00, tier: 'silver' }
   *   - subscriptions: { plan: 'silver', status: 'active', price_usd: 5.00 }
   *
   * Expected: perTier.silver.mrr === 0 (pending payment should not count)
   * Unfixed code returns: 5 (from price_usd regardless of payment status) — TEST FAILS as expected
   */
  it('Test 2: MRR should be 0 when only pending payments exist (not price_usd=5)', async () => {
    makePoolMock(
      [{ tier: 'silver', count: '1' }],           // count from subscriptions (active)
      [],                                          // no paid payments → mrr=0 for all tiers
      '0',
      [{ plan: 'silver', avg_utilisation_pct: '0' }],
    );

    const result = await getSubscriptionMetrics();

    expect(result.perTier.silver.mrr).toBe(0);
  });

  /**
   * Test case 3 — Per-tier utilisation uses actual cap (price_usd)
   *
   * Setup:
   *   - subscriptions: { plan: 'gold', status: 'active', price_usd: 20.00 }
   *   - token_usage: { accumulated_cost_usd: 10.00 }
   *
   * Expected: perTier.gold.avgCreditUtilisationPercent === 50
   *   (10 / 20 * 100 = 50%)
   * Unfixed code uses hardcoded cap of 15 → 10/15*100 ≈ 66.7 — TEST FAILS as expected
   */
  it('Test 3: Per-tier utilisation should use actual price_usd cap (20), not hardcoded cap (15)', async () => {
    makePoolMock(
      [{ tier: 'gold', count: '1' }],
      [{ tier: 'gold', mrr: '20' }],
      '0',
      [{ plan: 'gold', avg_utilisation_pct: '50' }],  // 10/20*100 = 50%
    );

    const result = await getSubscriptionMetrics();

    // Unfixed code: (10 / 15) * 100 ≈ 66.7 — not 50
    // Fixed code:   (10 / 20) * 100 = 50
    // This assertion FAILS on unfixed code
    const goldUtil = (result as unknown as { perTier: { gold: { avgCreditUtilisationPercent: number } } })
      .perTier.gold.avgCreditUtilisationPercent;
    expect(goldUtil).toBe(50);
  });

  /**
   * Test case 4 — Utilisation isolation per tier
   *
   * Setup:
   *   - Silver subscriber: accumulated_cost_usd=1, price_usd=5 → 20% utilisation
   *   - Gold subscriber:   accumulated_cost_usd=8, price_usd=10 → 80% utilisation
   *
   * Expected: perTier.silver.avgCreditUtilisationPercent !== perTier.gold.avgCreditUtilisationPercent
   * Unfixed code: both tiers return the same global average (50%) — TEST FAILS as expected
   */
  it('Test 4: Silver and gold utilisation should be independent (not the same global average)', async () => {
    makePoolMock(
      [
        { tier: 'silver', count: '1' },
        { tier: 'gold', count: '1' },
      ],
      [
        { tier: 'silver', mrr: '5' },
        { tier: 'gold', mrr: '10' },
      ],
      '0',
      [
        { plan: 'silver', avg_utilisation_pct: '20' },  // 1/5*100 = 20%
        { plan: 'gold', avg_utilisation_pct: '80' },    // 8/10*100 = 80%
      ],
    );

    const result = await getSubscriptionMetrics();

    // Unfixed code computes a single global average across all rows:
    //   silver: 1/5 * 100 = 20 (using TIER_CAPS[silver]=5)
    //   gold:   8/15 * 100 ≈ 53.3 (using TIER_CAPS[gold]=15, not price_usd=10)
    //   global avg ≈ (20 + 53.3) / 2 ≈ 36.7 — same value for both tiers
    //
    // Fixed code returns per-tier values: silver=20, gold=80
    // This assertion FAILS on unfixed code because perTier doesn't have per-tier util

    const perTier = (result as unknown as {
      perTier: {
        silver: { avgCreditUtilisationPercent: number };
        gold: { avgCreditUtilisationPercent: number };
      };
    }).perTier;

    expect(perTier.silver.avgCreditUtilisationPercent).not.toBe(perTier.gold.avgCreditUtilisationPercent);
  });
});
