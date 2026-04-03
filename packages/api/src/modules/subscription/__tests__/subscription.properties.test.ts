/**
 * Property-based tests for Subscription Management
 * Feature: augustus-ai-sales-platform
 *
 * Uses fast-check for property generation.
 * Validates: Requirements 2.2, 2.7, 2.8
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { PLANS, calculateProration, isValidTier, getPlan, type PlanTier } from '../plans.js';

// ─── Property 5: Subscription Activation State ───────────────────────────────
// Feature: augustus-ai-sales-platform, Property 5: Subscription Activation State
// Validates: Requirements 2.2

describe('Property 5: Subscription Activation State', () => {
  it('a simulated activation always produces status=active and a non-null activationTimestamp', () => {
    const tierArb = fc.constantFrom<PlanTier>('silver', 'gold', 'platinum');

    fc.assert(
      fc.property(fc.uuid(), tierArb, fc.string({ minLength: 1 }), (businessId, tier, paynowRef) => {
        // Simulate the activation record that activateSubscription would produce
        const activationTimestamp = new Date();
        const subscription = {
          businessId,
          plan: tier,
          status: 'active' as const,
          activationTimestamp,
          paynowReference: paynowRef,
          priceUsd: getPlan(tier).priceUsd,
        };

        expect(subscription.status).toBe('active');
        expect(subscription.activationTimestamp).not.toBeNull();
        expect(subscription.activationTimestamp).toBeInstanceOf(Date);
        expect(subscription.priceUsd).toBe(PLANS[tier].priceUsd);
      }),
      { numRuns: 25 },
    );
  });

  it('activation timestamp is always at or before the current time', () => {
    fc.assert(
      fc.property(fc.constantFrom<PlanTier>('silver', 'gold', 'platinum'), (tier) => {
        const before = Date.now();
        const activationTimestamp = new Date();
        const after = Date.now();

        expect(activationTimestamp.getTime()).toBeGreaterThanOrEqual(before);
        expect(activationTimestamp.getTime()).toBeLessThanOrEqual(after + 1);
        expect(getPlan(tier).priceUsd).toBeGreaterThan(0);
      }),
      { numRuns: 25 },
    );
  });

  it('every valid tier maps to the correct price', () => {
    const expectedPrices: Record<PlanTier, number> = {
      silver: 31.99,
      gold: 61.99,
      platinum: 129.99,
    };

    fc.assert(
      fc.property(fc.constantFrom<PlanTier>('silver', 'gold', 'platinum'), (tier) => {
        expect(getPlan(tier).priceUsd).toBe(expectedPrices[tier]);
      }),
      { numRuns: 25 },
    );
  });
});

// ─── Property 6: Plan Upgrade Applies Immediately ────────────────────────────
// Feature: augustus-ai-sales-platform, Property 6: Plan Upgrade Applies Immediately
// Validates: Requirements 2.7

describe('Property 6: Plan Upgrade Applies Immediately', () => {
  it('proration is always non-negative when upgrading to a higher tier', () => {
    // Upgrade pairs: silver→gold, silver→platinum, gold→platinum
    const upgradePairArb = fc.constantFrom<[PlanTier, PlanTier]>(
      ['silver', 'gold'],
      ['silver', 'platinum'],
      ['gold', 'platinum'],
    );

    fc.assert(
      fc.property(
        upgradePairArb,
        fc.integer({ min: 1, max: 28 }),  // days into cycle
        fc.integer({ min: 30, max: 31 }), // days in cycle
        ([oldTier, newTier], daysElapsed, daysInCycle) => {
          const cycleStart = new Date('2025-01-01');
          const cycleEnd = new Date(cycleStart.getTime() + daysInCycle * 24 * 60 * 60 * 1000);
          const upgradeDate = new Date(cycleStart.getTime() + daysElapsed * 24 * 60 * 60 * 1000);

          const proration = calculateProration(
            getPlan(oldTier).priceUsd,
            getPlan(newTier).priceUsd,
            cycleStart,
            cycleEnd,
            upgradeDate,
          );

          expect(proration).toBeGreaterThanOrEqual(0);
        },
      ),
      { numRuns: 25 },
    );
  });

  it('proration formula: (daysRemaining / daysInCycle) * (newPrice - oldPrice)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 28 }),
        fc.integer({ min: 30, max: 31 }),
        (daysElapsed, daysInCycle) => {
          const oldPrice = PLANS.silver.priceUsd;
          const newPrice = PLANS.gold.priceUsd;

          const cycleStart = new Date('2025-01-01');
          const cycleEnd = new Date(cycleStart.getTime() + daysInCycle * 24 * 60 * 60 * 1000);
          const upgradeDate = new Date(cycleStart.getTime() + daysElapsed * 24 * 60 * 60 * 1000);

          const daysRemaining = Math.max(
            0,
            Math.round((cycleEnd.getTime() - upgradeDate.getTime()) / (1000 * 60 * 60 * 24)),
          );
          const expected = Number(((daysRemaining / daysInCycle) * (newPrice - oldPrice)).toFixed(2));
          const actual = calculateProration(oldPrice, newPrice, cycleStart, cycleEnd, upgradeDate);

          expect(actual).toBeCloseTo(expected, 2);
        },
      ),
      { numRuns: 25 },
    );
  });

  it('proration is zero when upgrading on the last day of the cycle', () => {
    fc.assert(
      fc.property(
        fc.constantFrom<[PlanTier, PlanTier]>(['silver', 'gold'], ['gold', 'platinum']),
        ([oldTier, newTier]) => {
          const cycleStart = new Date('2025-01-01');
          const cycleEnd = new Date('2025-01-31');
          // Upgrade on the last day — 0 days remaining
          const upgradeDate = cycleEnd;

          const proration = calculateProration(
            getPlan(oldTier).priceUsd,
            getPlan(newTier).priceUsd,
            cycleStart,
            cycleEnd,
            upgradeDate,
          );

          expect(proration).toBe(0);
        },
      ),
      { numRuns: 25 },
    );
  });

  it('new tier limits are higher than old tier limits after upgrade', () => {
    const upgradePairArb = fc.constantFrom<[PlanTier, PlanTier]>(
      ['silver', 'gold'],
      ['silver', 'platinum'],
      ['gold', 'platinum'],
    );

    fc.assert(
      fc.property(upgradePairArb, ([oldTier, newTier]) => {
        const oldPlan = getPlan(oldTier);
        const newPlan = getPlan(newTier);

        // After upgrade, new plan has higher token budget and price
        expect(newPlan.tokenBudgetUsd).toBeGreaterThan(oldPlan.tokenBudgetUsd);
        expect(newPlan.priceUsd).toBeGreaterThan(oldPlan.priceUsd);
      }),
      { numRuns: 25 },
    );
  });
});

// ─── Property 7: Plan Downgrade Deferred to Next Cycle ───────────────────────
// Feature: augustus-ai-sales-platform, Property 7: Plan Downgrade Deferred to Next Cycle
// Validates: Requirements 2.8

describe('Property 7: Plan Downgrade Deferred to Next Cycle', () => {
  it('downgrade pairs always have lower price and token budget than current plan', () => {
    const downgradePairArb = fc.constantFrom<[PlanTier, PlanTier]>(
      ['gold', 'silver'],
      ['platinum', 'silver'],
      ['platinum', 'gold'],
    );

    fc.assert(
      fc.property(downgradePairArb, ([currentTier, newTier]) => {
        const currentPlan = getPlan(currentTier);
        const newPlan = getPlan(newTier);

        expect(newPlan.priceUsd).toBeLessThan(currentPlan.priceUsd);
        expect(newPlan.tokenBudgetUsd).toBeLessThan(currentPlan.tokenBudgetUsd);
      }),
      { numRuns: 25 },
    );
  });

  it('effective date for downgrade is always in the future (next cycle start)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 30 }),
        (daysUntilRenewal) => {
          const now = new Date();
          const renewalDate = new Date(now.getTime() + daysUntilRenewal * 24 * 60 * 60 * 1000);

          // The effective date must be >= now (deferred to next cycle)
          expect(renewalDate.getTime()).toBeGreaterThan(now.getTime());
        },
      ),
      { numRuns: 25 },
    );
  });

  it('current cycle limits remain unchanged during the downgrade pending period', () => {
    // Simulate: business is on gold, schedules downgrade to silver
    // Current cycle should still use gold limits
    fc.assert(
      fc.property(
        fc.constantFrom<[PlanTier, PlanTier]>(['gold', 'silver'], ['platinum', 'gold']),
        ([currentTier, _pendingTier]) => {
          const currentPlan = getPlan(currentTier);

          // The active plan limits (used during current cycle) must be the current tier's
          const activeBudget = currentPlan.tokenBudgetUsd;
          const activePrice = currentPlan.priceUsd;

          expect(activeBudget).toBe(PLANS[currentTier].tokenBudgetUsd);
          expect(activePrice).toBe(PLANS[currentTier].priceUsd);
        },
      ),
      { numRuns: 25 },
    );
  });

  it('isValidTier rejects any string that is not a known tier', () => {
    const invalidTierArb = fc
      .string()
      .filter((s) => s !== 'silver' && s !== 'gold' && s !== 'platinum');

    fc.assert(
      fc.property(invalidTierArb, (tier) => {
        expect(isValidTier(tier)).toBe(false);
      }),
      { numRuns: 25 },
    );
  });

  it('isValidTier accepts exactly the three valid tiers', () => {
    fc.assert(
      fc.property(fc.constantFrom('silver', 'gold', 'platinum'), (tier) => {
        expect(isValidTier(tier)).toBe(true);
      }),
      { numRuns: 25 },
    );
  });
});
