/**
 * Subscription Expiry Job
 * Requirements: 1.1–1.7, 2.5, 2.6, 6.1, 6.3
 * Properties: 1, 2, 3, 4, 5, 14
 */

import { pool } from '../../db/client.js';
import { sendSubscriptionExpiredEmail } from '../../services/notification.stub.js';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ExpiryJobResult {
  totalChecked: number;
  totalCancelled: number;
  totalRemindersSent: number;
  totalErrors: number;
  errors: Array<{ subscriptionId: string; businessId: string; error: string }>;
}

/**
 * A row returned by the expired subscription query.
 * Joins subscriptions with businesses to include the business email.
 *
 * Requirements: 1.2
 */
export interface ExpiredSubscriptionRow {
  id: string;
  business_id: string;
  plan: string;
  renewal_date: Date;
  email: string;
}

// ─── Job Entry Point ──────────────────────────────────────────────────────────

/**
 * Run the daily subscription expiry job.
 *
 * Queries all active subscriptions whose renewal_date has passed, cancels each
 * one atomically (subscriptions.status → 'cancelled', businesses.status →
 * 'suspended'), sends a deactivation email, and writes an audit log entry.
 *
 * Per-subscription errors are caught and recorded; the job continues processing
 * remaining subscriptions. A structured summary is logged at INFO level on
 * completion.
 *
 * Requirements: 1.1, 1.6
 */
export async function runSubscriptionExpiryJob(): Promise<ExpiryJobResult> {
  const result: ExpiryJobResult = {
    totalChecked: 0,
    totalCancelled: 0,
    totalRemindersSent: 0,
    totalErrors: 0,
    errors: [],
  };

  // Query all active subscriptions whose renewal_date has passed.
  // JOIN businesses to retrieve the business email for notification.
  // Requirements: 1.2
  const { rows: expiredSubscriptions } = await pool.query<ExpiredSubscriptionRow>(`
    SELECT
      subscriptions.id,
      subscriptions.business_id,
      subscriptions.plan,
      subscriptions.renewal_date,
      businesses.email
    FROM subscriptions
    JOIN businesses ON businesses.id = subscriptions.business_id
    WHERE subscriptions.status = 'active'
      AND subscriptions.renewal_date < CURRENT_DATE
  `);

  result.totalChecked = expiredSubscriptions.length;

  // Process each expired subscription atomically.
  // Requirements: 1.3, 1.5, 1.7 (Task 6.3), 1.4, 2.5, 2.6, 6.1 (Task 6.4)
  for (const subscription of expiredSubscriptions) {
    const client = await pool.connect();
    try {
      // ── Task 6.3: Atomic cancellation transaction ──────────────────────────
      await client.query('BEGIN');

      await client.query(
        `UPDATE subscriptions SET status = 'cancelled', updated_at = NOW() WHERE id = $1`,
        [subscription.id],
      );

      await client.query(
        `UPDATE businesses SET status = 'suspended', updated_at = NOW() WHERE id = $1`,
        [subscription.business_id],
      );

      await client.query('COMMIT');

      // ── Task 6.4: Audit log write and expiry email send ────────────────────
      await pool.query(
        `INSERT INTO operator_audit_log (action_type, target_business_id, details)
         VALUES ($1, $2, $3)`,
        [
          'subscription_expired',
          subscription.business_id,
          JSON.stringify({
            subscriptionId: subscription.id,
            plan: subscription.plan,
            expiryDate: subscription.renewal_date,
          }),
        ],
      );

      try {
        await sendSubscriptionExpiredEmail(
          subscription.email,
          subscription.plan,
          subscription.renewal_date,
        );
      } catch (emailErr) {
        console.error(
          `[SubscriptionExpiryJob] Failed to send expiry email for business ${subscription.business_id} (${subscription.email}):`,
          emailErr,
        );
      }

      result.totalCancelled++;
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.error(
        `[SubscriptionExpiryJob] Error processing subscription ${subscription.id} for business ${subscription.business_id}: ${errorMessage}`,
      );
      result.errors.push({
        subscriptionId: subscription.id,
        businessId: subscription.business_id,
        error: errorMessage,
      });
      result.totalErrors++;
      continue;
    } finally {
      client.release();
    }
  }

  // ── Task 6.5: Structured summary log on job completion ────────────────────
  // Requirements: 1.6
  console.info(
    `[SubscriptionExpiryJob] Run complete: checked=${result.totalChecked}, cancelled=${result.totalCancelled}, reminders=${result.totalRemindersSent}, errors=${result.totalErrors}`,
  );

  return result;
}
