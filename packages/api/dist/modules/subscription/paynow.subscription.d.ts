/**
 * Paynow subscription billing integration.
 * Distinct from the in-chat payment flow (Task 9).
 * Requirements: 2.1, 2.2, 2.5, 2.6
 */
import type { PlanTier } from './plans.js';
export interface PaynowChargeResult {
    success: boolean;
    paynowReference: string | null;
    pollUrl: string | null;
    paymentUrl: string | null;
    returnUrl?: string;
    error?: string;
}
export interface PaynowStatusResult {
    status: 'paid' | 'awaiting' | 'cancelled' | 'failed';
    paynowReference: string | null;
}
/**
 * Initiate a subscription charge via Paynow.
 * Returns a redirect URL, poll URL and reference for status tracking.
 * Stores a subscription_payments record so the webhook can resolve businessId + tier.
 */
export declare function initiateSubscriptionCharge(businessId: string, email: string, amountUsd: number, description: string, tier: PlanTier): Promise<PaynowChargeResult>;
/**
 * Poll Paynow for the status of a subscription payment.
 */
export declare function pollSubscriptionPaymentStatus(pollUrl: string): Promise<PaynowStatusResult>;
/**
 * Handle an inbound Paynow subscription payment status webhook.
 * Looks up businessId + tier from subscription_payments table using the paynowreference.
 */
export declare function handleSubscriptionPaymentWebhook(payload: {
    reference: string;
    status: string;
    paynowReference: string;
    businessId?: string;
    tier?: PlanTier;
    subscriptionId?: string;
}): Promise<void>;
/**
 * Initiate subscription renewal charges for all subscriptions due today.
 * Intended to be called by a scheduled job at the start of each billing cycle.
 */
export declare function processSubscriptionRenewals(getDueSubscriptions: () => Promise<Array<{
    id: string;
    businessId: string;
    plan: PlanTier;
    priceUsd: number;
    email: string;
}>>): Promise<void>;
//# sourceMappingURL=paynow.subscription.d.ts.map