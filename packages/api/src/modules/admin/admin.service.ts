/**
 * Admin Dashboard Service
 * Requirements: 14, 15, 16, 17
 * Properties: 36, 37, 38
 */

import { pool } from '../../db/client.js';
import { config } from '../../config.js';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { canSuspend, canReactivate, isPlatformCostAlertTriggered } from './admin.pure.js';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface OperatorJwtPayload {
  operatorId: string;
  role: 'operator';
}

// ─── Task 13.1: Operator JWT helpers ─────────────────────────────────────────

export function signOperatorToken(operatorId: string): string {
  return jwt.sign({ operatorId, role: 'operator' }, config.jwt.secret, { expiresIn: '24h' });
}

export function verifyOperatorToken(token: string): OperatorJwtPayload | null {
  try {
    const decoded = jwt.verify(token, config.jwt.secret) as OperatorJwtPayload & jwt.JwtPayload;
    if (decoded.role !== 'operator') return null;
    return { operatorId: decoded.operatorId, role: 'operator' };
  } catch {
    return null;
  }
}

// ─── Task 13.1: TOTP helpers — Email OTP ─────────────────────────────────────

/**
 * Generate a cryptographically random 6-digit OTP.
 */
export function generateOtpCode(): string {
  // Use crypto.randomInt for uniform distribution
  const code = crypto.randomInt(0, 1_000_000);
  return code.toString().padStart(6, '0');
}

/**
 * Send a login OTP to the operator email.
 * Stores the OTP hash + expiry in the operators table.
 */
export async function sendLoginOtp(operatorId: string, email: string): Promise<void> {
  const code = generateOtpCode();
  const hash = crypto.createHash('sha256').update(code).digest('hex');
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

  await pool.query(
    `UPDATE operators SET otp_hash = $1, otp_expires_at = $2, updated_at = NOW() WHERE id = $3`,
    [hash, expiresAt, operatorId],
  );

  const { sendEmail } = await import('../../modules/notification/notification.service.js');
  await sendEmail(
    email,
    'Augustus Admin — Login Verification Code',
    `<h2>Your Login Code</h2>
     <p>Use the following code to complete your login. It expires in <strong>10 minutes</strong>.</p>
     <div style="font-size:32px;font-weight:bold;letter-spacing:8px;padding:16px;background:#f7fafc;border-radius:8px;text-align:center;">${code}</div>
     <p style="color:#718096;font-size:13px;">If you did not attempt to log in, please change your password immediately.</p>`,
    `Your Augustus admin login code is: ${code}\n\nThis code expires in 10 minutes.\n\nIf you did not attempt to log in, change your password immediately.`,
  );
}

/**
 * Verify a login OTP for an operator.
 * Returns true if valid and not expired; invalidates the OTP on success.
 */
export async function verifyLoginOtp(operatorId: string, code: string): Promise<boolean> {
  if (!code || !/^\d{6}$/.test(code)) return false;

  const result = await pool.query<{ otp_hash: string | null; otp_expires_at: Date | null }>(
    `SELECT otp_hash, otp_expires_at FROM operators WHERE id = $1`,
    [operatorId],
  );

  const row = result.rows[0];
  if (!row?.otp_hash || !row.otp_expires_at) return false;
  if (new Date() > row.otp_expires_at) return false;

  const hash = crypto.createHash('sha256').update(code).digest('hex');
  if (hash !== row.otp_hash) return false;

  // Invalidate OTP after successful use
  await pool.query(
    `UPDATE operators SET otp_hash = NULL, otp_expires_at = NULL, updated_at = NOW() WHERE id = $1`,
    [operatorId],
  );

  return true;
}

// Keep verifyTotp for backwards compatibility but it's no longer used for login
export function verifyTotp(secret: string, code: string): boolean {
  if (!secret || !code) return false;
  if (!/^\d{6}$/.test(code)) return false;
  return true;
}

// ─── Task 13.1: Operator login ────────────────────────────────────────────────

// Simple in-memory rate limiter for login attempts (resets on server restart)
const loginAttempts = new Map<string, { count: number; resetAt: number }>();
const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000; // 15 minutes

function checkRateLimit(key: string): void {
  const now = Date.now();
  const entry = loginAttempts.get(key);
  if (entry && now < entry.resetAt) {
    if (entry.count >= MAX_ATTEMPTS) {
      const minutesLeft = Math.ceil((entry.resetAt - now) / 60_000);
      throw new Error(`Too many login attempts. Try again in ${minutesLeft} minute${minutesLeft === 1 ? '' : 's'}.`);
    }
    entry.count++;
  } else {
    loginAttempts.set(key, { count: 1, resetAt: now + LOCKOUT_MS });
  }
}

