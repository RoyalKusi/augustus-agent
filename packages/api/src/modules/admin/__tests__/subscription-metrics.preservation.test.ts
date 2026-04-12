/**
 * Preservation Property Tests — Subscription Metrics Accuracy
 *
 * These tests verify edge-case behaviors that MUST BE PRESERVED after the fix.
 * They are expected to PASS on unfixed code (confirming baseline behavior).
 *
 * Validates: Requirements 3.1, 3.2, 3.3, 3.4
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fc from 'fast-check';

// ─── Mock the db/client module before importing admin.service ─────────────────

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

// ─── Mock routing helper ──────────────────────────────────────────────────────

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
  tierRows: Array<{ tier: string; count: string; mrr: string }>,
  churnCount: string,
  utilRows: Array<{ plan: string; avg_utilisation_pct: string }>,
) {
  mockQuery.mockImplementation((sql: string) => {
    const s = typeof sql === 'string' ? sql : '';
    // Call 2: MRR from subscription_payments (fixed code path)
    if (s.includes('subscription_payments') && s.includes('paid')) {
      return Promise.resolve({ rows: tierRows.map(r => ({ tier: r.tier, mrr: r.mrr })) });
    }
    // Call 4: utilisation — new per-tier query with avg_utilisation_pct
    if (s.includes('avg_utilisation_pct') || (s.includes('token_usage') && s.includes('GROUP BY s.plan'))) {
      return Promise.resolve({ rows: utilRows });
    }
    // Call 1: count query — hits subscriptions, groups by plan
    if (s.includes('subscriptions') && s.includes('GROUP BY plan') && !s.includes('token_usage') && !s.includes('SUM(price_usd)')) {
      return Promise.resolve({ rows: tierRows.map(r => ({ tier: r.tier, count: r.count })) });
    }
    // Unfixed code path: SUM(price_usd) from subscriptions
    if (s.includes('SUM(price_usd)') || (s.includes('subscriptions') && s.includes('GROUP BY plan') && !s.includes('token_usage'))) {
      return Promise.resolve({ rows: tierRows });
    }
    // Call 3: churn count
    if (
      s.includes("status IN ('cancelled', 'suspended')") ||
      s.includes("status IN ('cancelled','suspended')") ||
      (s.includes('subscriptions') && s.includes('cancelled'))
    ) {
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

describe('Preservation: getSubscriptionMetrics', () => {
  beforeEach(() => {
    mockQuery.mockReset();
  });

  /**
   * Test 1 — Empty tier returns zero count and zero MRR
   *
   * Validates: Requirement 3.1
   * When there are no active subscriptions for a tier, the system must return
   * count: 0 and mrr: 0 for that tier without errors.
   *
   * Expected: PASSES on unfixed code (baseline behavior preserved)
   */
  it('Test 1: Empty tier (silver) returns count=0 and mrr=0', async () => {
    // No silver rows returned — only gold and platinum
    makePoolMock(
      [
        { tier: 'gold', count: '2', mrr: '30' },
        { tier: 'platinum', count: '1', mrr: '50' },
      ],
      '0',
      [
        { plan: 'gold', avg_utilisation_pct: '0' },
        { plan: 'platinum', avg_utilisation_pct: '0' },
      ],
    );

    const result = await getSubscriptionMetrics();

    expect(result.perTier.silver.count).toBe(0);
    expect(result.perTier.silver.mrr).toBe(0);
  });

  /**
   * Test 2 — Missing token_usage defaults to 0% utilisation
   *
   * Validates: Requirement 3.3
   * When a business has no token_usage records, its credit utilisation must be
   * treated as 0% without crashing or producing NaN.
   *
   * Expected: PASSES on unfixed code (baseline behavior preserved)
   */
  it('Test 2: Active subscription with no token_usage row returns avgCreditUtilisationPercent=0 (not NaN)', async () => {
    // Utilisation query returns a row with accumulated_cost_usd=0 (COALESCE result)
    makePoolMock(
      [{ tier: 'silver', count: '1', mrr: '5' }],
      '0',
      [{ plan: 'silver', avg_utilisation_pct: '0' }],
    );

    const result = await getSubscriptionMetrics();

    expect(result.avgCreditUtilisationPercent).toBe(0);
    expect(Number.isNaN(result.avgCreditUtilisationPercent)).toBe(false);
    expect(result.avgCreditUtilisationPercent).not.toBeUndefined();
  });

  /**
   * Test 3 — Churn count is correct
   *
   * Validates: Requirement 3.2
   * Subscriptions cancelled or suspended this month must be counted in churnCount.
   *
   * Expected: PASSES on unfixed code (baseline behavior preserved)
   */
  it('Test 3: Churn count reflects subscriptions cancelled/suspended this month', async () => {
    makePoolMock(
      [],   // no active subscriptions
      '3',  // 3 churned this month
      [],
    );

    const result = await getSubscriptionMetrics();

    expect(result.churnCount).toBe(3);
  });

  /**
   * Test 4 — Response shape conforms to SubscriptionMetricsData
   *
   * Validates: Requirement 3.4
   * The response must always contain all required fields so the frontend
   * requires no structural changes.
   *
   * Expected: PASSES on unfixed code (baseline behavior preserved)
   */
  it('Test 4: Response shape has all required SubscriptionMetricsData fields', async () => {
    makePoolMock(
      [
        { tier: 'silver', count: '2', mrr: '10' },
        { tier: 'gold', count: '1', mrr: '15' },
        { tier: 'platinum', count: '1', mrr: '50' },
      ],
      '1',
      [
        { plan: 'silver', avg_utilisation_pct: '40' },
        { plan: 'gold', avg_utilisation_pct: '46.7' },
        { plan: 'platinum', avg_utilisation_pct: '40' },
      ],
    );

    const result = await getSubscriptionMetrics();

    // Top-level required fields
    expect(result).toHaveProperty('perTier');
    expect(result).toHaveProperty('totalMrr');
    expect(result).toHaveProperty('churnCount');
    expect(result).toHaveProperty('avgCreditUtilisationPercent');

    // perTier must have silver, gold, platinum
    expect(result.perTier).toHaveProperty('silver');
    expect(result.perTier).toHaveProperty('gold');
    expect(result.perTier).toHaveProperty('platinum');

    // Each tier must have count (number) and mrr (number)
    for (const tier of ['silver', 'gold', 'platinum'] as const) {
      expect(typeof result.perTier[tier].count).toBe('number');
      expect(typeof result.perTier[tier].mrr).toBe('number');
    }

    // Numeric fields must be numbers (not NaN, not undefined)
    expect(typeof result.totalMrr).toBe('number');
    expect(typeof result.churnCount).toBe('number');
    expect(typeof result.avgCreditUtilisationPercent).toBe('number');
    expect(Number.isNaN(result.totalMrr)).toBe(false);
    expect(Number.isNaN(result.churnCount)).toBe(false);
    expect(Number.isNaN(result.avgCreditUtilisationPercent)).toBe(false);
  });

  /**
   * Property-based Test 5 — totalMrr equals sum of per-tier MRR
   *
   * **Validates: Requirements 3.1, 3.4**
   *
   * For any random combination of tier rows, totalMrr must always equal
   * the sum of perTier.silver.mrr + perTier.gold.mrr + perTier.platinum.mrr.
   *
   * Expected: PASSES on unfixed code (this invariant holds regardless of the MRR bug)
   */
  it('Property 5: totalMrr always equals sum of per-tier MRR values', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate random mrr values for each tier (0 to 1000, 1 decimal place)
        fc.record({
          silverMrr: fc.integer({ min: 0, max: 1000 }),
          goldMrr: fc.integer({ min: 0, max: 1000 }),
          platinumMrr: fc.integer({ min: 0, max: 1000 }),
          silverCount: fc.integer({ min: 0, max: 50 }),
          goldCount: fc.integer({ min: 0, max: 50 }),
          platinumCount: fc.integer({ min: 0, max: 50 }),
        }),
        async ({ silverMrr, goldMrr, platinumMrr, silverCount, goldCount, platinumCount }) => {
          mockQuery.mockReset();

          const tierRows: Array<{ tier: string; count: string; mrr: string }> = [];
          if (silverCount > 0 || silverMrr > 0) {
            tierRows.push({ tier: 'silver', count: String(silverCount), mrr: String(silverMrr) });
          }
          if (goldCount > 0 || goldMrr > 0) {
            tierRows.push({ tier: 'gold', count: String(goldCount), mrr: String(goldMrr) });
          }
          if (platinumCount > 0 || platinumMrr > 0) {
            tierRows.push({ tier: 'platinum', count: String(platinumCount), mrr: String(platinumMrr) });
          }

          makePoolMock(tierRows, '0', []);

          const result = await getSubscriptionMetrics();

          const expectedTotal = result.perTier.silver.mrr + result.perTier.gold.mrr + result.perTier.platinum.mrr;
          expect(result.totalMrr).toBe(expectedTotal);
        },
      ),
      { numRuns: 50 },
    );
  });
});
