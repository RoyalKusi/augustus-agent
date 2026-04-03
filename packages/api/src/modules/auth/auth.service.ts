import crypto from 'crypto';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { pool } from '../../db/client.js';
import redis from '../../redis/client.js';
import { setSession } from '../../redis/session.js';
import { config } from '../../config.js';
import {
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendLockoutEmail,
} from '../../services/notification.stub.js';

const BCRYPT_COST = 12;
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;
const EMAIL_VERIFY_TTL = 86400; // 24 hours in seconds
const PWD_RESET_TTL = 3600;     // 60 minutes in seconds

// ─── Task 2.2: Password Validation (Property 1) ───────────────────────────────

/**
 * Returns true only if the password meets all criteria:
 * - At least 8 characters
 * - At least one uppercase letter
 * - At least one lowercase letter
 * - At least one digit
 */
export function validatePassword(password: string): boolean {
  if (password.length < 8) return false;
  if (!/[A-Z]/.test(password)) return false;
  if (!/[a-z]/.test(password)) return false;
  if (!/[0-9]/.test(password)) return false;
  return true;
}

// ─── Task 2.1: Registration Endpoint ─────────────────────────────────────────

export async function registerBusiness(data: {
  businessName: string;
  ownerName: string;
  email: string;
  password: string;
}): Promise<{ id: string; email: string }> {
  const { businessName, ownerName, email, password } = data;

  if (!businessName || !ownerName || !email || !password) {
    throw new Error('All fields are required.');
  }

  if (!validatePassword(password)) {
    throw new Error(
      'Password must be at least 8 characters and contain an uppercase letter, a lowercase letter, and a digit.',
    );
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_COST);

  let id: string;
  try {
    const result = await pool.query<{ id: string }>(
      `INSERT INTO businesses (name, owner_name, email, password_hash, email_verified)
       VALUES ($1, $2, $3, $4, TRUE)
       RETURNING id`,
      [businessName, ownerName, email.toLowerCase().trim(), passwordHash],
    );
    id = result.rows[0].id;
  } catch (err: unknown) {
    // Task 2.3: Unique email enforcement (Property 2) — status-neutral error
    if (isUniqueViolation(err)) {
      throw new Error('An account with this email address already exists.');
    }
    throw err;
  }

  // Task 2.4: Send verification email — fire and forget
  sendVerificationEmail_internal(id, email).catch((err) => {
    console.error(`[Auth] Failed to send verification email to ${email}:`, err?.message ?? err);
  });

  return { id, email };
}

function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code: string }).code === '23505'
  );
}

// ─── Task 2.4: Email Verification Flow ───────────────────────────────────────

async function sendVerificationEmail_internal(businessId: string, email: string): Promise<void> {
  const token = crypto.randomBytes(32).toString('hex');
  await redis.set(`email_verify:${token}`, businessId, 'EX', EMAIL_VERIFY_TTL);
  await sendVerificationEmail(email, token);
}

export async function verifyEmail(token: string): Promise<string> {
  const businessId = await redis.get(`email_verify:${token}`);
  if (!businessId) {
    throw new Error('Invalid or expired verification token.');
  }

  await pool.query(
    `UPDATE businesses SET email_verified = TRUE, updated_at = NOW() WHERE id = $1`,
    [businessId],
  );

  await redis.del(`email_verify:${token}`);
  return businessId;
}

// ─── Task 2.5: Login Endpoint (Property 3) ───────────────────────────────────

export async function login(
  email: string,
  password: string,
): Promise<{ token: string; expiresAt: Date }> {
  const result = await pool.query<{
    id: string;
    password_hash: string;
    email_verified: boolean;
    failed_login_attempts: number;
    locked_until: Date | null;
    status: string;
  }>(
    `SELECT id, password_hash, email_verified, failed_login_attempts, locked_until, status
     FROM businesses WHERE email = $1`,
    [email.toLowerCase().trim()],
  );

  const business = result.rows[0];

  // Use a constant-time path to avoid user enumeration
  if (!business) {
    // Still run bcrypt to prevent timing attacks
    await bcrypt.compare(password, '$2b$12$invalidhashpadding000000000000000000000000000000000000');
    throw new Error('Invalid email or password.');
  }

  // Task 2.6: Check lockout
  if (business.locked_until && new Date(business.locked_until) > new Date()) {
    throw new Error('Account temporarily locked. Please try again later.');
  }

  const passwordMatch = await bcrypt.compare(password, business.password_hash);

  if (!passwordMatch) {
    await handleFailedLogin(business.id, business.failed_login_attempts, email);
    throw new Error('Invalid email or password.');
  }

  if (!business.email_verified) {
    throw new Error('Please verify your email address before logging in.');
  }

  if (business.status === 'suspended') {
    throw new Error('This account has been suspended. Please contact support.');
  }

  // Reset failed attempts on success
  await pool.query(
    `UPDATE businesses SET failed_login_attempts = 0, locked_until = NULL, updated_at = NOW() WHERE id = $1`,
    [business.id],
  );

  // Issue JWT
  const issuedAt = new Date();
  const expiresAt = new Date(issuedAt.getTime() + 24 * 60 * 60 * 1000);

  const token = jwt.sign(
    { businessId: business.id, email },
    config.jwt.secret,
    { expiresIn: '24h' },
  );

  // Store session in Redis
  await setSession(token, { businessId: business.id, email }, 86400);

  return { token, expiresAt };
}

// ─── Task 2.6: Account Lockout ────────────────────────────────────────────────

async function handleFailedLogin(
  businessId: string,
  currentAttempts: number,
  email: string,
): Promise<void> {
  const newAttempts = currentAttempts + 1;

  if (newAttempts >= MAX_FAILED_ATTEMPTS) {
    const lockedUntil = new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000);
    await pool.query(
      `UPDATE businesses
       SET failed_login_attempts = $1, locked_until = $2, updated_at = NOW()
       WHERE id = $3`,
      [newAttempts, lockedUntil, businessId],
    );
    await sendLockoutEmail(email, lockedUntil);
  } else {
    await pool.query(
      `UPDATE businesses SET failed_login_attempts = $1, updated_at = NOW() WHERE id = $2`,
      [newAttempts, businessId],
    );
  }
}

// ─── Task 2.7: Password Reset (Property 4) ───────────────────────────────────

export async function requestPasswordReset(email: string): Promise<void> {
  // Always return success — don't reveal if email exists
  const result = await pool.query<{ id: string }>(
    `SELECT id FROM businesses WHERE email = $1`,
    [email.toLowerCase().trim()],
  );

  if (result.rows.length === 0) {
    // Silently succeed to avoid email enumeration
    return;
  }

  const businessId = result.rows[0].id;
  const token = crypto.randomBytes(32).toString('hex');
  await redis.set(`pwd_reset:${token}`, businessId, 'EX', PWD_RESET_TTL);
  await sendPasswordResetEmail(email, token);
}

export async function resetPassword(token: string, newPassword: string): Promise<void> {
  const businessId = await redis.get(`pwd_reset:${token}`);
  if (!businessId) {
    throw new Error('Invalid or expired password reset token.');
  }

  if (!validatePassword(newPassword)) {
    throw new Error(
      'Password must be at least 8 characters and contain an uppercase letter, a lowercase letter, and a digit.',
    );
  }

  const passwordHash = await bcrypt.hash(newPassword, BCRYPT_COST);

  await pool.query(
    `UPDATE businesses SET password_hash = $1, updated_at = NOW() WHERE id = $2`,
    [passwordHash, businessId],
  );

  await redis.del(`pwd_reset:${token}`);
}
