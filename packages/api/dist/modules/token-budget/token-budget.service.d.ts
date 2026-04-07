/**
 * Token Budget Controller
 * Tasks: 4.1–4.7, 4.9, 4.10
 * Requirements: 3.1–3.8
 * Properties: 8, 9, 10
 */
export interface BudgetStatus {
    /** Whether the Conversation Engine is allowed to call Claude Haiku */
    allowed: boolean;
    /** Remaining budget in USD (0 when suspended) */
    remainingUsd: number;
    /** Accumulated cost this cycle in USD */
    accumulatedCostUsd: number;
    /** Effective cap in USD (override takes precedence over tier default) */
    capUsd: number;
    /** True when the business has been suspended due to budget exhaustion */
    suspended: boolean;
}
/**
 * Check whether a business is allowed to make a Claude Haiku inference call.
 * Property 8: once accumulated cost >= cap, returns allowed=false until cycle resets.
 * Property 10: every subsequent call after 100% cap returns allowed=false.
 */
export declare function checkBudget(businessId: string): Promise<BudgetStatus>;
/**
 * Atomically increment the accumulated cost after a Claude Haiku inference call.
 * Then evaluate thresholds and enforce suspension if cap is reached.
 * Property 8: cap enforcement after increment.
 * Property 9: exactly one alert per threshold crossing per cycle.
 */
export declare function recordInferenceCost(businessId: string, costUsd: number, businessEmail: string): Promise<BudgetStatus>;
/**
 * Set a hard token limit override for a business (operator action).
 */
export declare function setHardLimitOverride(businessId: string, hardLimitUsd: number, operatorId: string): Promise<void>;
/**
 * Remove a hard limit override, reverting to tier default.
 */
export declare function removeHardLimitOverride(businessId: string): Promise<void>;
/**
 * Reset the token usage accumulator for a business at the start of a new billing cycle.
 * Clears alert flags and suspension so AI responses resume.
 * Requirements: 3.6, 3.7
 */
export declare function resetBillingCycle(businessId: string): Promise<void>;
/**
 * Scheduled job: reset all businesses whose billing cycle starts today.
 * Intended to be called by a daily cron job.
 */
export declare function runBillingCycleResetJob(): Promise<void>;
/**
 * Track whether the unavailability message has been sent for the current suspension event.
 * Returns true if the message should be sent (first time for this suspension).
 * Uses a Redis-style flag in token_usage to prevent duplicate messages.
 */
export declare function shouldSendUnavailabilityMessage(businessId: string): Promise<boolean>;
//# sourceMappingURL=token-budget.service.d.ts.map