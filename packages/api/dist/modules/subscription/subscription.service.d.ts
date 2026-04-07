/**
 * Subscription Management Service
 * Requirements: 2.1–2.9
 * Properties: 5, 6, 7
 */
import { type PlanTier } from './plans.js';
export interface Subscription {
    id: string;
    businessId: string;
    plan: PlanTier;
    priceUsd: number;
    status: 'active' | 'suspended' | 'cancelled';
    activationTimestamp: Date | null;
    renewalDate: Date | null;
    billingCycleStart: Date | null;
    paynowReference: string | null;
    createdAt: Date;
    updatedAt: Date;
}
/**
 * Activate a subscription after successful Paynow payment.
 * Property 5: status must be 'active' and activationTimestamp must be non-null.
 */
export declare function activateSubscription(businessId: string, tier: PlanTier, paynowReference: string): Promise<Subscription>;
/**
 * Upgrade to a higher tier immediately with proration.
 * Property 6: new limits apply immediately; prorated charge = (daysRemaining/daysInCycle) * (newPrice - oldPrice)
 */
export declare function upgradePlan(businessId: string, newTier: PlanTier, paynowReference: string): Promise<{
    subscription: Subscription;
    proratedChargeUsd: number;
}>;
/**
 * Schedule a downgrade to take effect at the start of the next billing cycle.
 * Property 7: current cycle limits remain unchanged until cycle end.
 */
export declare function downgradePlan(businessId: string, newTier: PlanTier): Promise<{
    scheduledTier: PlanTier;
    effectiveDate: Date;
}>;
/**
 * Check all active subscriptions and send renewal reminders at T-7 and T-1 days.
 * Intended to be called by a scheduled job (e.g., daily cron).
 */
export declare function sendRenewalReminders(): Promise<void>;
/**
 * Handle a failed subscription renewal payment.
 * - First failure: schedule retry after 24 h, notify business.
 * - Second failure: suspend account, notify business.
 */
export declare function handleFailedRenewalPayment(subscriptionId: string): Promise<void>;
export declare function getActiveSubscription(businessId: string): Promise<Subscription | null>;
export declare function getSubscriptionById(id: string): Promise<Subscription | null>;
//# sourceMappingURL=subscription.service.d.ts.map