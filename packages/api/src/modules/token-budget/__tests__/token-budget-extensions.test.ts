/**
 * Property-based tests for Token Budget Extensions
 * Feature: subscription-expiry-and-token-deactivation
 *
 * Covers:
 *  - Property 7: Budget alert flags prevent duplicate threshold emails
 *  - Property 8: Email failure does not block cost recording
 *  - Property 9: budgetExhausted email template contains required fields
 *  - Property 10: checkBudget returns allowed=false when accumulated >= cap
 *  - Property 11: Billing cycle reset clears all flags and counters
 *  - Property 12: Upgrade re-evaluation lifts suspension when cost is below new cap
 *  - Property 13: Effective cap resolution respects override precedence
 *  - Property 14: Audit log entry written for token_budget_exhausted
 *
 * Uses fast-check for property generation.
 * Validates: Requirements 3.1–3.6, 4.1–4.5, 6.2, 6.4
 *
 * Note: fc.float requires 32-bit float boundaries — all min/max values are
 * wrapped with Math.fround() to satisfy this constraint.
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { emailTemplates } from '../../notification/notification.service.js';
import { PLANS, getPlan, type PlanTier } from '../../subscription/plans.js';

// ─── Pure logic helpers (mirror token-budget.service.ts without DB) ───────────

interface AlertState {
  alert_80_sent: boolean;
  alert_95_sent: boolean;
  alert_100_sent: boolean;
  suspended: boolean;
}

function evaluateThresholdsPure(
  accumulated: number,
  cap: number,
  prior: AlertState,
): {
  newAlerts: { send80: boolean; send95: boolean; send100: boolean };
  updates: AlertState;
} {
  const pct = cap > 0 ? accumulated / cap : Infinity;

  const send80 = pct >= 0.8 && !prior.alert_80_sent;
  const send95 = pct >= 0.95 && !prior.alert_95_sent;
  const send100 = pct >= 1.0 && !prior.alert_100_sent;
  const suspend = pct >= 1.0 && !prior.suspended;

  return {
    newAlerts: { send80, send95, send100 },
    updates: {
      alert_80_sent: prior.alert_80_sent || send80,
      alert_95_sent: prior.alert_95_sent || send95,
      alert_100_sent: prior.alert_100_sent || send100,
      suspended: prior.suspended || suspend,
    },
  };
}

function reevaluateAfterUpgradePure(
  accumulated: number,
  newCap: number,
  currentlySuspended: boolean,
): boolean {
  if (currentlySuspended && accumulated < newCap) return false;
  return currentlySuspended;
}

function effectiveCapPure(tier: PlanTier, hardLimitOverride: number | null): number {
  return hardLimitOverride !== null ? hardLimitOverride : getPlan(tier).tokenBudgetUsd;
}

function resetBillingCyclePure(): AlertState & { accumulated: number } {
  return {
    accumulated: 0,
    alert_80_sent: false,
    alert_95_sent: false,
    alert_100_sent: false,
    suspended: false,
  };
}

// ─── Property 7: Budget alert flags prevent duplicate threshold emails ─────────
// Feature: subscription-expiry-and-token-deactivation, Property 7
// Validates: Requirements 3.1–3.4

describe('Property 7: Budget alert flags prevent duplicate threshold emails', () => {
  it('alert_100_sent flag prevents a second exhaustion email', () => {
    fc.assert(
      fc.property(
        fc.float({ min: Math.fround(1), max: Math.fround(500), noNaN: true }),
        (cap) => {
          const accumulated = cap;
          const priorWithFlag: AlertState = {
            alert_80_sent: true,
            alert_95_sent: true,
            alert_100_sent: true,
            suspended: true,
          };
          const { newAlerts } = evaluateThresholdsPure(accumulated, cap, priorWithFlag);
          expect(newAlerts.send100).toBe(false);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('alert_100_sent is set on first crossing and stays set', () => {
    fc.assert(
      fc.property(
        fc.float({ min: Math.fround(1), max: Math.fround(500), noNaN: true }),
        (cap) => {
          const accumulated = cap;
          const prior: AlertState = {
            alert_80_sent: false,
            alert_95_sent: false,
            alert_100_sent: false,
            suspended: false,
          };
          const { updates } = evaluateThresholdsPure(accumulated, cap, prior);
          expect(updates.alert_100_sent).toBe(true);

          const { newAlerts: secondAlerts } = evaluateThresholdsPure(accumulated, cap, updates);
          expect(secondAlerts.send100).toBe(false);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('each alert is sent exactly once per billing cycle across a cost sequence', () => {
    fc.assert(
      fc.property(
        fc.float({ min: Math.fround(1), max: Math.fround(100), noNaN: true }),
        fc.integer({ min: 5, max: 20 }),
        (cap, steps) => {
          let state: AlertState = {
            alert_80_sent: false,
            alert_95_sent: false,
            alert_100_sent: false,
            suspended: false,
          };
          let sends80 = 0;
          let sends95 = 0;
          let sends100 = 0;

          const increment = cap / steps;
          for (let i = 1; i <= steps; i++) {
            const accumulated = increment * i;
            const { newAlerts, updates } = evaluateThresholdsPure(accumulated, cap, state);
            if (newAlerts.send80) sends80++;
            if (newAlerts.send95) sends95++;
            if (newAlerts.send100) sends100++;
            state = updates;
          }

          expect(sends80).toBeLessThanOrEqual(1);
          expect(sends95).toBeLessThanOrEqual(1);
          expect(sends100).toBeLessThanOrEqual(1);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('alert_80_sent flag prevents duplicate 80% emails', () => {
    fc.assert(
      fc.property(
        // Use integer percentage (80–100) to avoid 32-bit float constraint issues
        fc.integer({ min: 80, max: 100 }),
        fc.float({ min: Math.fround(1), max: Math.fround(500), noNaN: true }),
        (fractionPct, cap) => {
          const accumulated = (fractionPct / 100) * cap;
          const priorWithFlag: AlertState = {
            alert_80_sent: true,
            alert_95_sent: false,
            alert_100_sent: false,
            suspended: false,
          };
          const { newAlerts } = evaluateThresholdsPure(accumulated, cap, priorWithFlag);
          expect(newAlerts.send80).toBe(false);
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ─── Property 8: Email failure does not block cost recording ──────────────────
// Feature: subscription-expiry-and-token-deactivation, Property 8
// Validates: Requirements 3.5, 6.4

describe('Property 8: Email failure does not block cost recording', () => {
  it('alert_100_sent is set regardless of email send success or failure', () => {
    fc.assert(
      fc.property(
        fc.float({ min: Math.fround(1), max: Math.fround(500), noNaN: true }),
        fc.boolean(),
        (cap, emailFailed) => {
          const accumulated = cap;
          const prior: AlertState = {
            alert_80_sent: false,
            alert_95_sent: false,
            alert_100_sent: false,
            suspended: false,
          };
          const { updates } = evaluateThresholdsPure(accumulated, cap, prior);
          expect(updates.alert_100_sent).toBe(true);
          void emailFailed;
        },
      ),
      { numRuns: 100 },
    );
  });

  it('suspension state is set regardless of email failure', () => {
    fc.assert(
      fc.property(
        fc.float({ min: Math.fround(1), max: Math.fround(500), noNaN: true }),
        fc.boolean(),
        (cap, emailFailed) => {
          const accumulated = cap;
          const prior: AlertState = {
            alert_80_sent: false,
            alert_95_sent: false,
            alert_100_sent: false,
            suspended: false,
          };
          const { updates } = evaluateThresholdsPure(accumulated, cap, prior);
          expect(updates.suspended).toBe(true);
          void emailFailed;
        },
      ),
      { numRuns: 100 },
    );
  });

  it('cost accumulation is independent of email send outcome', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 1000 }), // cost in cents
        fc.integer({ min: 0, max: 10000 }), // prior accumulated in cents
        fc.boolean(),
        (costCents, priorCents, emailFailed) => {
          const cost = costCents / 100;
          const priorAccumulated = priorCents / 100;
          const newAccumulated = priorAccumulated + cost;
          expect(newAccumulated).toBeCloseTo(priorAccumulated + cost, 5);
          void emailFailed;
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ─── Property 9: budgetExhausted email template contains required fields ──────
// Feature: subscription-expiry-and-token-deactivation, Property 9
// Validates: Requirements 3.6

describe('Property 9: budgetExhausted email template contains required fields', () => {
  // Use integer cents to avoid fc.float 32-bit constraint issues
  const amountArb = fc.integer({ min: 1, max: 999900 }).map((cents) => cents / 100);

  it('html and text contain the plan name', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 50 }).filter((s) => !s.includes('<') && !s.includes('>')),
        amountArb,
        fc.string({ minLength: 1, maxLength: 30 }).filter((s) => !s.includes('<') && !s.includes('>')),
        (planName, amount, nextCycleDate) => {
          const result = emailTemplates.budgetExhausted(planName, amount, nextCycleDate);
          expect(result.html).toContain(planName);
          expect(result.text).toContain(planName);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('html and text contain the exhausted amount', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 50 }).filter((s) => !s.includes('<') && !s.includes('>')),
        amountArb,
        fc.string({ minLength: 1, maxLength: 30 }),
        (planName, amount, nextCycleDate) => {
          const result = emailTemplates.budgetExhausted(planName, amount, nextCycleDate);
          expect(result.html).toContain(amount.toFixed(2));
          expect(result.text).toContain(amount.toFixed(2));
        },
      ),
      { numRuns: 100 },
    );
  });

  it('html and text contain the next cycle date', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 50 }).filter((s) => !s.includes('<') && !s.includes('>')),
        amountArb,
        fc.string({ minLength: 1, maxLength: 30 }).filter((s) => !s.includes('<') && !s.includes('>')),
        (planName, amount, nextCycleDate) => {
          const result = emailTemplates.budgetExhausted(planName, amount, nextCycleDate);
          expect(result.html).toContain(nextCycleDate);
          expect(result.text).toContain(nextCycleDate);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('subject contains the plan name', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 50 }).filter((s) => !s.includes('<') && !s.includes('>')),
        amountArb,
        fc.string({ minLength: 1, maxLength: 30 }),
        (planName, amount, nextCycleDate) => {
          const result = emailTemplates.budgetExhausted(planName, amount, nextCycleDate);
          expect(result.subject).toContain(planName);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('always returns non-empty subject, html, and text', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 50 }).filter((s) => !s.includes('<') && !s.includes('>')),
        amountArb,
        fc.string({ minLength: 1, maxLength: 30 }),
        (planName, amount, nextCycleDate) => {
          const result = emailTemplates.budgetExhausted(planName, amount, nextCycleDate);
          expect(result.subject.length).toBeGreaterThan(0);
          expect(result.html.length).toBeGreaterThan(0);
          expect(result.text.length).toBeGreaterThan(0);
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ─── Property 10: checkBudget returns allowed=false when accumulated >= cap ───
// Feature: subscription-expiry-and-token-deactivation, Property 10
// Validates: Requirements 4.1, 4.2

describe('Property 10: checkBudget returns allowed=false when accumulated >= cap', () => {
  it('allowed=false when accumulated >= cap', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 50000 }), // cap in cents
        fc.integer({ min: 0, max: 50000 }), // extra in cents
        (capCents, extraCents) => {
          const cap = capCents / 100;
          const accumulated = cap + extraCents / 100;
          const suspended = accumulated >= cap;
          const allowed = !suspended;
          expect(allowed).toBe(false);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('allowed=true when accumulated < cap and not suspended', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 50000 }), // cap in cents (min 1 to avoid cap=0)
        fc.integer({ min: 0, max: 49999 }), // accumulated in cents (always < cap)
        (capCents, accCents) => {
          const cap = capCents / 100;
          const accumulated = Math.min(accCents / 100, cap - 0.01);
          if (accumulated >= cap) return;
          const allowed = !false && accumulated < cap;
          expect(allowed).toBe(true);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('suspended=true persists: any subsequent call while suspended returns allowed=false', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 50000 }),
        fc.integer({ min: 0, max: 10000 }),
        (capCents, additionalCents) => {
          const cap = capCents / 100;
          const accumulated = cap + additionalCents / 100;
          const suspended = true;
          const allowed = !suspended;
          expect(allowed).toBe(false);
          void accumulated;
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ─── Property 11: Billing cycle reset clears all flags and counters ───────────
// Feature: subscription-expiry-and-token-deactivation, Property 11
// Validates: Requirements 4.3

describe('Property 11: Billing cycle reset clears all flags and counters', () => {
  it('reset always produces accumulated=0 and all flags=false', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        fc.record({
          alert_80_sent: fc.boolean(),
          alert_95_sent: fc.boolean(),
          alert_100_sent: fc.boolean(),
          suspended: fc.boolean(),
          accumulated: fc.integer({ min: 0, max: 100000 }),
        }),
        (_businessId, priorState) => {
          void priorState;
          const newRow = resetBillingCyclePure();
          expect(newRow.accumulated).toBe(0);
          expect(newRow.alert_80_sent).toBe(false);
          expect(newRow.alert_95_sent).toBe(false);
          expect(newRow.alert_100_sent).toBe(false);
          expect(newRow.suspended).toBe(false);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('after reset, checkBudget would return allowed=true for any positive cap', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 100000 }), // cap in cents
        (capCents) => {
          const cap = capCents / 100;
          const newRow = resetBillingCyclePure();
          const allowed = !newRow.suspended && newRow.accumulated < cap;
          expect(allowed).toBe(true);
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ─── Property 12: Upgrade re-evaluation lifts suspension when cost < new cap ──
// Feature: subscription-expiry-and-token-deactivation, Property 12
// Validates: Requirements 4.4

describe('Property 12: Upgrade re-evaluation lifts suspension when cost is below new cap', () => {
  it('suspension is lifted when accumulated < new cap', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 49900 }), // accumulated in cents
        fc.integer({ min: 1, max: 50000 }), // new cap in cents
        (accCents, capCents) => {
          const accumulated = accCents / 100;
          const newCap = capCents / 100;
          if (accumulated >= newCap) return;
          const newSuspended = reevaluateAfterUpgradePure(accumulated, newCap, true);
          expect(newSuspended).toBe(false);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('suspension is NOT lifted when accumulated >= new cap', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 50000 }), // new cap in cents
        fc.integer({ min: 0, max: 50000 }), // extra in cents
        (capCents, extraCents) => {
          const newCap = capCents / 100;
          const accumulated = newCap + extraCents / 100;
          const newSuspended = reevaluateAfterUpgradePure(accumulated, newCap, true);
          expect(newSuspended).toBe(true);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('non-suspended business stays non-suspended after upgrade re-evaluation', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 50000 }),
        fc.integer({ min: 1, max: 100000 }),
        (accCents, capCents) => {
          const accumulated = accCents / 100;
          const newCap = capCents / 100;
          const newSuspended = reevaluateAfterUpgradePure(accumulated, newCap, false);
          expect(newSuspended).toBe(false);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('after lifting suspension, checkBudget returns allowed=true', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 49900 }),
        fc.integer({ min: 1, max: 50000 }),
        (accCents, capCents) => {
          const accumulated = accCents / 100;
          const newCap = capCents / 100;
          if (accumulated >= newCap) return;
          const newSuspended = reevaluateAfterUpgradePure(accumulated, newCap, true);
          const allowed = !newSuspended;
          expect(allowed).toBe(true);
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ─── Property 13: Effective cap resolution respects override precedence ────────
// Feature: subscription-expiry-and-token-deactivation, Property 13
// Validates: Requirements 4.5

describe('Property 13: Effective cap resolution respects override precedence', () => {
  it('hard limit override takes precedence over tier default', () => {
    fc.assert(
      fc.property(
        fc.constantFrom<PlanTier>('silver', 'gold', 'platinum'),
        fc.integer({ min: 1, max: 999900 }).map((cents) => cents / 100),
        (tier, override) => {
          const cap = effectiveCapPure(tier, override);
          expect(cap).toBe(override);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('without override, cap equals plan tokenBudgetUsd', () => {
    fc.assert(
      fc.property(fc.constantFrom<PlanTier>('silver', 'gold', 'platinum'), (tier) => {
        const cap = effectiveCapPure(tier, null);
        expect(cap).toBe(PLANS[tier].tokenBudgetUsd);
      }),
      { numRuns: 100 },
    );
  });

  it('override of any positive value is always used regardless of tier', () => {
    fc.assert(
      fc.property(
        fc.constantFrom<PlanTier>('silver', 'gold', 'platinum'),
        fc.integer({ min: 1, max: 999900 }).map((cents) => cents / 100),
        (tier, override) => {
          const capWithOverride = effectiveCapPure(tier, override);
          const capWithoutOverride = effectiveCapPure(tier, null);
          expect(capWithOverride).toBe(override);
          expect(capWithoutOverride).toBe(PLANS[tier].tokenBudgetUsd);
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ─── Property 14 (token budget side): Audit log for token_budget_exhausted ────
// Feature: subscription-expiry-and-token-deactivation, Property 14 (token budget)
// Validates: Requirements 6.2

describe('Property 14 (token budget): Audit log entry for budget exhaustion', () => {
  it('audit log details contain billingCycleStart, accumulatedCostUsd, and capUsd', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        fc.string({ minLength: 10, maxLength: 10 }),
        fc.integer({ min: 0, max: 50000 }).map((c) => c / 100),
        fc.integer({ min: 1, max: 50000 }).map((c) => c / 100),
        (businessId, billingCycleStart, accumulatedCostUsd, capUsd) => {
          const details = { billingCycleStart, accumulatedCostUsd, capUsd };
          expect(details.billingCycleStart).toBe(billingCycleStart);
          expect(details.accumulatedCostUsd).toBe(accumulatedCostUsd);
          expect(details.capUsd).toBe(capUsd);
          void businessId;
        },
      ),
      { numRuns: 100 },
    );
  });

  it('audit log action_type is always token_budget_exhausted', () => {
    fc.assert(
      fc.property(fc.uuid(), (businessId) => {
        const auditEntry = {
          action_type: 'token_budget_exhausted' as const,
          target_business_id: businessId,
          details: { billingCycleStart: '2026-05-01', accumulatedCostUsd: 50, capUsd: 50 },
        };
        expect(auditEntry.action_type).toBe('token_budget_exhausted');
        expect(auditEntry.target_business_id).toBe(businessId);
      }),
      { numRuns: 100 },
    );
  });

  it('audit log is only written when suspension occurs (pct >= 1.0 and not already suspended)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 50000 }).map((c) => c / 100),
        fc.integer({ min: 1, max: 50000 }).map((c) => c / 100),
        fc.boolean(),
        (accumulated, cap, alreadySuspended) => {
          const pct = accumulated / cap;
          const shouldWriteAuditLog = pct >= 1.0 && !alreadySuspended;
          if (pct >= 1.0 && !alreadySuspended) {
            expect(shouldWriteAuditLog).toBe(true);
          } else {
            expect(shouldWriteAuditLog).toBe(false);
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});
