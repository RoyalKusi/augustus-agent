/**
 * Token Budget Controller
 * Tasks: 4.1–4.7, 4.9, 4.10
 * Requirements: 3.1–3.8
 * Properties: 8, 9, 10
 */

import { pool } from '../../db/client.js';
import { getPlan, type PlanTier } from '../subscription/plans.js';
import {
  sendBudgetAlert80Email,
  sendBudgetAlert95Email,
} from '../../services/notification.stub.js';

// ─── Types ────────────────────────────────────────────────────────────────────

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

interface TokenUsageRow {
  id: string;
  business_id: string;
  billing_cycle_start: string;
  accumulated_cost_usd: string;
  alert_80_sent: boolean;
  alert_95_sent: boolean;
  suspended: boolean;
  updated_at: Date;
}

// ─── Task 4.7: check_budget interface ────────────────────────────────────────

/**
 * Check whether a business is allowed to make a Claude Haiku inference call.
 * Property 8: once accumulated cost >= cap, returns allowed=false until cycle resets.
 * Property 10: every subsequent call after 100% cap returns allowed=false.
 */
export async function checkBudget(businessId: string): Promise<BudgetStatus> {
  const { usage, capUsd } = await getUsageAndCap(businessId);

  if (!usage) {
    // No usage record yet — budget is available
    return { allowed: true, remainingUsd: capUsd, accumulatedCostUsd: 0, capUsd, suspended: false };
  }

  const accumulated = Number(usage.accumulated_cost_usd);
  const remaining = Math.max(0, capUsd - accumulated);
  const suspended = usage.suspended || accumulated >= capUsd;

  return {
    allowed: !suspended,
    remainingUsd: remaining,
    accumulatedCostUsd: accumulated,
    capUsd,
    suspended,
  };
}

// ─── Task 4.2: Atomic cost increment ─────────────────────────────────────────

/**
 * Atomically increment the accumulated cost after a Claude Haiku inference call.
 * Then evaluate thresholds and enforce suspension if cap is reached.
 * Property 8: cap enforcement after increment.
 * Property 9: exactly one alert per threshold crossing per cycle.
 */
export async function recordInferenceCost(
  businessId: string,
  costUsd: number,
  businessEmail: string,
): Promise<BudgetStatus> {
  const cycleStart = await getCurrentCycleStart(businessId);
  // Get cap BEFORE incrementing so we can atomically enforce suspension
  const { capUsd } = await getUsageAndCap(businessId);

  // Upsert usage row and atomically increment cost + enforce suspension in one query
  const result = await pool.query<TokenUsageRow>(
    `INSERT INTO token_usage (business_id, billing_cycle_start, accumulated_cost_usd)
     VALUES ($1, $2, $3)
     ON CONFLICT (business_id, billing_cycle_start)
     DO UPDATE SET
       accumulated_cost_usd = token_usage.accumulated_cost_usd + $3,
       suspended = CASE
         WHEN (token_usage.accumulated_cost_usd + $3) >= $4 THEN TRUE
         ELSE token_usage.suspended
       END,
       updated_at = NOW()
     RETURNING *`,
    [businessId, cycleStart, costUsd, capUsd],
  );

  const usage = result.rows[0];
  const accumulated = Number(usage.accumulated_cost_usd);
  const pct = accumulated / capUsd;

  // Evaluate threshold alerts and suspension (Properties 9, 10)
  await evaluateThresholds(businessId, usage, pct, capUsd, businessEmail);

  const suspended = usage.suspended || accumulated >= capUsd;
  return {
    allowed: !suspended,
    remainingUsd: Math.max(0, capUsd - accumulated),
    accumulatedCostUsd: accumulated,
    capUsd,
    suspended,
  };
}

// ─── Task 4.3 / 4.4 / 4.5: Threshold evaluation ──────────────────────────────

/**
 * Evaluate 80%, 95%, and 100% thresholds after a cost increment.
 * Property 9: no duplicate alerts per cycle.
 * Property 10: suspend at 100%.
 */
async function evaluateThresholds(
  businessId: string,
  usage: TokenUsageRow,
  pct: number,
  capUsd: number,
  businessEmail: string,
): Promise<void> {
  const updates: string[] = [];

  // 80% alert — Property 9
  if (pct >= 0.8 && !usage.alert_80_sent) {
    await sendBudgetAlert80Email(businessEmail, pct * 100, capUsd);
    updates.push(`alert_80_sent = TRUE`);
  }

  // 95% alert — Property 9
  if (pct >= 0.95 && !usage.alert_95_sent) {
    await sendBudgetAlert95Email(businessEmail, pct * 100, capUsd);
    updates.push(`alert_95_sent = TRUE`);
  }

  // 100% suspension — Property 10
  if (pct >= 1.0 && !usage.suspended) {
    updates.push(`suspended = TRUE`);
  }

  if (updates.length > 0) {
    await pool.query(
      `UPDATE token_usage
       SET ${updates.join(', ')}, updated_at = NOW()
       WHERE business_id = $1 AND billing_cycle_start = $2`,
      [businessId, usage.billing_cycle_start],
    );
  }
}

// ─── Task 4.6: Operator hard limit override ───────────────────────────────────

/**
 * Set a hard token limit override for a business (operator action).
 */
