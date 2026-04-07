/**
 * Plan catalogue definitions for Augustus subscription tiers.
 * Requirements: 2.1, 3.1, 3.2, 3.3
 */
export type PlanTier = 'silver' | 'gold' | 'platinum';
export interface Plan {
    tier: PlanTier;
    /** Monthly subscription price in USD */
    priceUsd: number;
    /** Monthly Claude Haiku cost cap in USD */
    tokenBudgetUsd: number;
    displayName: string;
}
export declare const PLANS: Record<PlanTier, Plan>;
export declare function getPlan(tier: PlanTier): Plan;
export declare function isValidTier(tier: string): tier is PlanTier;
/**
 * Calculate prorated charge when upgrading mid-cycle.
 * Property 6: proration = (daysRemaining / daysInCycle) * (newPrice - oldPrice)
 */
export declare function calculateProration(oldPriceUsd: number, newPriceUsd: number, cycleStartDate: Date, cycleEndDate: Date, upgradeDate: Date): number;
//# sourceMappingURL=plans.d.ts.map