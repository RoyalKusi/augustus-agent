/**
 * Pure functions for Admin Dashboard — no side effects, no DB, no bcrypt.
 * Properties: 36, 37, 38
 */
/**
 * Property 36: canSuspend returns true only if status is 'active'.
 */
export declare function canSuspend(currentStatus: string): boolean;
/**
 * Property 37: canReactivate returns true only if status is 'suspended'.
 */
export declare function canReactivate(currentStatus: string): boolean;
/**
 * Property 38: returns true if totalCost / platformCap >= 0.9
 */
export declare function isPlatformCostAlertTriggered(totalCost: number, platformCap: number): boolean;
//# sourceMappingURL=admin.pure.d.ts.map