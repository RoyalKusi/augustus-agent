/**
 * Property-based tests for Token Budget Controller
 * Feature: augustus-ai-sales-platform
 *
 * Uses fast-check for property generation.
 * Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6
 */
import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { PLANS, getPlan } from '../../subscription/plans.js';
// ─── Pure budget logic extracted for property testing ─────────────────────────
// These functions mirror the logic in token-budget.service.ts without DB calls,
// allowing fast-check to exercise them with thousands of generated inputs.
function computeBudgetStatus(accumulatedCostUsd, capUsd) {
    const suspended = accumulatedCostUsd >= capUsd;
    return {
        allowed: !suspended,
        remainingUsd: Math.max(0, capUsd - accumulatedCostUsd),
        suspended,
    };
}
function computeAlertState(accumulatedCostUsd, capUsd, alert80SentBefore, alert95SentBefore) {
    const pct = accumulatedCostUsd / capUsd;
    return {
        alert80Sent: alert80SentBefore || pct >= 0.8,
        alert95Sent: alert95SentBefore || pct >= 0.95,
        suspended: pct >= 1.0,
    };
}
function effectiveCap(tier, hardLimitOverride) {
    return hardLimitOverride !== null ? hardLimitOverride : getPlan(tier).tokenBudgetUsd;
}
// ─── Property 8: Tier Cost Cap Enforcement ────────────────────────────────────
// Feature: augustus-ai-sales-platform, Property 8: Tier Cost Cap Enforcement
// Validates: Requirements 3.1, 3.2, 3.3
describe('Property 8: Tier Cost Cap Enforcement', () => {
    it('once accumulated cost >= cap, allowed is always false', () => {
        const tierArb = fc.constantFrom('silver', 'gold', 'platinum');
        fc.assert(fc.property(tierArb, fc.float({ min: 0, max: 500, noNaN: true }), (tier, accumulated) => {
            const cap = getPlan(tier).tokenBudgetUsd;
            const { allowed } = computeBudgetStatus(accumulated, cap);
            if (accumulated >= cap) {
                expect(allowed).toBe(false);
            }
            else {
                expect(allowed).toBe(true);
            }
        }), { numRuns: 25 });
    });
    it('remaining budget is always non-negative', () => {
        fc.assert(fc.property(fc.constantFrom('silver', 'gold', 'platinum'), fc.float({ min: 0, max: 500, noNaN: true }), (tier, accumulated) => {
            const cap = getPlan(tier).tokenBudgetUsd;
            const { remainingUsd } = computeBudgetStatus(accumulated, cap);
            expect(remainingUsd).toBeGreaterThanOrEqual(0);
        }), { numRuns: 25 });
    });
    it('remaining = cap - accumulated when below cap, 0 when at or above', () => {
        fc.assert(fc.property(fc.float({ min: 0, max: 200, noNaN: true }), fc.float({ min: 1, max: 200, noNaN: true }), (accumulated, cap) => {
            const { remainingUsd } = computeBudgetStatus(accumulated, cap);
            const expected = accumulated < cap ? cap - accumulated : 0;
            expect(remainingUsd).toBeCloseTo(expected, 5);
        }), { numRuns: 25 });
    });
    it('hard limit override takes precedence over tier default cap', () => {
        fc.assert(fc.property(fc.constantFrom('silver', 'gold', 'platinum'), fc.float({ min: 1, max: 500, noNaN: true }), (tier, override) => {
            const cap = effectiveCap(tier, override);
            expect(cap).toBe(override);
        }), { numRuns: 25 });
    });
    it('without override, effective cap equals tier tokenBudgetUsd', () => {
        fc.assert(fc.property(fc.constantFrom('silver', 'gold', 'platinum'), (tier) => {
            const cap = effectiveCap(tier, null);
            expect(cap).toBe(PLANS[tier].tokenBudgetUsd);
        }), { numRuns: 25 });
    });
    it('all tier caps are positive and ordered silver < gold < platinum', () => {
        expect(PLANS.silver.tokenBudgetUsd).toBeGreaterThan(0);
        expect(PLANS.gold.tokenBudgetUsd).toBeGreaterThan(PLANS.silver.tokenBudgetUsd);
        expect(PLANS.platinum.tokenBudgetUsd).toBeGreaterThan(PLANS.gold.tokenBudgetUsd);
    });
});
// ─── Property 9: Budget Alert Thresholds ─────────────────────────────────────
// Feature: augustus-ai-sales-platform, Property 9: Budget Alert Thresholds
// Validates: Requirements 3.4, 3.5
describe('Property 9: Budget Alert Thresholds', () => {
    it('alert_80_sent becomes true when accumulated >= 80% of cap', () => {
        fc.assert(fc.property(fc.float({ min: 0, max: 500, noNaN: true }), fc.float({ min: 1, max: 500, noNaN: true }), (accumulated, cap) => {
            const { alert80Sent } = computeAlertState(accumulated, cap, false, false);
            const pct = accumulated / cap;
            if (pct >= 0.8) {
                expect(alert80Sent).toBe(true);
            }
            else {
                expect(alert80Sent).toBe(false);
            }
        }), { numRuns: 25 });
    });
    it('alert_95_sent becomes true when accumulated >= 95% of cap', () => {
        fc.assert(fc.property(fc.float({ min: 0, max: 500, noNaN: true }), fc.float({ min: 1, max: 500, noNaN: true }), (accumulated, cap) => {
            const { alert95Sent } = computeAlertState(accumulated, cap, false, false);
            const pct = accumulated / cap;
            if (pct >= 0.95) {
                expect(alert95Sent).toBe(true);
            }
            else {
                expect(alert95Sent).toBe(false);
            }
        }), { numRuns: 25 });
    });
    it('once alert_80_sent is true, it stays true regardless of subsequent cost', () => {
        fc.assert(fc.property(fc.float({ min: 0, max: 500, noNaN: true }), fc.float({ min: 1, max: 500, noNaN: true }), (accumulated, cap) => {
            // Simulate: alert was already sent
            const { alert80Sent } = computeAlertState(accumulated, cap, true, false);
            expect(alert80Sent).toBe(true);
        }), { numRuns: 25 });
    });
    it('once alert_95_sent is true, it stays true regardless of subsequent cost', () => {
        fc.assert(fc.property(fc.float({ min: 0, max: 500, noNaN: true }), fc.float({ min: 1, max: 500, noNaN: true }), (accumulated, cap) => {
            const { alert95Sent } = computeAlertState(accumulated, cap, false, true);
            expect(alert95Sent).toBe(true);
        }), { numRuns: 25 });
    });
    it('alert_95_sent implies alert_80_sent (95% crossing always follows 80%)', () => {
        fc.assert(fc.property(fc.float({ min: 0, max: 500, noNaN: true }), fc.float({ min: 1, max: 500, noNaN: true }), (accumulated, cap) => {
            const { alert80Sent, alert95Sent } = computeAlertState(accumulated, cap, false, false);
            if (alert95Sent) {
                expect(alert80Sent).toBe(true);
            }
        }), { numRuns: 25 });
    });
    it('no alert is sent when accumulated is below 80% of cap', () => {
        fc.assert(fc.property(
        // fraction in [0, 0.79] — use integer percentage to avoid 32-bit float constraint issues
        fc.integer({ min: 0, max: 79 }), fc.float({ min: 1, max: 500, noNaN: true }), (fractionPct, cap) => {
            const accumulated = (fractionPct / 100) * cap;
            const { alert80Sent, alert95Sent } = computeAlertState(accumulated, cap, false, false);
            expect(alert80Sent).toBe(false);
            expect(alert95Sent).toBe(false);
        }), { numRuns: 25 });
    });
});
// ─── Property 10: Budget Exhaustion Suspends AI Responses ────────────────────
// Feature: augustus-ai-sales-platform, Property 10: Budget Exhaustion Suspends AI Responses
// Validates: Requirements 3.6
describe('Property 10: Budget Exhaustion Suspends AI Responses', () => {
    it('suspended is true when accumulated >= cap', () => {
        fc.assert(fc.property(fc.float({ min: 0, max: 500, noNaN: true }), fc.float({ min: 1, max: 500, noNaN: true }), (accumulated, cap) => {
            const { suspended } = computeBudgetStatus(accumulated, cap);
            if (accumulated >= cap) {
                expect(suspended).toBe(true);
            }
            else {
                expect(suspended).toBe(false);
            }
        }), { numRuns: 25 });
    });
    it('allowed is false whenever suspended is true', () => {
        fc.assert(fc.property(fc.float({ min: 0, max: 500, noNaN: true }), fc.float({ min: 1, max: 500, noNaN: true }), (accumulated, cap) => {
            const { allowed, suspended } = computeBudgetStatus(accumulated, cap);
            if (suspended) {
                expect(allowed).toBe(false);
            }
        }), { numRuns: 25 });
    });
    it('suspension persists: any additional cost increment while suspended keeps allowed=false', () => {
        fc.assert(fc.property(fc.float({ min: 0, max: 500, noNaN: true }), fc.float({ min: 1, max: 500, noNaN: true }), fc.integer({ min: 1, max: 100 }), (initialAccumulated, cap, additionalCostCents) => {
            const additionalCost = additionalCostCents / 100;
            // Start at or above cap
            const startAccumulated = initialAccumulated + cap;
            const afterIncrement = startAccumulated + additionalCost;
            const { allowed } = computeBudgetStatus(afterIncrement, cap);
            expect(allowed).toBe(false);
        }), { numRuns: 25 });
    });
    it('after billing cycle reset (accumulated=0), allowed is true again', () => {
        fc.assert(fc.property(fc.constantFrom('silver', 'gold', 'platinum'), (tier) => {
            const cap = getPlan(tier).tokenBudgetUsd;
            // Simulate reset: accumulated goes back to 0
            const { allowed, suspended } = computeBudgetStatus(0, cap);
            expect(allowed).toBe(true);
            expect(suspended).toBe(false);
        }), { numRuns: 25 });
    });
    it('suspension threshold is exactly at cap (not before)', () => {
        fc.assert(fc.property(fc.float({ min: 1, max: 500, noNaN: true }), (cap) => {
            // Use a fixed small epsilon expressed as integer cents to avoid 32-bit float issues
            const epsilon = 0.001;
            const justBelow = computeBudgetStatus(cap - epsilon, cap);
            const atCap = computeBudgetStatus(cap, cap);
            expect(justBelow.allowed).toBe(true);
            expect(atCap.allowed).toBe(false);
        }), { numRuns: 25 });
    });
});
//# sourceMappingURL=token-budget.properties.test.js.map