export async function setHardLimitOverride(
  businessId: string,
  hardLimitUsd: number,
  operatorId: string,
): Promise<void> {
  await pool.query(
    `INSERT INTO business_token_overrides (business_id, hard_limit_usd, set_by_operator_id)
     VALUES ($1, $2, $3)
     ON CONFLICT (business_id)
     DO UPDATE SET hard_limit_usd = $2, set_by_operator_id = $3, updated_at = NOW()`,
    [businessId, hardLimitUsd, operatorId],
  );
}

/**
 * Remove a hard limit override, reverting to tier default.
 */
export async function removeHardLimitOverride(businessId: string): Promise<void> {
  await pool.query(
    `DELETE FROM business_token_overrides WHERE business_id = $1`,
    [businessId],
  );
}

// ─── Task 4.9: Billing cycle reset ───────────────────────────────────────────

/**
 * Reset the token usage accumulator for a business at the start of a new billing cycle.
 * Clears alert flags and suspension so AI responses resume.
 * Requirements: 3.6, 3.7
 */
export async function resetBillingCycle(businessId: string): Promise<void> {
  const newCycleStart = new Date().toISOString().split('T')[0];

  await pool.query(
    `INSERT INTO token_usage (business_id, billing_cycle_start, accumulated_cost_usd,
       alert_80_sent, alert_95_sent, suspended)
     VALUES ($1, $2, 0, FALSE, FALSE, FALSE)
     ON CONFLICT (business_id, billing_cycle_start) DO NOTHING`,
    [businessId, newCycleStart],
  );
}

/**
 * Scheduled job: reset all businesses whose billing cycle starts today.
 * Idempotent — uses ON CONFLICT DO NOTHING so safe to call multiple times per day.
 */
export async function runBillingCycleResetJob(): Promise<void> {
  const today = new Date().toISOString().split('T')[0];

  // Find all active subscriptions whose billing cycle starts today
  const result = await pool.query<{ business_id: string }>(
    `SELECT s.business_id
     FROM subscriptions s
     WHERE s.status = 'active'
       AND TO_CHAR(s.billing_cycle_start, 'MM-DD') = TO_CHAR($1::date, 'MM-DD')`,
    [today],
  );

  for (const row of result.rows) {
    await resetBillingCycle(row.business_id);
  }
}

// ─── Task 4.10: AI unavailability notification ────────────────────────────────

/**
 * Track whether the unavailability message has been sent for the current suspension event.
 * Returns true if the message should be sent (first time for this suspension).
 * Uses a Redis-style flag in token_usage to prevent duplicate messages.
 */
export async function shouldSendUnavailabilityMessage(businessId: string): Promise<boolean> {
  const cycleStart = await getCurrentCycleStart(businessId);

  // Use a dedicated column to track if the unavailability message was sent this suspension
  const result = await pool.query<{ unavailability_msg_sent: boolean }>(
    `SELECT unavailability_msg_sent
     FROM token_usage
     WHERE business_id = $1 AND billing_cycle_start = $2`,
    [businessId, cycleStart],
  );

  if (!result.rows.length || result.rows[0].unavailability_msg_sent) {
    return false;
  }

  // Mark as sent atomically
  await pool.query(
    `UPDATE token_usage
     SET unavailability_msg_sent = TRUE, updated_at = NOW()
     WHERE business_id = $1 AND billing_cycle_start = $2
       AND unavailability_msg_sent = FALSE`,
    [businessId, cycleStart],
  );

  return true;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Get the current billing cycle start date for a business.
 * Falls back to today if no active subscription exists.
 */
async function getCurrentCycleStart(businessId: string): Promise<string> {
  const result = await pool.query<{ billing_cycle_start: string }>(
    `SELECT TO_CHAR(billing_cycle_start, 'YYYY-MM-DD') AS billing_cycle_start
     FROM subscriptions
     WHERE business_id = $1 AND status = 'active'
     ORDER BY activation_timestamp DESC
     LIMIT 1`,
    [businessId],
  );

  return result.rows[0]?.billing_cycle_start ?? new Date().toISOString().split('T')[0];
}

/**
 * Fetch the current token_usage row and effective cap for a business.
 * Effective cap = hard limit override if set, otherwise tier default.
 */
async function getUsageAndCap(
  businessId: string,
): Promise<{ usage: TokenUsageRow | null; capUsd: number }> {
  const cycleStart = await getCurrentCycleStart(businessId);

  const [usageResult, overrideResult, subResult] = await Promise.all([
    pool.query<TokenUsageRow>(
      `SELECT * FROM token_usage
       WHERE business_id = $1 AND billing_cycle_start = $2`,
      [businessId, cycleStart],
    ),
    pool.query<{ hard_limit_usd: string }>(
      `SELECT hard_limit_usd FROM business_token_overrides WHERE business_id = $1`,
      [businessId],
    ),
    pool.query<{ plan: PlanTier }>(
      `SELECT plan FROM subscriptions WHERE business_id = $1 AND status = 'active' LIMIT 1`,
      [businessId],
    ),
  ]);

  const usage = usageResult.rows[0] ?? null;

  // Determine effective cap: override > tier default
  let capUsd: number;
  if (overrideResult.rows.length > 0) {
    capUsd = Number(overrideResult.rows[0].hard_limit_usd);
  } else if (subResult.rows.length > 0) {
    capUsd = getPlan(subResult.rows[0].plan).tokenBudgetUsd;
  } else {
    // No subscription — return 0 cap so unsubscribed businesses can't use AI
    capUsd = 0;
  }

  return { usage, capUsd };
}
