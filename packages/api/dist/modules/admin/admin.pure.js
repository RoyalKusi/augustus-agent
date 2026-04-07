/**
 * Pure functions for Admin Dashboard — no side effects, no DB, no bcrypt.
 * Properties: 36, 37, 38
 */
// ─── Task 13.3: Business suspension (Property 36) ────────────────────────────
/**
 * Property 36: canSuspend returns true only if status is 'active'.
 */
export function canSuspend(currentStatus) {
    return currentStatus === 'active';
}
// ─── Task 13.4: Business reactivation (Property 37) ──────────────────────────
/**
 * Property 37: canReactivate returns true only if status is 'suspended'.
 */
export function canReactivate(currentStatus) {
    return currentStatus === 'suspended';
}
// ─── Task 13.8: Platform cost alert (Property 38) ────────────────────────────
/**
 * Property 38: returns true if totalCost / platformCap >= 0.9
 */
export function isPlatformCostAlertTriggered(totalCost, platformCap) {
    if (platformCap <= 0)
        return false;
    return totalCost / platformCap >= 0.9;
}
//# sourceMappingURL=admin.pure.js.map