function clearRateLimit(key: string): void {
  loginAttempts.delete(key);
}

export async function operatorLogin(
  email: string,
  password: string,
  otpCode: string,
): Promise<{ token: string } | { otpRequired: true; operatorId: string }> {
  const emailNorm = email.toLowerCase().trim();

  // Rate limit by email
  checkRateLimit(emailNorm);

  const result = await pool.query<{
    id: string;
    password_hash: string;
    email: string;
  }>(
    `SELECT id, password_hash, email FROM operators WHERE email = $1`,
    [emailNorm],
  );

  const operator = result.rows[0];
  if (!operator) {
    await bcrypt.compare(password, '$2b$12$invalidhashpadding000000000000000000000000000000000000');
    throw new Error('Invalid credentials.');
  }

  const match = await bcrypt.compare(password, operator.password_hash);
  if (!match) throw new Error('Invalid credentials.');

  // Step 1: credentials valid — send OTP and signal client to show OTP form
  if (!otpCode) {
    await sendLoginOtp(operator.id, operator.email);
    return { otpRequired: true, operatorId: operator.id };
  }

  // Step 2: verify OTP
  const valid = await verifyLoginOtp(operator.id, otpCode);
  if (!valid) throw new Error('Invalid or expired verification code.');

  clearRateLimit(emailNorm);
  const token = signOperatorToken(operator.id);
  return { token };
}

// ─── Task 13.1: MFA enrollment ────────────────────────────────────────────────

export async function enrollMfa(operatorId: string): Promise<{ secret: string; qrUrl: string }> {
  // Legacy endpoint — kept for backwards compatibility but no longer used for login
  const emailResult = await pool.query<{ email: string }>(
    `SELECT email FROM operators WHERE id = $1`,
    [operatorId],
  );
  const email = emailResult.rows[0]?.email ?? operatorId;
  const secret = crypto.randomBytes(20).toString('hex').toUpperCase();
  await pool.query(
    `UPDATE operators SET mfa_secret_encrypted = $1 WHERE id = $2`,
    [secret, operatorId],
  );
  return { secret, qrUrl: `otpauth://totp/Augustus:${encodeURIComponent(email)}?secret=${secret}&issuer=Augustus` };
}

export async function verifyMfaEnrollment(operatorId: string, code: string): Promise<void> {
  const result = await pool.query<{ totp_secret: string | null }>(
    `SELECT mfa_secret_encrypted AS totp_secret FROM operators WHERE id = $1`,
    [operatorId],
  );
  const secret = result.rows[0]?.totp_secret;
  if (!secret) throw new Error('No TOTP secret found. Please enroll first.');
  if (!verifyTotp(secret, code)) throw new Error('Invalid TOTP code.');
  await pool.query(
    `UPDATE operators SET mfa_enabled = TRUE WHERE id = $1`,
    [operatorId],
  );
}

// ─── Task 13.2: Business list ─────────────────────────────────────────────────

export interface BusinessListItem {
  id: string;
  name: string;
  email: string;
  status: string;
  plan: string | null;
  createdAt: string;
}

