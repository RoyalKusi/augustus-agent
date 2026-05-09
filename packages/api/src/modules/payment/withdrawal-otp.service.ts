/**
 * Withdrawal OTP Service
 * Requirements: 1.1–1.8, 2.1–2.8, 3.1–3.5, 4.1–4.6, 5.1–5.3
 *
 * This module contains:
 *   - Pure helper functions (no DB calls) — exported for testing
 *   - WithdrawalOtpError — custom error class with HTTP statusCode
 *   - DB-coupled service methods (requestOtp, confirmOtp) — added in tasks 5 & 6
 */

import { createHash, randomInt } from 'node:crypto';

// ─── Error Class ──────────────────────────────────────────────────────────────

/**
 * Custom error class for withdrawal OTP operations.
 * Carries an HTTP statusCode so route handlers can map errors to responses.
 */
export class WithdrawalOtpError extends Error {
  statusCode: number;
  availableBalance?: number;
  retryAfter?: string;

  constructor(
    message: string,
    statusCode: number,
    extras?: { availableBalance?: number; retryAfter?: string },
  ) {
    super(message);
    this.name = 'WithdrawalOtpError';
    this.statusCode = statusCode;
    if (extras?.availableBalance !== undefined) {
      this.availableBalance = extras.availableBalance;
    }
    if (extras?.retryAfter !== undefined) {
      this.retryAfter = extras.retryAfter;
    }
  }
}

// ─── Pure Helper Functions ────────────────────────────────────────────────────

/**
 * Generate a cryptographically random 6-digit OTP string.
 * Uses crypto.randomInt for uniform distribution across 000000–999999.
 * Requirements: 1.1, 4.5
 */
export function generateOtp(): string {
  const value = randomInt(0, 1_000_000);
  return value.toString().padStart(6, '0');
}

/**
 * Compute the SHA-256 hex digest of an OTP string.
 * The plaintext OTP is never stored — only this hash is persisted.
 * Requirements: 1.2, 2.1, 4.1, 4.6
 */
export function hashOtp(otp: string): string {
  return createHash('sha256').update(otp, 'utf8').digest('hex');
}

/**
 * Compute the OTP expiry timestamp.
 * Returns `from + 600_000 ms` (10 minutes). Defaults to `new Date()` if not provided.
 * Requirements: 1.3
 */
export function computeOtpExpiry(from?: Date): Date {
  const base = from ?? new Date();
  return new Date(base.getTime() + 600_000);
}

/**
 * Check whether an OTP has expired.
 * Returns `true` iff `expiresAt` is strictly before `now`.
 * Defaults `now` to `new Date()` if not provided.
 * Requirements: 2.5, 4.4
 */
export function isOtpExpired(expiresAt: Date, now?: Date): boolean {
  const reference = now ?? new Date();
  return expiresAt < reference;
}

/**
 * Validate that a string is exactly 6 decimal digits.
 * Requirements: 2.7
 */
export function isValidOtpFormat(otp: string): boolean {
  return /^\d{6}$/.test(otp);
}

/**
 * Validate that a value is a finite positive number (> 0).
 * Requirements: 1.6
 */
export function isValidAmount(amount: unknown): boolean {
  return typeof amount === 'number' && isFinite(amount) && amount > 0;
}

/**
 * Validate that a value is a non-empty string after trimming.
 * Requirements: 1.7
 */
export function isValidMerchantRef(ref: unknown): boolean {
  return typeof ref === 'string' && ref.trim().length > 0;
}

/**
 * Check whether a business is rate-limited.
 *
 * Returns `true` if ALL of the following hold:
 *   - `count > 3` (more than 3 requests/attempts in the window)
 *   - The 15-minute window starting at `windowStart` has NOT yet expired
 *
 * Returns `false` if the window has expired (regardless of count), or if count ≤ 3.
 *
 * The window duration is 15 minutes (900_000 ms).
 * Requirements: 5.1, 5.2, 5.3
 */
export function isRateLimited(count: number, windowStart: Date, now?: Date): boolean {
  const reference = now ?? new Date();
  const windowExpiry = new Date(windowStart.getTime() + 900_000);
  const windowActive = reference < windowExpiry;
  return count > 3 && windowActive;
}

