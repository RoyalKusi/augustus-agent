/**
 * Paynow subscription billing integration.
 * Distinct from the in-chat payment flow (Task 9).
 * Requirements: 2.1, 2.2, 2.5, 2.6
 */
import { createHash } from 'crypto';
import { config } from '../../config.js';
import { pool } from '../../db/client.js';
import { activateSubscription, handleFailedRenewalPayment } from './subscription.service.js';
// ─── Paynow API client ────────────────────────────────────────────────────────
/**
 * Initiate a subscription charge via Paynow.
 * Returns a redirect URL, poll URL and reference for status tracking.
 * Stores a subscription_payments record so the webhook can resolve businessId + tier.
 */
export async function initiateSubscriptionCharge(businessId, email, amountUsd, description, tier) {
    if (!config.paynow.integrationId || !config.paynow.integrationKey) {
        return { success: false, paynowReference: null, pollUrl: null, paymentUrl: null, error: 'Paynow integration not configured.' };
    }
    const reference = `SUB-${businessId.slice(0, 8)}-${Date.now()}`;
    const resultUrl = config.paynow.resultUrl;
    // Build return URL with tier embedded so the frontend can resume polling on return
    const baseReturnUrl = config.paynow.returnUrl;
    const returnUrl = `${baseReturnUrl}?tier=${encodeURIComponent(tier)}&paynow_ref=${encodeURIComponent(reference)}`;
    // Build fields in exact order Paynow expects
    const authEmail = process.env.PAYNOW_MERCHANT_EMAIL || email;
    const fields = {
        id: config.paynow.integrationId,
        reference,
        amount: amountUsd.toFixed(2),
        additionalinfo: description,
        returnurl: returnUrl,
        resulturl: resultUrl,
        status: 'Message',
        authemail: authEmail,
    };
    const hashInput = config.paynow.integrationId + reference + amountUsd.toFixed(2) + description + returnUrl + resultUrl + 'Message' + authEmail + config.paynow.integrationKey;
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
        const paynowReference = parsed['paynowreference'] ?? reference;
        const pollUrl = parsed['pollurl'] ?? null;
        // Store payment record so webhook can resolve businessId + tier
        await pool.query(`INSERT INTO subscription_payments (business_id, tier, paynow_reference, poll_url, status)
       VALUES ($1, $2, $3, $4, 'pending')
       ON CONFLICT (paynow_reference) DO NOTHING`, [businessId, tier, paynowReference, pollUrl]);
        // Build final return URL with poll_url appended now that we have it
        const finalReturnUrl = pollUrl
            ? `${baseReturnUrl}?tier=${encodeURIComponent(tier)}&paynow_ref=${encodeURIComponent(paynowReference)}&poll_url=${encodeURIComponent(pollUrl)}`
            : `${baseReturnUrl}?tier=${encodeURIComponent(tier)}&paynow_ref=${encodeURIComponent(paynowReference)}`;
        return {
            success: true,
            paynowReference,
            pollUrl,
            paymentUrl: parsed['browserurl'] ?? null,
            returnUrl: finalReturnUrl,
        };
    }
    catch (err) {
        return { success: false, paynowReference: null, pollUrl: null, paymentUrl: null, error: err instanceof Error ? err.message : 'Network error.' };
    }
}
/**
 * Poll Paynow for the status of a subscription payment.
 */
export async function pollSubscriptionPaymentStatus(pollUrl) {
    try {
        const response = await fetch(pollUrl);
        const text = await response.text();
        const parsed = Object.fromEntries(new URLSearchParams(text));
        const status = (parsed['status'] ?? '').toLowerCase();
        const paynowReference = parsed['paynowreference'] ?? null;
        if (status === 'paid')
            return { status: 'paid', paynowReference };
        if (status === 'cancelled' || status === 'failed')
            return { status: 'failed', paynowReference };
        return { status: 'awaiting', paynowReference };
    }
    catch {
        return { status: 'awaiting', paynowReference: null };
    }
}
// ─── Webhook handler ──────────────────────────────────────────────────────────
/**
 * Handle an inbound Paynow subscription payment status webhook.
 * Looks up businessId + tier from subscription_payments table using the paynowreference.
 */
export async function handleSubscriptionPaymentWebhook(payload) {
    const { status, paynowReference, subscriptionId } = payload;
    // Look up businessId + tier from stored payment record
    let businessId = payload.businessId;
    let tier = payload.tier;
    if (paynowReference && (!businessId || !tier)) {
        const result = await pool.query(`SELECT business_id, tier FROM subscription_payments WHERE paynow_reference = $1 LIMIT 1`, [paynowReference]);
        if (result.rows.length > 0) {
            businessId = result.rows[0].business_id;
            tier = result.rows[0].tier;
        }
    }
    if (!businessId || !tier)
        return; // can't process without these
    if (status === 'Paid' || status === 'paid') {
        await activateSubscription(businessId, tier, paynowReference);
        await pool.query(`UPDATE subscription_payments SET status = 'paid', updated_at = NOW() WHERE paynow_reference = $1`, [paynowReference]);
    }
    else if (status === 'Failed' || status === 'Cancelled' || status === 'cancelled') {
        await pool.query(`UPDATE subscription_payments SET status = 'failed', updated_at = NOW() WHERE paynow_reference = $1`, [paynowReference]);
        if (subscriptionId) {
            await handleFailedRenewalPayment(subscriptionId);
        }
    }
}
// ─── Renewal billing job ──────────────────────────────────────────────────────
/**
 * Initiate subscription renewal charges for all subscriptions due today.
 * Intended to be called by a scheduled job at the start of each billing cycle.
 */
export async function processSubscriptionRenewals(getDueSubscriptions) {
    const due = await getDueSubscriptions();
    for (const sub of due) {
        const result = await initiateSubscriptionCharge(sub.businessId, sub.email, sub.priceUsd, `Augustus ${sub.plan} subscription renewal`, sub.plan);
        if (!result.success) {
            await handleFailedRenewalPayment(sub.id);
        }
        // On success, activation is triggered by the webhook handler above
    }
}
//# sourceMappingURL=paynow.subscription.js.map