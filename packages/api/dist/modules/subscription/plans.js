/**
 * Plan catalogue definitions for Augustus subscription tiers.
 * Requirements: 2.1, 3.1, 3.2, 3.3
 */
export const PLANS = {
    silver: {
        tier: 'silver',
        priceUsd: 31.99,
        tokenBudgetUsd: 12.00,
        displayName: 'Silver',
    },
    gold: {
        tier: 'gold',
        priceUsd: 61.99,
        tokenBudgetUsd: 30.00,
        displayName: 'Gold',
    },
    platinum: {
        tier: 'platinum',
        priceUsd: 129.99,
        tokenBudgetUsd: 70.00,
        displayName: 'Platinum',
    },
};
export function getPlan(tier) {
    return PLANS[tier];
}
export function isValidTier(tier) {
    return tier === 'silver' || tier === 'gold' || tier === 'platinum';
}
/**
 * Calculate prorated charge when upgrading mid-cycle.
 * Property 6: proration = (daysRemaining / daysInCycle) * (newPrice - oldPrice)
 */
export function calculateProration(oldPriceUsd, newPriceUsd, cycleStartDate, cycleEndDate, upgradeDate) {
    const daysInCycle = Math.round((cycleEndDate.getTime() - cycleStartDate.getTime()) / (1000 * 60 * 60 * 24));
    const daysRemaining = Math.max(0, Math.round((cycleEndDate.getTime() - upgradeDate.getTime()) / (1000 * 60 * 60 * 24)));
    const priceDiff = newPriceUsd - oldPriceUsd;
    if (daysInCycle === 0 || priceDiff <= 0)
        return 0;
    return Number(((daysRemaining / daysInCycle) * priceDiff).toFixed(2));
}
//# sourceMappingURL=plans.js.map