/**
 * Build the withdrawal OTP email content.
 *
 * Subject is exactly: "Augustus — Withdrawal Verification Code"
 * Body includes:
 *   - The 6-digit OTP code
 *   - "10 minutes" (expiry notice)
 *   - The withdrawal amount in USD
 *   - The Paynow merchant reference
 *   - A security notice with "did not initiate" and "contact support" phrases
 *
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5
 */
export function buildWithdrawalOtpEmail(
  otp: string,
  amountUsd: number,
  paynowMerchantRef: string,
): { subject: string; html: string; text: string } {
  const subject = 'Augustus — Withdrawal Verification Code';

  const formattedAmount = `USD ${amountUsd.toFixed(2)}`;

  const text = [
    'Augustus — Withdrawal Verification Code',
    '',
    'You have requested a withdrawal from your Augustus account.',
    '',
    `Verification Code: ${otp}`,
    '',
    'This code expires in 10 minutes.',
    '',
    'Withdrawal Details:',
    `  Amount: ${formattedAmount}`,
    `  Paynow Merchant Reference: ${paynowMerchantRef}`,
    '',
    'If you did not initiate this withdrawal, please contact support immediately.',
    'Do not share this code with anyone.',
    '',
    '— The Augustus Team',
  ].join('\n');

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${subject}</title>
</head>
<body style="font-family: Arial, sans-serif; background-color: #f4f4f4; margin: 0; padding: 20px;">
  <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; padding: 32px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
    <h1 style="color: #1a1a1a; font-size: 22px; margin-bottom: 8px;">Withdrawal Verification Code</h1>
    <p style="color: #555; font-size: 15px;">You have requested a withdrawal from your Augustus account.</p>

    <div style="background-color: #f0f4ff; border-radius: 6px; padding: 20px; text-align: center; margin: 24px 0;">
      <p style="color: #555; font-size: 13px; margin: 0 0 8px;">Your verification code is:</p>
      <p style="font-size: 36px; font-weight: bold; letter-spacing: 8px; color: #1a1a1a; margin: 0;">${otp}</p>
      <p style="color: #888; font-size: 13px; margin: 8px 0 0;">This code expires in <strong>10 minutes</strong>.</p>
    </div>

    <h2 style="color: #1a1a1a; font-size: 16px; margin-bottom: 8px;">Withdrawal Details</h2>
    <table style="width: 100%; border-collapse: collapse; font-size: 14px; color: #333;">
      <tr>
        <td style="padding: 6px 0; color: #888;">Amount</td>
        <td style="padding: 6px 0; font-weight: bold;">${formattedAmount}</td>
      </tr>
      <tr>
        <td style="padding: 6px 0; color: #888;">Paynow Merchant Reference</td>
        <td style="padding: 6px 0; font-weight: bold;">${paynowMerchantRef}</td>
      </tr>
    </table>

    <div style="background-color: #fff8e1; border-left: 4px solid #f59e0b; padding: 12px 16px; margin-top: 24px; border-radius: 4px;">
      <p style="color: #92400e; font-size: 13px; margin: 0;">
        <strong>Security Notice:</strong> If you did not initiate this withdrawal, please
        <strong>contact support</strong> immediately. Do not share this code with anyone.
      </p>
    </div>

    <p style="color: #aaa; font-size: 12px; margin-top: 32px; text-align: center;">
      — The Augustus Team
    </p>
  </div>
</body>
</html>`;

  return { subject, html, text };
}

// ─── DB-Coupled Service Methods ───────────────────────────────────────────────

import { pool } from '../../db/client.js';
import { sendEmail } from '../notification/notification.service.js';
import { createWithdrawalRequest } from './payment.service.js';

/**
 * Request a withdrawal OTP for a business.
 *
 * Steps:
 *  1. Validate inputs
 *  2. Fetch business record (email, balance, rate-limit counters)
 *  3. Check rate limit
 *  4. Check balance
 *  5. Generate OTP, hash it, compute expiry
 *  6. Compute new rate-limit counters (lazy window reset)
 *  7. Persist OTP hash + expiry + counters to DB
 *  8. Send OTP email
 *
 * Requirements: 1.1–1.8, 5.1–5.3
 */
export async function requestOtp(
  businessId: string,
  amountUsd: number,
  paynowMerchantRef: string,
): Promise<void> {
  // Step 1: Validate inputs
  if (!isValidAmount(amountUsd)) {
    throw new WithdrawalOtpError('amount_usd must be a positive number.', 400);
  }
  if (!isValidMerchantRef(paynowMerchantRef)) {
    throw new WithdrawalOtpError('paynow_merchant_ref is required.', 400);
  }

  // Step 2: Fetch business record
  const result = await pool.query<{
    email: string;
    available_usd: string;
    withdrawal_otp_request_count: number;
    withdrawal_otp_window_start: Date | null;
  }>(
    `SELECT b.email,
            COALESCE(rb.available_balance, 0) AS available_usd,
            b.withdrawal_otp_request_count,
            b.withdrawal_otp_window_start
     FROM businesses b
     LEFT JOIN revenue_balances rb ON rb.business_id = b.id
     WHERE b.id = $1`,
    [businessId],
  );

  if (result.rows.length === 0) {
    throw new WithdrawalOtpError('Business not found.', 404);
  }

  const row = result.rows[0];
  const available_usd = Number(row.available_usd);
  const windowStart = row.withdrawal_otp_window_start;

  // Step 3: Check rate limit
  if (windowStart !== null && isRateLimited(row.withdrawal_otp_request_count, windowStart, new Date())) {
    const retryAfter = new Date(windowStart.getTime() + 900_000).toISOString();
    throw new WithdrawalOtpError(
      'Too many OTP requests. Try again after ' + retryAfter + '.',
      429,
      { retryAfter },
    );
  }

  // Step 4: Check balance
  if (available_usd < amountUsd) {
    throw new WithdrawalOtpError('Insufficient balance.', 422, { availableBalance: available_usd });
  }

  // Step 5: Generate OTP, hash, expiry
  const otp = generateOtp();
  const hash = hashOtp(otp);
  const expiresAt = computeOtpExpiry();

  // Step 6: Compute new rate-limit counters (lazy window reset)
  const now = new Date();
  let newCount: number;
  let newWindowStart: Date;

  if (windowStart === null || now.getTime() - windowStart.getTime() > 900_000) {
    // Window expired or never started — reset
    newCount = 1;
    newWindowStart = now;
  } else {
    // Window still active — increment
    newCount = row.withdrawal_otp_request_count + 1;
    newWindowStart = windowStart;
  }

  // Step 7: Persist to DB
  await pool.query(
    `UPDATE businesses
     SET withdrawal_otp_hash = $1,
         withdrawal_otp_expires_at = $2,
         withdrawal_otp_request_count = $3,
         withdrawal_otp_window_start = $4,
         updated_at = NOW()
     WHERE id = $5`,
    [hash, expiresAt, newCount, newWindowStart, businessId],
  );

  // Step 8: Send email
  const { subject, html, text } = buildWithdrawalOtpEmail(otp, amountUsd, paynowMerchantRef);
  try {
    await sendEmail(row.email, subject, html, text);
  } catch {
    throw new WithdrawalOtpError('Failed to send verification email. Please try again.', 500);
  }
}

/**
 * Confirm a withdrawal OTP and create the withdrawal request.
 *
 * Steps:
 *  1. Validate inputs
 *  2. Fetch business record (OTP hash, expiry, fail count, window start, balance)
 *  3. Check fail-attempt rate limit
 *  4. Check that a pending OTP exists
 *  5. Check OTP expiry
 *  6. Verify OTP hash — increment fail count on mismatch
 *  7. Check balance (does NOT invalidate OTP on failure)
 *  8. In a single DB transaction: clear OTP + create withdrawal request
 *
 * Requirements: 2.1–2.8, 4.3, 5.2–5.3
 */
export async function confirmOtp(
  businessId: string,
  otp: string,
  amountUsd: number,
  paynowMerchantRef: string,
): Promise<{ withdrawal: unknown; autoProcessed: boolean }> {
  // Step 1: Validate inputs
  if (!isValidOtpFormat(otp)) {
    throw new WithdrawalOtpError('otp must be a 6-digit numeric code.', 400);
  }
  if (!isValidAmount(amountUsd)) {
    throw new WithdrawalOtpError('amount_usd must be a positive number.', 400);
  }
  if (!isValidMerchantRef(paynowMerchantRef)) {
    throw new WithdrawalOtpError('paynow_merchant_ref is required.', 400);
  }

  // Step 2: Fetch business record
  const result = await pool.query<{
    withdrawal_otp_hash: string | null;
    withdrawal_otp_expires_at: Date | null;
    withdrawal_otp_fail_count: number;
    withdrawal_otp_window_start: Date | null;
    available_usd: string;
  }>(
    `SELECT b.withdrawal_otp_hash,
            b.withdrawal_otp_expires_at,
            b.withdrawal_otp_fail_count,
            b.withdrawal_otp_window_start,
            COALESCE(rb.available_balance, 0) AS available_usd
     FROM businesses b
     LEFT JOIN revenue_balances rb ON rb.business_id = b.id
     WHERE b.id = $1`,
    [businessId],
  );

  if (result.rows.length === 0) {
    throw new WithdrawalOtpError('Business not found.', 404);
  }

  const row = result.rows[0];
  const available_usd = Number(row.available_usd);

  // Step 3: Check fail-attempt rate limit
  // If withdrawal_otp_window_start is null, treat as not rate limited
  if (row.withdrawal_otp_window_start !== null) {
    if (isRateLimited(row.withdrawal_otp_fail_count, row.withdrawal_otp_window_start, new Date())) {
      const retryAfter = new Date(row.withdrawal_otp_window_start.getTime() + 900_000).toISOString();
      throw new WithdrawalOtpError(
        'Too many failed attempts. Try again after ' + retryAfter + '.',
        429,
        { retryAfter },
      );
    }
  }

  // Step 4: Check that a pending OTP exists
  if (row.withdrawal_otp_hash === null) {
    throw new WithdrawalOtpError('No pending verification. Please request a new code.', 401);
  }

  // Step 5: Check OTP expiry
  if (row.withdrawal_otp_expires_at === null || isOtpExpired(row.withdrawal_otp_expires_at)) {
    throw new WithdrawalOtpError('Verification code has expired. Please request a new one.', 401);
  }

  // Step 6: Verify OTP hash — increment fail count on mismatch
  if (hashOtp(otp) !== row.withdrawal_otp_hash) {
    await pool.query(
      `UPDATE businesses
       SET withdrawal_otp_fail_count = withdrawal_otp_fail_count + 1,
           updated_at = NOW()
       WHERE id = $1`,
      [businessId],
    );
    throw new WithdrawalOtpError('Invalid verification code.', 401);
  }

  // Step 7: Check balance — do NOT invalidate OTP, do NOT increment fail count
  if (available_usd < amountUsd) {
    throw new WithdrawalOtpError('Insufficient balance.', 422, { availableBalance: available_usd });
  }

  // Step 8: Execute in a single DB transaction
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 8a: Clear OTP
    await client.query(
      `UPDATE businesses
       SET withdrawal_otp_hash = NULL,
           withdrawal_otp_expires_at = NULL,
           updated_at = NOW()
       WHERE id = $1`,
      [businessId],
    );

    // 8b: Create withdrawal request
    let withdrawalResult: { withdrawal: unknown; autoProcessed: boolean };
    try {
      withdrawalResult = await createWithdrawalRequest(businessId, amountUsd, paynowMerchantRef);
    } catch (err) {
      // 8c: ROLLBACK and re-throw on any error
      await client.query('ROLLBACK');
      throw err;
    }

    // 8d: COMMIT on success
    await client.query('COMMIT');

    // Step 12: Return { withdrawal, autoProcessed }
    return withdrawalResult;
  } catch (err) {
    // Ensure rollback on unexpected errors (e.g. the BEGIN/COMMIT queries themselves)
    try { await client.query('ROLLBACK'); } catch { /* ignore rollback errors */ }
    throw err;
  } finally {
    client.release();
  }
}
