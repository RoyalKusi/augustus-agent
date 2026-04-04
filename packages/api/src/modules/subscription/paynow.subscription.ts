/**
 * Paynow subscription billing integration.
 * Distinct from the in-chat payment flow (Task 9).
 * Requirements: 2.1, 2.2, 2.5, 2.6
 */

import { createHash } from 'crypto';
import { config } from '../../config.js';
import { activateSubscription, handleFailedRenewalPayment } from './subscription.service.js';
import type { PlanTier } from './plans.js';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PaynowChargeResult {
  success: boolean;
  paynowReference: string | null;
  pollUrl: string | null;
  paymentUrl: string | null;
  error?: string;
}

export interface PaynowStatusResult {
  status: 'paid' | 'awaiting' | 'cancelled' | 'failed';
  paynowReference: string | null;
}

// ─── Paynow API client ────────────────────────────────────────────────────────

/**
 * Initiate a subscription charge via Paynow.
 * Returns a redirect URL, poll URL and reference for status tracking.
 */
export async function initiateSubscriptionCharge(
  businessId: string,
  email: string,
  amountUsd: number,
  description: string,
): Promise<PaynowChargeResult> {
  if (!config.paynow.integrationId || !config.paynow.integrationKey) {
    return { success: false, paynowReference: null, pollUrl: null, paymentUrl: null, error: 'Paynow integration not configured.' };
  }

  const reference = `SUB-${businessId.slice(0, 8)}-${Date.now()}`;
  const returnUrl = config.paynow.returnUrl;
  const resultUrl = config.paynow.resultUrl;

  // Build fields in exact order Paynow expects
  const fields: Record<string, string> = {
    id: config.paynow.integrationId,
    reference,
    amount: amountUsd.toFixed(2),
    additionalinfo: description,
    returnurl: returnUrl,
    resulturl: resultUrl,
    status: 'Message',
    authemail: email,
  };

  // Hash: SHA512 of standard fields only (NOT authemail) + integration key
  // Per Paynow docs: id + reference + amount + additionalinfo + returnurl + resulturl + status + key
  const hashInput = config.paynow.integrationId + reference + amountUsd.toFixed(2) + description + returnUrl + resultUrl + 'Message' + config.paynow.integrationKey;
  const hash = createHash('sha512').update(hashInput, 'utf8').digest('hex').toUpperCase();

  const params = new URLSearchParams({ ...fields, hash });

  try {
    const response = await fetch('https://www.paynow.co.zw/interface/initiatetransaction', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });

    const text = await response.text();
    const parsed = Object.fromEntries(new URLSearchParams(text));

    if (parsed['status']?.toLowerCase() !== 'ok') {
      return { success: false, paynowReference: null, pollUrl: null, paymentUrl: null, error: parsed['error'] ?? 'Paynow initiation failed.' };
    }

    return {
      success: true,
      paynowReference: parsed['paynowreference'] ?? reference,
      pollUrl: parsed['pollurl'] ?? null,
      paymentUrl: parsed['browserurl'] ?? null,
    };
  } catch (err) {
    return { success: false, paynowReference: null, pollUrl: null, paymentUrl: null, error: err instanceof Error ? err.message : 'Network error.' };
  }
}

/**
 * Poll Paynow for the status of a subscription payment.
 */
export async function pollSubscriptionPaymentStatus(
  pollUrl: string,
): Promise<PaynowStatusResult> {
  try {
    const response = await fetch(pollUrl);
    const text = await response.text();
    const parsed = Object.fromEntries(new URLSearchParams(text));
    const status = (parsed['status'] ?? '').toLowerCase();
    const paynowReference = parsed['paynowreference'] ?? null;
    if (status === 'paid') return { status: 'paid', paynowReference };
    if (status === 'cancelled' || status === 'failed') return { status: 'failed', paynowReference };
    return { status: 'awaiting', paynowReference };
  } catch {
    return { status: 'awaiting', paynowReference: null };
  }
}

// ─── Webhook handler ──────────────────────────────────────────────────────────

/**
 * Handle an inbound Paynow subscription payment status webhook.
 * Wires confirmed payment → activateSubscription, failed → handleFailedRenewalPayment.
 */
export async function handleSubscriptionPaymentWebhook(payload: {
  reference: string;
  status: string;
  paynowReference: string;
  businessId: string;
  tier: PlanTier;
  subscriptionId?: string;
}): Promise<void> {
  const { reference, status, paynowReference, businessId, tier, subscriptionId } = payload;
  void reference;

  if (status === 'Paid' || status === 'paid') {
    // Wire to subscription activation (Task 3.2)
    await activateSubscription(businessId, tier, paynowReference);
  } else if (status === 'Failed' || status === 'Cancelled' || status === 'cancelled') {
    // Wire to failed payment retry logic (Task 3.4)
    if (subscriptionId) {
      await handleFailedRenewalPayment(subscriptionId);
    }
  }
  // 'Awaiting' / 'Sent' — no action, wait for next webhook or poll
}

// ─── Renewal billing job ──────────────────────────────────────────────────────

/**
 * Initiate subscription renewal charges for all subscriptions due today.
 * Intended to be called by a scheduled job at the start of each billing cycle.
 */
export async function processSubscriptionRenewals(
  getDueSubscriptions: () => Promise<
    Array<{ id: string; businessId: string; plan: PlanTier; priceUsd: number; email: string }>
  >,
): Promise<void> {
  const due = await getDueSubscriptions();

  for (const sub of due) {
    const result = await initiateSubscriptionCharge(
      sub.businessId,
      sub.email,
      sub.priceUsd,
      `Augustus ${sub.plan} subscription renewal`,
    );

    if (!result.success) {
      await handleFailedRenewalPayment(sub.id);
    }
    // On success, activation is triggered by the webhook handler above
  }
}
