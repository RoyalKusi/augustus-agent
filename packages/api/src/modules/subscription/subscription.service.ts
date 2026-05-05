/**
 * Subscription Management Service
 * Requirements: 2.1–2.9
 * Properties: 5, 6, 7
 */

import { pool } from '../../db/client.js';
import { getPlan, calculateProration, isValidTier, type PlanTier } from './plans.js';
import {
  sendSubscriptionRenewalReminder,
  sendSubscriptionSuspendedEmail,
  sendPaymentFailedEmail,
} from '../../services/notification.stub.js';

// ─── Types ────────────────────────────────────────────────────────────────────

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

interface SubscriptionRow {
  id: string;
  business_id: string;
  plan: PlanTier;
  price_usd: string;
  status: 'active' | 'suspended' | 'cancelled';
  activation_timestamp: Date | null;
  renewal_date: Date | null;
  billing_cycle_start: Date | null;
  paynow_reference: string | null;
  created_at: Date;
  updated_at: Date;
}

function rowToSubscription(row: SubscriptionRow): Subscription {
  return {
    id: row.id,
    businessId: row.business_id,
    plan: row.plan,
    priceUsd: Number(row.price_usd),
    status: row.status,
    activationTimestamp: row.activation_timestamp,
    renewalDate: row.renewal_date,
    billingCycleStart: row.billing_cycle_start,
    paynowReference: row.paynow_reference,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ─── Task 3.2: Subscription Activation (Property 5) ──────────────────────────

/**
 * Activate a subscription after successful Paynow payment.
 * Property 5: status must be 'active' and activationTimestamp must be non-null.
 */
export async function activateSubscription(
  businessId: string,
  tier: PlanTier,
  paynowReference: string,
  billingMonths = 1,
): Promise<Subscription> {
  if (!isValidTier(tier)) {
    throw new Error(`Invalid subscription tier: ${tier}`);
  }

  const plan = getPlan(tier);
  const now = new Date();
  const cycleStart = now;
  const renewalDate = new Date(now);
  renewalDate.setMonth(renewalDate.getMonth() + Math.max(1, billingMonths));

  // Resolve price from plan_config DB (operator-configurable), fall back to hardcoded
  let priceUsd = plan.priceUsd;
  try {
    const dbPlan = await pool.query<{ price_usd: string }>(
      `SELECT price_usd FROM plan_config WHERE tier = $1`,
      [tier],
    );
    if (dbPlan.rows.length > 0) {
      priceUsd = Number(dbPlan.rows[0].price_usd);
    }
  } catch { /* use hardcoded fallback */ }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Deactivate any existing active subscription
    await client.query(
      `UPDATE subscriptions SET status = 'cancelled', updated_at = NOW()
       WHERE business_id = $1 AND status = 'active'`,
      [businessId],
    );

    const result = await client.query<SubscriptionRow>(
      `INSERT INTO subscriptions
         (business_id, plan, price_usd, status, activation_timestamp, renewal_date,
          billing_cycle_start, paynow_reference, billing_months)
       VALUES ($1, $2, $3, 'active', $4, $5, $6, $7, $8)
       RETURNING *`,
      [businessId, tier, priceUsd, now, renewalDate, cycleStart, paynowReference, Math.max(1, billingMonths)],
    );

    // Ensure business status is active
    await client.query(
      `UPDATE businesses SET status = 'active', updated_at = NOW() WHERE id = $1`,
      [businessId],
    );

    // Initialise token_usage record for this billing cycle
    await client.query(
      `INSERT INTO token_usage (business_id, billing_cycle_start)
       VALUES ($1, $2)
       ON CONFLICT (business_id, billing_cycle_start) DO NOTHING`,
      [businessId, cycleStart.toISOString().split('T')[0]],
    );

    // Check if this business was referred and calculate earnings
    const referralResult = await client.query<{ id: string; referrer_id: string }>(
      `SELECT id, referrer_id FROM referrals 
       WHERE referred_id = $1 AND status = 'registered'`,
      [businessId]
    );

    if (referralResult.rows.length > 0) {
      const referral = referralResult.rows[0];
      
      // Calculate earnings using the earnings service
      const { earningsService } = await import('../referral-earnings/earnings.service.js');
      const earnings = await earningsService.calculateEarnings(
        referral.id,
        plan.priceUsd
      );
      
      // Update referral status to 'subscribed'
      await client.query(
        `UPDATE referrals SET status = 'subscribed' WHERE id = $1`,
        [referral.id]
      );
    } else {
      // Mark referral as subscribed if this business was referred (fallback for existing code)
      await client.query(
        `UPDATE referrals SET status = 'subscribed' WHERE referred_id = $1 AND status = 'registered'`,
        [businessId],
      );
    }

    await client.query('COMMIT');
    
    // Send in-app notification for subscription activation
    const { notifySubscriptionUpdate } = await import('../notification/in-app-notification.helpers.js');
    void notifySubscriptionUpdate(businessId, 'renewed', {
      planName: tier,
      amount: priceUsd,
      renewalDate,
    }).catch(err => console.error('[Subscription] Failed to send notification:', err));
    
    return rowToSubscription(result.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// ─── Task 3.5: Plan Upgrade (Property 6) ─────────────────────────────────────

/**
 * Upgrade to a higher tier immediately with proration.
 * Property 6: new limits apply immediately; prorated charge = (daysRemaining/daysInCycle) * (newPrice - oldPrice)
 */
export async function upgradePlan(
  businessId: string,
  newTier: PlanTier,
  paynowReference: string,
): Promise<{ subscription: Subscription; proratedChargeUsd: number }> {
  const current = await getActiveSubscription(businessId);
  if (!current) throw new Error('No active subscription found.');

  const currentPlan = getPlan(current.plan);
  const newPlan = getPlan(newTier);

  if (newPlan.priceUsd <= currentPlan.priceUsd) {
    throw new Error('Upgrade requires a higher-priced plan. Use downgradePlan for lower tiers.');
  }

  const now = new Date();
  const cycleStart = current.billingCycleStart ?? now;
  const cycleEnd = current.renewalDate ?? new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  const proratedChargeUsd = calculateProration(
    currentPlan.priceUsd,
    newPlan.priceUsd,
    cycleStart,
    cycleEnd,
    now,
  );

  const result = await pool.query<SubscriptionRow>(
    `UPDATE subscriptions
     SET plan = $1, price_usd = $2, paynow_reference = $3, updated_at = NOW()
     WHERE id = $4
     RETURNING *`,
    [newTier, newPlan.priceUsd, paynowReference, current.id],
  );

  // Send in-app notification for upgrade
  const { notifySubscriptionUpdate } = await import('../notification/in-app-notification.helpers.js');
  void notifySubscriptionUpdate(businessId, 'upgraded', {
    oldPlanName: current.plan,
    planName: newTier,
    amount: proratedChargeUsd,
  }).catch(err => console.error('[Subscription] Failed to send notification:', err));

  return { subscription: rowToSubscription(result.rows[0]), proratedChargeUsd };
}

// ─── Task 3.6: Plan Downgrade (Property 7) ───────────────────────────────────

/**
 * Schedule a downgrade to take effect at the start of the next billing cycle.
 * Property 7: current cycle limits remain unchanged until cycle end.
 */
export async function downgradePlan(
  businessId: string,
  newTier: PlanTier,
): Promise<{ scheduledTier: PlanTier; effectiveDate: Date }> {
  const current = await getActiveSubscription(businessId);
  if (!current) throw new Error('No active subscription found.');

  const currentPlan = getPlan(current.plan);
  const newPlan = getPlan(newTier);

  if (newPlan.priceUsd >= currentPlan.priceUsd) {
    throw new Error('Downgrade requires a lower-priced plan. Use upgradePlan for higher tiers.');
  }

  const effectiveDate = current.renewalDate ?? new Date();

  // Store the pending downgrade — applied by the renewal job at cycle end
  await pool.query(
    `UPDATE subscriptions
     SET pending_downgrade_tier = $1, updated_at = NOW()
     WHERE id = $2`,
    [newTier, current.id],
  );

  // Send in-app notification for downgrade
  const { notifySubscriptionUpdate } = await import('../notification/in-app-notification.helpers.js');
  void notifySubscriptionUpdate(businessId, 'downgraded', {
    planName: newTier,
  }).catch(err => console.error('[Subscription] Failed to send notification:', err));

  return { scheduledTier: newTier, effectiveDate };
}

// ─── Task 3.3: Renewal Reminder Scheduling ───────────────────────────────────

/**
 * Check all active subscriptions and send renewal reminders at T-7 and T-1 days.
 * Intended to be called by a scheduled job (e.g., daily cron).
 */
export async function sendRenewalReminders(): Promise<void> {
  const result = await pool.query<{
    id: string;
    business_id: string;
    plan: PlanTier;
    renewal_date: Date;
    email: string;
    reminder_7_sent: boolean;
    reminder_1_sent: boolean;
  }>(
    `SELECT s.id, s.business_id, s.plan, s.renewal_date,
            b.email,
            s.reminder_7_sent, s.reminder_1_sent
     FROM subscriptions s
     JOIN businesses b ON b.id = s.business_id
     WHERE s.status = 'active'
       AND s.renewal_date IS NOT NULL`,
  );

  const now = new Date();

  for (const row of result.rows) {
    const renewalDate = new Date(row.renewal_date);
    const daysUntilRenewal = Math.round(
      (renewalDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
    );

    if (daysUntilRenewal === 7 && !row.reminder_7_sent) {
      await sendSubscriptionRenewalReminder(row.email, renewalDate, 7);
      await pool.query(
        `UPDATE subscriptions SET reminder_7_sent = TRUE, updated_at = NOW() WHERE id = $1`,
        [row.id],
      );
    } else if (daysUntilRenewal === 1 && !row.reminder_1_sent) {
      await sendSubscriptionRenewalReminder(row.email, renewalDate, 1);
      await pool.query(
        `UPDATE subscriptions SET reminder_1_sent = TRUE, updated_at = NOW() WHERE id = $1`,
        [row.id],
      );
    }
  }
}

// ─── Task 3.4: Failed Payment Retry Logic ────────────────────────────────────

/**
 * Handle a failed subscription renewal payment.
 * - First failure: schedule retry after 24 h, notify business.
 * - Second failure: suspend account, notify business.
 */
export async function handleFailedRenewalPayment(subscriptionId: string): Promise<void> {
  const result = await pool.query<{
    id: string;
    business_id: string;
    plan: PlanTier;
    failed_payment_attempts: number;
    email: string;
  }>(
    `SELECT s.id, s.business_id, s.plan, s.failed_payment_attempts, b.email
     FROM subscriptions s
     JOIN businesses b ON b.id = s.business_id
     WHERE s.id = $1`,
    [subscriptionId],
  );

  if (result.rows.length === 0) throw new Error('Subscription not found.');
  const sub = result.rows[0];
  const attempts = (sub.failed_payment_attempts ?? 0) + 1;

  if (attempts >= 2) {
    // Second failure — suspend
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        `UPDATE subscriptions
         SET status = 'suspended', failed_payment_attempts = $1, updated_at = NOW()
         WHERE id = $2`,
        [attempts, subscriptionId],
      );
      await client.query(
        `UPDATE businesses SET status = 'suspended', updated_at = NOW() WHERE id = $1`,
        [sub.business_id],
      );
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
    await sendSubscriptionSuspendedEmail(sub.email);
  } else {
    // First failure — schedule retry after 24 h
    const retryAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await pool.query(
      `UPDATE subscriptions
       SET failed_payment_attempts = $1, next_retry_at = $2, updated_at = NOW()
       WHERE id = $3`,
      [attempts, retryAt, subscriptionId],
    );
    await sendPaymentFailedEmail(sub.email, retryAt);
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export async function getActiveSubscription(businessId: string): Promise<Subscription | null> {
  const result = await pool.query<SubscriptionRow>(
    `SELECT * FROM subscriptions WHERE business_id = $1 AND status = 'active' LIMIT 1`,
    [businessId],
  );
  return result.rows.length > 0 ? rowToSubscription(result.rows[0]) : null;
}

export async function getSubscriptionById(id: string): Promise<Subscription | null> {
  const result = await pool.query<SubscriptionRow>(
    `SELECT * FROM subscriptions WHERE id = $1`,
    [id],
  );
  return result.rows.length > 0 ? rowToSubscription(result.rows[0]) : null;
}

// ─── Scheduled: Apply pending downgrades ─────────────────────────────────────

/**
 * Apply any pending downgrades whose renewal_date has passed.
 * Called by the daily job runner.
 */
export async function applyPendingDowngrades(): Promise<void> {
  const result = await pool.query<{
    id: string;
    business_id: string;
    pending_downgrade_tier: PlanTier;
    email: string;
  }>(
    `SELECT s.id, s.business_id, s.pending_downgrade_tier, b.email
     FROM subscriptions s
     JOIN businesses b ON b.id = s.business_id
     WHERE s.status = 'active'
       AND s.pending_downgrade_tier IS NOT NULL
       AND s.renewal_date IS NOT NULL
       AND s.renewal_date <= CURRENT_DATE`,
  );

  for (const row of result.rows) {
    const newPlan = getPlan(row.pending_downgrade_tier);
    const now = new Date();
    const newRenewal = new Date(now);
    newRenewal.setMonth(newRenewal.getMonth() + 1);

    await pool.query(
      `UPDATE subscriptions
       SET plan = $1, price_usd = $2, pending_downgrade_tier = NULL,
           renewal_date = $3, billing_cycle_start = $4, updated_at = NOW()
       WHERE id = $5`,
      [row.pending_downgrade_tier, newPlan.priceUsd, newRenewal, now, row.id],
    );

    console.info(`[Subscription] Applied downgrade to ${row.pending_downgrade_tier} for business ${row.business_id}`);
  }
}

// ─── Scheduled: Retry failed payments ────────────────────────────────────────

/**
 * Retry subscription payments that are past their next_retry_at time.
 * Called by the daily job runner.
 */
export async function retryFailedPayments(): Promise<void> {
  const result = await pool.query<{
    id: string;
    business_id: string;
    plan: PlanTier;
    failed_payment_attempts: number;
    email: string;
  }>(
    `SELECT s.id, s.business_id, s.plan, s.failed_payment_attempts, b.email
     FROM subscriptions s
     JOIN businesses b ON b.id = s.business_id
     WHERE s.status = 'active'
       AND s.next_retry_at IS NOT NULL
       AND s.next_retry_at <= NOW()
       AND s.failed_payment_attempts < 2`,
  );

  for (const row of result.rows) {
    // Clear the retry timestamp so it doesn't fire again immediately
    await pool.query(
      `UPDATE subscriptions SET next_retry_at = NULL, updated_at = NOW() WHERE id = $1`,
      [row.id],
    );

    // Log the retry attempt — actual Paynow charge happens when renewal is implemented
    console.info(`[Subscription] Retry payment due for business ${row.business_id} (attempt ${row.failed_payment_attempts + 1})`);

    // If this is the second attempt and it still hasn't been paid, suspend
    if (row.failed_payment_attempts >= 1) {
      await handleFailedRenewalPayment(row.id);
    }
  }
}
