/**
 * Plan catalogue definitions for Augustus subscription tiers.
 * Requirements: 2.1, 3.1, 3.2, 3.3
 */

export type PlanTier = 'silver' | 'gold' | 'platinum';

export interface Plan {
  tier: PlanTier;
  /** Monthly subscription price in USD */
  priceUsd: number;
  /** Monthly Claude Sonnet cost cap in USD (includes 10% platform margin) */
  tokenBudgetUsd: number;
  displayName: string;
}

export const PLANS: Record<PlanTier, Plan> = {
  silver: {
    tier: 'silver',
    priceUsd: 31.99,
    tokenBudgetUsd: 15.00,   // ~1,800 msgs/mo at Sonnet+10% rates
    displayName: 'Silver',
  },
  gold: {
    tier: 'gold',
    priceUsd: 61.99,
    tokenBudgetUsd: 40.00,   // ~4,800 msgs/mo at Sonnet+10% rates
    displayName: 'Gold',
  },
  platinum: {
    tier: 'platinum',
    priceUsd: 129.99,
    tokenBudgetUsd: 100.00,  // ~12,000 msgs/mo at Sonnet+10% rates
    displayName: 'Platinum',
  },
};

export function getPlan(tier: PlanTier): Plan {
  return PLANS[tier];
}

export function isValidTier(tier: string): tier is PlanTier {
  return tier === 'silver' || tier === 'gold' || tier === 'platinum';
}

/**
 * Calculate prorated charge when upgrading mid-cycle.
 * Property 6: proration = (daysRemaining / daysInCycle) * (newPrice - oldPrice)
 */
export function calculateProration(
  oldPriceUsd: number,
  newPriceUsd: number,
  cycleStartDate: Date,
  cycleEndDate: Date,
  upgradeDate: Date,
): number {
  const daysInCycle = Math.round(
    (cycleEndDate.getTime() - cycleStartDate.getTime()) / (1000 * 60 * 60 * 24),
  );
  const daysRemaining = Math.max(
    0,
    Math.round((cycleEndDate.getTime() - upgradeDate.getTime()) / (1000 * 60 * 60 * 24)),
  );
  const priceDiff = newPriceUsd - oldPriceUsd;
  if (daysInCycle === 0 || priceDiff <= 0) return 0;
  return Number(((daysRemaining / daysInCycle) * priceDiff).toFixed(2));
}