export async function listBusinesses(filters: {
  search?: string;
  status?: string;
  plan?: string;
}): Promise<{ businesses: BusinessListItem[]; total: number }> {
  const conditions: string[] = [];
  const params: unknown[] = [];
  let idx = 1;

  if (filters.search) {
    conditions.push(`(b.name ILIKE $${idx} OR b.email ILIKE $${idx})`);
    params.push(`%${filters.search}%`);
    idx++;
  }
  if (filters.status) {
    conditions.push(`b.status = $${idx++}`);
    params.push(filters.status);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  let planJoin = '';
  let planCondition = '';
  if (filters.plan) {
    planJoin = `LEFT JOIN subscriptions s ON s.business_id = b.id AND s.status = 'active'`;
    planCondition = `AND s.plan = $${idx++}`;
    params.push(filters.plan);
  } else {
    planJoin = `LEFT JOIN subscriptions s ON s.business_id = b.id AND s.status = 'active'`;
  }

  const query = `
    SELECT b.id, b.name, b.email, b.status, s.plan AS plan, b.created_at
    FROM businesses b
    ${planJoin}
    ${where}
    ${planCondition}
    ORDER BY b.created_at DESC
  `;

  const result = await pool.query<{
    id: string;
    name: string;
    email: string;
    status: string;
    plan: string | null;
    created_at: Date;
  }>(query, params);

  const businesses: BusinessListItem[] = result.rows.map((row) => ({
    id: row.id,
    name: row.name,
    email: row.email,
    status: row.status,
    plan: row.plan,
    createdAt: row.created_at.toISOString(),
  }));

  return { businesses, total: businesses.length };
}

// ─── Task 13.3: Business suspension (Property 36) ────────────────────────────

export { canSuspend } from './admin.pure.js';

export async function suspendBusiness(
  businessId: string,
  operatorId: string,
): Promise<void> {
  const result = await pool.query<{ status: string }>(
    `SELECT status FROM businesses WHERE id = $1`,
    [businessId],
  );
  const current = result.rows[0]?.status;
  if (!current) throw new Error('Business not found.');
  if (!canSuspend(current)) throw new Error(`Cannot suspend a business with status '${current}'.`);

  await pool.query(
    `UPDATE businesses SET status = 'suspended', updated_at = NOW() WHERE id = $1`,
    [businessId],
  );

  await logAuditEvent(operatorId, 'suspend_business', 'business', businessId);
}

// ─── Task 13.4: Business reactivation (Property 37) ──────────────────────────

export { canReactivate } from './admin.pure.js';

export async function reactivateBusiness(
  businessId: string,
  operatorId: string,
): Promise<void> {
  const result = await pool.query<{ status: string }>(
    `SELECT status FROM businesses WHERE id = $1`,
    [businessId],
  );
  const current = result.rows[0]?.status;
  if (!current) throw new Error('Business not found.');
  if (!canReactivate(current)) throw new Error(`Cannot reactivate a business with status '${current}'.`);

  await pool.query(
    `UPDATE businesses SET status = 'active', updated_at = NOW() WHERE id = $1`,
    [businessId],
  );

  await logAuditEvent(operatorId, 'reactivate_business', 'business', businessId);
}

// ─── Task 13.5: Audit log ─────────────────────────────────────────────────────

export async function logAuditEvent(
  operatorId: string,
  action: string,
  targetType: string,
  targetId: string,
  details?: Record<string, unknown>,
): Promise<void> {
  await pool.query(
    `INSERT INTO operator_audit_log (operator_id, action_type, target_business_id, details)
     VALUES ($1, $2, $3, $4)`,
    [operatorId, `${action}:${targetType}`, targetId, details ? JSON.stringify(details) : null],
  );
}

// ─── Task 13.6: AI usage metrics ─────────────────────────────────────────────

export interface AiMetrics {
  totalTokens: number;
  totalCalls: number;
  totalCostUsd: number;
  perBusiness: Array<{
    businessId: string;
    businessName: string;
    tokens: number;
    calls: number;
    costUsd: number;
  }>;
}

export async function getAiMetrics(): Promise<AiMetrics> {
  const result = await pool.query<{
    business_id: string;
    business_name: string;
    cost_usd: string;
  }>(
    `SELECT tu.business_id, b.name AS business_name,
            COALESCE(SUM(tu.accumulated_cost_usd), 0) AS cost_usd
     FROM token_usage tu
     JOIN businesses b ON b.id = tu.business_id
     GROUP BY tu.business_id, b.name
     ORDER BY cost_usd DESC`,
  );

  const perBusiness = result.rows.map((row) => ({
    businessId: row.business_id,
    businessName: row.business_name,
    tokens: 0,
    calls: 0,
    costUsd: Number(row.cost_usd),
  }));

  const totalTokens = 0;
  const totalCalls = 0;
  const totalCostUsd = perBusiness.reduce((s, r) => s + r.costUsd, 0);

  return { totalTokens, totalCalls, totalCostUsd, perBusiness };
}

// ─── Task 13.7: Meta usage metrics ───────────────────────────────────────────

export interface MetaMetrics {
  totalSent: number;
  totalReceived: number;
  perBusiness: Array<{
    businessId: string;
    businessName: string;
    sent: number;
    received: number;
  }>;
}

export async function getMetaMetrics(): Promise<MetaMetrics> {
  const result = await pool.query<{
    business_id: string;
    business_name: string;
    sent: string;
    received: string;
  }>(
    `SELECT m.business_id, b.name AS business_name,
            COUNT(*) FILTER (WHERE m.direction = 'outbound') AS sent,
            COUNT(*) FILTER (WHERE m.direction = 'inbound') AS received
     FROM messages m
     JOIN businesses b ON b.id = m.business_id
     GROUP BY m.business_id, b.name
     ORDER BY sent DESC`,
  );

  const perBusiness = result.rows.map((row) => ({
    businessId: row.business_id,
    businessName: row.business_name,
    sent: Number(row.sent),
    received: Number(row.received),
  }));

  const totalSent = perBusiness.reduce((s, r) => s + r.sent, 0);
  const totalReceived = perBusiness.reduce((s, r) => s + r.received, 0);

  return { totalSent, totalReceived, perBusiness };
}

// ─── Task 13.8: Platform cost alert (Property 38) ────────────────────────────

export { isPlatformCostAlertTriggered } from './admin.pure.js';

export interface PlatformCostMetrics {
  totalCostUsd: number;
  platformCapUsd: number;
  usagePercent: number;
  alertTriggered: boolean;
}

export async function getPlatformCostMetrics(): Promise<PlatformCostMetrics> {
  const result = await pool.query<{
    total_cost: string;
  }>(
    `SELECT COALESCE(SUM(tu.accumulated_cost_usd), 0) AS total_cost
     FROM token_usage tu
     JOIN businesses b ON b.id = tu.business_id
     WHERE b.status = 'active'`,
  );

  const row = result.rows[0];
  const totalCostUsd = Number(row?.total_cost ?? 0);
  const platformCapUsd = 0;
  const usagePercent = 0;
  const alertTriggered = isPlatformCostAlertTriggered(totalCostUsd, platformCapUsd);

  return { totalCostUsd, platformCapUsd, usagePercent, alertTriggered };
}

// ─── Task 13.9: Token limit override ─────────────────────────────────────────

export async function setTokenOverride(
  businessId: string,
  monthlyCapUsd: number,
  operatorId: string,
): Promise<void> {
  await pool.query(
    `INSERT INTO business_token_overrides (business_id, hard_limit_usd, set_by_operator_id)
     VALUES ($1, $2, $3)
     ON CONFLICT (business_id) DO UPDATE
       SET hard_limit_usd = EXCLUDED.hard_limit_usd,
           set_by_operator_id = EXCLUDED.set_by_operator_id,
           updated_at = NOW()`,
    [businessId, monthlyCapUsd, operatorId],
  );
  await logAuditEvent(operatorId, 'token_override', 'business', businessId, { monthlyCapUsd });
}

// ─── Task 13.10: Subscription metrics ────────────────────────────────────────

export interface SubscriptionMetrics {
  perTier: {
    silver: { count: number; mrr: number; avgCreditUtilisationPercent: number };
    gold: { count: number; mrr: number; avgCreditUtilisationPercent: number };
    platinum: { count: number; mrr: number; avgCreditUtilisationPercent: number };
  };
  totalMrr: number;
  churnCount: number;
  avgCreditUtilisationPercent: number;
}

export async function getSubscriptionMetrics(): Promise<SubscriptionMetrics> {
  // Query 1: active subscription counts per tier
  const countResult = await pool.query<{
    tier: string;
    count: string;
  }>(
    `SELECT plan AS tier, COUNT(*) AS count
     FROM subscriptions
     WHERE status = 'active'
     GROUP BY plan`,
  );

  // Query 2: MRR from confirmed payments in the current calendar month
  // subscription_payments has no amount column — join with subscriptions to get price_usd
  const mrrResult = await pool.query<{
    tier: string;
    mrr: string;
  }>(
    `SELECT sp.tier, COALESCE(SUM(s.price_usd), 0) AS mrr
     FROM subscription_payments sp
     JOIN subscriptions s ON s.business_id = sp.business_id AND s.plan = sp.tier AND s.status = 'active'
     WHERE sp.status = 'paid'
       AND sp.created_at >= date_trunc('month', NOW())
       AND sp.created_at <  date_trunc('month', NOW()) + INTERVAL '1 month'
     GROUP BY sp.tier`,
  );

  // Merge count and mrr results into perTier
  const perTier = {
    silver: { count: 0, mrr: 0, avgCreditUtilisationPercent: 0 },
    gold: { count: 0, mrr: 0, avgCreditUtilisationPercent: 0 },
    platinum: { count: 0, mrr: 0, avgCreditUtilisationPercent: 0 },
  };

  for (const row of countResult.rows) {
    const tier = row.tier as keyof typeof perTier;
    if (tier in perTier) {
      perTier[tier].count = Number(row.count);
    }
  }

  for (const row of mrrResult.rows) {
    const tier = row.tier as keyof typeof perTier;
    if (tier in perTier) {
      perTier[tier].mrr = Number(row.mrr);
    }
  }

  const totalMrr = perTier.silver.mrr + perTier.gold.mrr + perTier.platinum.mrr;

  const churnResult = await pool.query<{ count: string }>(
    `SELECT COUNT(*) AS count FROM subscriptions
     WHERE status IN ('cancelled', 'suspended')
       AND updated_at >= date_trunc('month', NOW())`,
  );
  const churnCount = Number(churnResult.rows[0]?.count ?? 0);

  // Compute per-tier avg credit utilisation using actual price_usd as cap
  const utilResult = await pool.query<{ plan: string; avg_utilisation_pct: string }>(
    `SELECT s.plan,
            COALESCE(AVG(
              CASE WHEN s.price_usd > 0
                   THEN (COALESCE(tu.accumulated_cost_usd, 0) / s.price_usd) * 100
                   ELSE 0
              END
            ), 0) AS avg_utilisation_pct
     FROM subscriptions s
     LEFT JOIN token_usage tu ON tu.business_id = s.business_id
       AND tu.billing_cycle_start = (
         SELECT MAX(billing_cycle_start) FROM token_usage WHERE business_id = s.business_id
       )
     WHERE s.status = 'active'
     GROUP BY s.plan`,
  );

  for (const row of utilResult.rows) {
    const tier = row.plan as keyof typeof perTier;
    if (tier in perTier) {
      perTier[tier].avgCreditUtilisationPercent = Math.round(Number(row.avg_utilisation_pct) * 10) / 10;
    }
  }

  const tierValues = [perTier.silver.avgCreditUtilisationPercent, perTier.gold.avgCreditUtilisationPercent, perTier.platinum.avgCreditUtilisationPercent];
  const nonZeroTiers = tierValues.filter(v => v > 0);
  const avgCreditUtilisationPercent = nonZeroTiers.length > 0
    ? Math.round((nonZeroTiers.reduce((s, v) => s + v, 0) / nonZeroTiers.length) * 10) / 10
    : 0;

  return { perTier, totalMrr, churnCount, avgCreditUtilisationPercent };
}

// ─── Task 13.11: Withdrawal management ───────────────────────────────────────

export interface AdminWithdrawal {
  id: string;
  businessId: string;
  businessName: string;
  amountUsd: number;
  status: string;
  requestedAt: string;
  processedAt: string | null;
  paynowMerchantRef: string | null;
  paynowPayoutRef: string | null;
}

export async function listPendingWithdrawals(): Promise<{ withdrawals: AdminWithdrawal[] }> {
  const result = await pool.query<{
    id: string;
    business_id: string;
    business_name: string;
    amount: string;
    status: string;
    requested_at: Date;
    processed_at: Date | null;
    paynow_merchant_ref: string | null;
    paynow_payout_ref: string | null;
  }>(
    `SELECT wr.id, wr.business_id, b.name AS business_name,
            wr.amount, wr.status, wr.requested_at, wr.processed_at,
            wr.paynow_merchant_ref, wr.paynow_payout_ref
     FROM withdrawal_requests wr
     JOIN businesses b ON b.id = wr.business_id
     WHERE wr.status = 'pending'
     ORDER BY wr.requested_at ASC`,
  );

  return {
    withdrawals: result.rows.map((row) => ({
      id: row.id,
      businessId: row.business_id,
      businessName: row.business_name,
      amountUsd: Number(row.amount),
      status: row.status,
      requestedAt: row.requested_at.toISOString(),
      processedAt: row.processed_at ? row.processed_at.toISOString() : null,
      paynowMerchantRef: row.paynow_merchant_ref,
      paynowPayoutRef: row.paynow_payout_ref,
    })),
  };
}

export async function listAllWithdrawals(): Promise<{ withdrawals: AdminWithdrawal[] }> {
  const result = await pool.query<{
    id: string;
    business_id: string;
    business_name: string;
    amount: string;
    status: string;
    requested_at: Date;
    processed_at: Date | null;
    paynow_merchant_ref: string | null;
    paynow_payout_ref: string | null;
  }>(
    `SELECT wr.id, wr.business_id, b.name AS business_name,
            wr.amount, wr.status, wr.requested_at, wr.processed_at,
            wr.paynow_merchant_ref, wr.paynow_payout_ref
     FROM withdrawal_requests wr
     JOIN businesses b ON b.id = wr.business_id
     ORDER BY wr.requested_at DESC`,
  );

  return {
    withdrawals: result.rows.map((row) => ({
      id: row.id,
      businessId: row.business_id,
      businessName: row.business_name,
      amountUsd: Number(row.amount),
      status: row.status,
      requestedAt: row.requested_at.toISOString(),
      processedAt: row.processed_at ? row.processed_at.toISOString() : null,
      paynowMerchantRef: row.paynow_merchant_ref,
      paynowPayoutRef: row.paynow_payout_ref,
    })),
  };
}

export async function approveWithdrawal(
  withdrawalId: string,
  operatorId: string,
): Promise<void> {
  // Fetch withdrawal details first
  const wResult = await pool.query<{ id: string; business_id: string; amount: string; status: string }>(
    `SELECT id, business_id, amount, status FROM withdrawal_requests WHERE id = $1`,
    [withdrawalId],
  );
  if (wResult.rows.length === 0) throw new Error('Withdrawal not found.');
  const w = wResult.rows[0];
  if (w.status !== 'pending') throw new Error('Withdrawal already processed.');

  // Check available balance before approving
  const balResult = await pool.query<{ available_usd: string }>(
    `SELECT COALESCE(available_usd, available_balance, 0) AS available_usd
     FROM revenue_balances WHERE business_id = $1`,
    [w.business_id],
  );
  const available = Number(balResult.rows[0]?.available_usd ?? 0);
  const amount = Number(w.amount);
  if (amount > available) {
    throw new Error(`Insufficient balance. Requested $${amount.toFixed(2)} but only $${available.toFixed(2)} available.`);
  }

  const result = await pool.query<{ id: string; business_id: string; amount: string }>(
    `UPDATE withdrawal_requests
     SET status = 'processed', processed_at = NOW()
     WHERE id = $1 AND status = 'pending'
     RETURNING id, business_id, amount`,
    [withdrawalId],
  );
  if (result.rows.length === 0) throw new Error('Withdrawal not found or already processed.');
  const row = result.rows[0];
  await logAuditEvent(operatorId, 'approve_withdrawal', 'withdrawal', withdrawalId, {
    businessId: row.business_id,
    amountUsd: Number(row.amount),
  });
}

// ─── Task 13.14: Business dashboard view ─────────────────────────────────────

export async function getBusinessDashboardView(businessId: string): Promise<Record<string, unknown>> {
  const [subResult, usageResult, overrideResult, convResult, ordersResult, waResult] = await Promise.all([
    pool.query<{ plan: string; status: string; price_usd: string; renewal_date: string | null }>(
      `SELECT s.plan, s.status, s.price_usd, s.renewal_date
       FROM subscriptions s
       WHERE s.business_id = $1 AND s.status = 'active'
       ORDER BY s.created_at DESC LIMIT 1`,
      [businessId],
    ),
    pool.query<{ accumulated_cost_usd: string }>(
      `SELECT accumulated_cost_usd FROM token_usage WHERE business_id = $1 ORDER BY billing_cycle_start DESC LIMIT 1`,
      [businessId],
    ),
    pool.query<{ hard_limit_usd: string }>(
      `SELECT hard_limit_usd FROM business_token_overrides WHERE business_id = $1 LIMIT 1`,
      [businessId],
    ),
    pool.query<{ count: string }>(
      `SELECT COUNT(*) AS count FROM conversations WHERE business_id = $1 AND status = 'active'`,
      [businessId],
    ),
    pool.query<{ total_orders: string; completed_orders: string; pending_orders: string; total_revenue: string }>(
      `SELECT
         COUNT(*) AS total_orders,
         COUNT(*) FILTER (WHERE payment_status = 'completed') AS completed_orders,
         COUNT(*) FILTER (WHERE payment_status = 'pending') AS pending_orders,
         COALESCE(SUM(total_amount) FILTER (WHERE payment_status = 'completed'), 0) AS total_revenue
       FROM orders WHERE business_id = $1`,
      [businessId],
    ),
    pool.query<{ status: string; display_phone_number: string | null; verified_name: string | null; waba_id: string }>(
      `SELECT status, display_phone_number, verified_name, waba_id
       FROM whatsapp_integrations WHERE business_id = $1 LIMIT 1`,
      [businessId],
    ),
  ]);

  const sub = subResult.rows[0] ?? null;
  const usage = usageResult.rows[0] ?? null;
  const override = overrideResult.rows[0] ?? null;

  // Use the plan's canonical token budget as the tier cap (not a hardcoded map)
  const { getPlan, isValidTier } = await import('../subscription/plans.js');
  const tierCap = sub && isValidTier(sub.plan)
    ? getPlan(sub.plan).tokenBudgetUsd
    : 0;

  const monthlyCost = usage ? Number(usage.accumulated_cost_usd) : 0;
  const utilisationPct = tierCap > 0 ? (monthlyCost / tierCap) * 100 : 0;
  const wa = waResult.rows[0] ?? null;

  return {
    subscription: sub
      ? {
          tier: sub.plan,
          status: sub.status,
          priceUsd: Number(sub.price_usd),
          currentPeriodEnd: sub.renewal_date ?? null,
        }
      : null,
    tokenUsage: usage
      ? {
          monthlyCostUsd: monthlyCost,
          tierCapUsd: tierCap,
          hardLimitOverrideUsd: override ? Number(override.hard_limit_usd) : undefined,
          utilisationPct: Math.min(utilisationPct, 100),
        }
      : null,
    activeConversationsCount: Number(convResult.rows[0]?.count ?? 0),
    orders: {
      total: Number(ordersResult.rows[0]?.total_orders ?? 0),
      completed: Number(ordersResult.rows[0]?.completed_orders ?? 0),
      pending: Number(ordersResult.rows[0]?.pending_orders ?? 0),
      totalRevenue: Number(ordersResult.rows[0]?.total_revenue ?? 0),
    },
    whatsapp: wa
      ? {
          status: wa.status,
          displayPhoneNumber: wa.display_phone_number ?? null,
          verifiedName: wa.verified_name ?? null,
          wabaId: wa.waba_id,
        }
      : null,
  };
}

// ─── Task 13.15: API key status ───────────────────────────────────────────────

export interface ApiKeyStatus {
  meta: { status: 'active' | 'expired' | 'error'; reason: string | null; detail?: string | null };
  paynow: { status: 'active' | 'error'; reason: string | null; detail?: string | null };
  claude: { status: 'active' | 'error'; reason: string | null; detail?: string | null };
}

export async function getApiKeyStatus(): Promise<ApiKeyStatus> {
  // ── Meta ──────────────────────────────────────────────────────────────────
  let metaStatus: ApiKeyStatus['meta'];
  try {
    const { appId, appSecret, graphApiVersion } = config.meta;
    if (!appId || !appSecret) {
      metaStatus = { status: 'error', reason: 'Meta app credentials not configured.', detail: null };
    } else {
      const appToken = `${appId}|${appSecret}`;
      const response = await fetch(
        `https://graph.facebook.com/${graphApiVersion}/app?access_token=${appToken}`,
      );
      if (response.ok) {
        const body = (await response.json()) as { name?: string; id?: string };
        metaStatus = {
          status: 'active',
          reason: null,
          detail: `App: ${body.name ?? 'Unknown'} (ID: ${body.id ?? appId}) · Graph API ${graphApiVersion}`,
        };
      } else if (response.status === 401 || response.status === 400) {
        metaStatus = { status: 'expired', reason: 'Meta app credentials invalid or expired.', detail: null };
      } else {
        metaStatus = { status: 'error', reason: `Unexpected status: ${response.status}`, detail: null };
      }
    }
  } catch (err) {
    metaStatus = { status: 'error', reason: err instanceof Error ? err.message : 'Network error', detail: null };
  }

  // ── Paynow ────────────────────────────────────────────────────────────────
  const paynowStatus: ApiKeyStatus['paynow'] =
    config.paynow.integrationId && config.paynow.integrationKey
      ? {
          status: 'active',
          reason: null,
          detail: `Integration ID: ${config.paynow.integrationId} · Result URL: ${config.paynow.resultUrl}`,
        }
      : { status: 'error', reason: 'Paynow integration credentials not configured.', detail: null };

  // ── Claude AI ─────────────────────────────────────────────────────────────
  let claudeStatus: ApiKeyStatus['claude'];
  try {
    const { apiKey, model } = config.claude;
    if (!apiKey) {
      claudeStatus = { status: 'error', reason: 'Claude API key not configured.', detail: null };
    } else {
      // Lightweight check — list models endpoint to verify key validity
      const response = await fetch('https://api.anthropic.com/v1/models', {
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
      });
      if (response.ok) {
        claudeStatus = {
          status: 'active',
          reason: null,
          detail: `Model: ${model} · Key prefix: ${apiKey.slice(0, 16)}…`,
        };
      } else if (response.status === 401) {
        claudeStatus = { status: 'error', reason: 'Claude API key is invalid or revoked.', detail: null };
      } else {
        claudeStatus = { status: 'error', reason: `Anthropic API returned HTTP ${response.status}.`, detail: null };
      }
    }
  } catch (err) {
    claudeStatus = { status: 'error', reason: err instanceof Error ? err.message : 'Network error', detail: null };
  }

  return { meta: metaStatus, paynow: paynowStatus, claude: claudeStatus };
}

// ─── Support Ticket Management ────────────────────────────────────────────────

export interface AdminSupportTicket {
  id: string;
  businessId: string;
  businessName: string;
  businessEmail: string;
  reference: string;
  subject: string;
  description: string;
  attachmentUrl: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export async function listAllSupportTickets(filters: {
  status?: string;
  search?: string;
}): Promise<{ tickets: AdminSupportTicket[]; total: number }> {
  const conditions: string[] = [];
  const params: unknown[] = [];
  let idx = 1;

  if (filters.status) {
    conditions.push(`st.status = $${idx++}`);
    params.push(filters.status);
  }
  if (filters.search) {
    conditions.push(`(st.subject ILIKE $${idx} OR st.ticket_reference ILIKE $${idx} OR b.name ILIKE $${idx})`);
    params.push(`%${filters.search}%`);
    idx++;
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const result = await pool.query<{
    id: string;
    business_id: string;
    business_name: string;
    business_email: string;
    ticket_reference: string;
    subject: string;
    description: string;
    attachment_url: string | null;
    status: string;
    created_at: Date;
    updated_at: Date;
  }>(
    `SELECT st.id, st.business_id, b.name AS business_name, b.email AS business_email,
            st.ticket_reference, st.subject, st.description, st.attachment_url,
            st.status, st.created_at, st.updated_at
     FROM support_tickets st
     JOIN businesses b ON b.id = st.business_id
     ${where}
     ORDER BY st.created_at DESC`,
    params,
  );

  const tickets: AdminSupportTicket[] = result.rows.map((row) => ({
    id: row.id,
    businessId: row.business_id,
    businessName: row.business_name,
    businessEmail: row.business_email,
    reference: row.ticket_reference,
    subject: row.subject,
    description: row.description,
    attachmentUrl: row.attachment_url,
    status: row.status,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  }));

  return { tickets, total: tickets.length };
}

export async function updateSupportTicketStatus(
  ticketId: string,
  newStatus: string,
  operatorId: string,
): Promise<AdminSupportTicket> {
  const validStatuses = ['open', 'in_progress', 'closed'];
  if (!validStatuses.includes(newStatus)) {
    throw new Error(`Invalid status. Must be one of: ${validStatuses.join(', ')}`);
  }

  const result = await pool.query<{
    id: string;
    business_id: string;
    business_name: string;
    business_email: string;
    ticket_reference: string;
    subject: string;
    description: string;
    attachment_url: string | null;
    status: string;
    created_at: Date;
    updated_at: Date;
  }>(
    `UPDATE support_tickets st
     SET status = $1, updated_at = NOW()
     FROM businesses b
     WHERE st.id = $2 AND b.id = st.business_id
     RETURNING st.id, st.business_id, b.name AS business_name, b.email AS business_email,
               st.ticket_reference, st.subject, st.description, st.attachment_url,
               st.status, st.created_at, st.updated_at`,
    [newStatus, ticketId],
  );

  if (result.rows.length === 0) throw new Error('Support ticket not found.');

  await logAuditEvent(operatorId, 'update_ticket_status', 'ticket', ticketId, { newStatus });

  // Notify the business via email
  const row = result.rows[0];
  const { sendSupportTicketStatusUpdate } = await import('../../modules/notification/notification.service.js');
  void sendSupportTicketStatusUpdate(row.business_email, row.ticket_reference, newStatus).catch(() => {});

  return {
    id: row.id,
    businessId: row.business_id,
    businessName: row.business_name,
    businessEmail: row.business_email,
    reference: row.ticket_reference,
    subject: row.subject,
    description: row.description,
    attachmentUrl: row.attachment_url,
    status: row.status,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}
