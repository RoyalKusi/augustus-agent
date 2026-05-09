/**
 * Property-based tests for Withdrawal OTP pure helper functions
 * Feature: withdrawal-2fa-email-otp
 *
 * Uses fast-check for property generation with numRuns: 100 per property.
 * Tag format: Feature: withdrawal-2fa-email-otp, Property {N}: {property_text}
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  generateOtp,
  hashOtp,
  computeOtpExpiry,
  isOtpExpired,
  buildWithdrawalOtpEmail,
  isValidAmount,
  isValidOtpFormat,
  isRateLimited,
} from '../withdrawal-otp.service.js';

// ─── Arbitraries ──────────────────────────────────────────────────────────────

/** Any 6-digit string (000000–999999) */
const sixDigitStringArb = fc
  .integer({ min: 0, max: 999_999 })
  .map((n) => n.toString().padStart(6, '0'));

/** Two distinct 6-digit strings */
const twoDistinctSixDigitStringsArb = fc
  .tuple(sixDigitStringArb, sixDigitStringArb)
  .filter(([a, b]) => a !== b);

/** A date within a reasonable range */
const dateArb = fc.date({
  min: new Date('2020-01-01T00:00:00.000Z'),
  max: new Date('2035-12-31T23:59:59.999Z'),
});

/** A positive finite number (amount in USD) */
const positiveAmountArb = fc
  .integer({ min: 1, max: 10_000_000 })
  .map((n) => n / 100);

/** A non-empty merchant reference string */
const merchantRefArb = fc
  .string({ minLength: 1, maxLength: 50, unit: 'grapheme-ascii' })
  .filter((s) => s.trim().length > 0);

// ─── Property 1: OTP Generation Produces Valid 6-Digit Codes ─────────────────
// Feature: withdrawal-2fa-email-otp, Property 1: OTP Generation Produces Valid 6-Digit Codes
// **Validates: Requirements 1.1, 4.5**

describe('Feature: withdrawal-2fa-email-otp, Property 1: OTP Generation Produces Valid 6-Digit Codes', () => {
  it('generateOtp() always returns a string matching /^\\d{6}$/', () => {
    fc.assert(
      fc.property(fc.constant(null), () => {
        const otp = generateOtp();
        expect(otp).toMatch(/^\d{6}$/);
      }),
      { numRuns: 100 },
    );
  });

  it('generateOtp() numeric value is always in range 0–999999', () => {
    fc.assert(
      fc.property(fc.constant(null), () => {
        const otp = generateOtp();
        const numeric = parseInt(otp, 10);
        expect(numeric).toBeGreaterThanOrEqual(0);
        expect(numeric).toBeLessThanOrEqual(999_999);
      }),
      { numRuns: 100 },
    );
  });
});

// ─── Property 2: SHA-256 Hash Round-Trip ─────────────────────────────────────
// Feature: withdrawal-2fa-email-otp, Property 2: SHA-256 Hash Round-Trip
// **Validates: Requirements 1.2, 2.1, 4.1, 4.6**

describe('Feature: withdrawal-2fa-email-otp, Property 2: SHA-256 Hash Round-Trip', () => {
  it('hashOtp(otp) is deterministic — same input always produces same output', () => {
    fc.assert(
      fc.property(sixDigitStringArb, (otp) => {
        const hash1 = hashOtp(otp);
        const hash2 = hashOtp(otp);
        expect(hash1).toBe(hash2);
      }),
      { numRuns: 100 },
    );
  });

  it('hashOtp(otp) always produces a 64-character hex string', () => {
    fc.assert(
      fc.property(sixDigitStringArb, (otp) => {
        const hash = hashOtp(otp);
        expect(hash).toHaveLength(64);
        expect(hash).toMatch(/^[0-9a-f]{64}$/);
      }),
      { numRuns: 100 },
    );
  });

  it('hashOtp(otp1) !== hashOtp(otp2) for any two distinct 6-digit strings', () => {
    fc.assert(
      fc.property(twoDistinctSixDigitStringsArb, ([otp1, otp2]) => {
        expect(hashOtp(otp1)).not.toBe(hashOtp(otp2));
      }),
      { numRuns: 100 },
    );
  });

  it('hash is never equal to the plaintext OTP', () => {
    fc.assert(
      fc.property(sixDigitStringArb, (otp) => {
        expect(hashOtp(otp)).not.toBe(otp);
      }),
      { numRuns: 100 },
    );
  });
});

// ─── Property 3: OTP Expiry Calculation ──────────────────────────────────────
// Feature: withdrawal-2fa-email-otp, Property 3: OTP Expiry Calculation
// **Validates: Requirements 1.3**

describe('Feature: withdrawal-2fa-email-otp, Property 3: OTP Expiry Calculation', () => {
  it('computeOtpExpiry(t).getTime() - t.getTime() === 600_000 for any date t', () => {
    fc.assert(
      fc.property(dateArb, (t) => {
        const expiry = computeOtpExpiry(t);
        expect(expiry.getTime() - t.getTime()).toBe(600_000);
      }),
      { numRuns: 100 },
    );
  });
});

// ─── Property 4: OTP Expiry Check ────────────────────────────────────────────
// Feature: withdrawal-2fa-email-otp, Property 4: OTP Expiry Check
// **Validates: Requirements 2.5, 4.4**

describe('Feature: withdrawal-2fa-email-otp, Property 4: OTP Expiry Check', () => {
  it('isOtpExpired returns true for any expiresAt strictly before now', () => {
    fc.assert(
      fc.property(
        dateArb,
        fc.integer({ min: 1, max: 86_400_000 }),
        (base, offsetMs) => {
          const expiresAt = new Date(base.getTime());
          const now = new Date(base.getTime() + offsetMs);
          expect(isOtpExpired(expiresAt, now)).toBe(true);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('isOtpExpired returns false for any expiresAt equal to now', () => {
    fc.assert(
      fc.property(dateArb, (t) => {
        const expiresAt = new Date(t.getTime());
        const now = new Date(t.getTime());
        expect(isOtpExpired(expiresAt, now)).toBe(false);
      }),
      { numRuns: 100 },
    );
  });

  it('isOtpExpired returns false for any expiresAt strictly after now', () => {
    fc.assert(
      fc.property(
        dateArb,
        fc.integer({ min: 1, max: 86_400_000 }),
        (base, offsetMs) => {
          const expiresAt = new Date(base.getTime() + offsetMs);
          const now = new Date(base.getTime());
          expect(isOtpExpired(expiresAt, now)).toBe(false);
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ─── Property 5: Withdrawal OTP Email Content Completeness ───────────────────
// Feature: withdrawal-2fa-email-otp, Property 5: Withdrawal OTP Email Content Completeness
// **Validates: Requirements 3.1–3.5**

describe('Feature: withdrawal-2fa-email-otp, Property 5: Withdrawal OTP Email Content Completeness', () => {
  it('subject is exactly "Augustus — Withdrawal Verification Code"', () => {
    fc.assert(
      fc.property(sixDigitStringArb, positiveAmountArb, merchantRefArb, (otp, amount, ref) => {
        const { subject } = buildWithdrawalOtpEmail(otp, amount, ref);
        expect(subject).toBe('Augustus — Withdrawal Verification Code');
      }),
      { numRuns: 100 },
    );
  });

  it('html body contains the OTP string', () => {
    fc.assert(
      fc.property(sixDigitStringArb, positiveAmountArb, merchantRefArb, (otp, amount, ref) => {
        const { html } = buildWithdrawalOtpEmail(otp, amount, ref);
        expect(html).toContain(otp);
      }),
      { numRuns: 100 },
    );
  });

  it('text body contains the OTP string', () => {
    fc.assert(
      fc.property(sixDigitStringArb, positiveAmountArb, merchantRefArb, (otp, amount, ref) => {
        const { text } = buildWithdrawalOtpEmail(otp, amount, ref);
        expect(text).toContain(otp);
      }),
      { numRuns: 100 },
    );
  });

  it('html body contains "10 minutes"', () => {
    fc.assert(
      fc.property(sixDigitStringArb, positiveAmountArb, merchantRefArb, (otp, amount, ref) => {
        const { html } = buildWithdrawalOtpEmail(otp, amount, ref);
        expect(html).toContain('10 minutes');
      }),
      { numRuns: 100 },
    );
  });

  it('text body contains "10 minutes"', () => {
    fc.assert(
      fc.property(sixDigitStringArb, positiveAmountArb, merchantRefArb, (otp, amount, ref) => {
        const { text } = buildWithdrawalOtpEmail(otp, amount, ref);
        expect(text).toContain('10 minutes');
      }),
      { numRuns: 100 },
    );
  });

  it('html body contains the formatted amount', () => {
    fc.assert(
      fc.property(sixDigitStringArb, positiveAmountArb, merchantRefArb, (otp, amount, ref) => {
        const { html } = buildWithdrawalOtpEmail(otp, amount, ref);
        expect(html).toContain(amount.toFixed(2));
      }),
      { numRuns: 100 },
    );
  });

  it('text body contains the formatted amount', () => {
    fc.assert(
      fc.property(sixDigitStringArb, positiveAmountArb, merchantRefArb, (otp, amount, ref) => {
        const { text } = buildWithdrawalOtpEmail(otp, amount, ref);
        expect(text).toContain(amount.toFixed(2));
      }),
      { numRuns: 100 },
    );
  });

  it('html body contains the merchant reference', () => {
    fc.assert(
      fc.property(sixDigitStringArb, positiveAmountArb, merchantRefArb, (otp, amount, ref) => {
        const { html } = buildWithdrawalOtpEmail(otp, amount, ref);
        expect(html).toContain(ref);
      }),
      { numRuns: 100 },
    );
  });

  it('text body contains the merchant reference', () => {
    fc.assert(
      fc.property(sixDigitStringArb, positiveAmountArb, merchantRefArb, (otp, amount, ref) => {
        const { text } = buildWithdrawalOtpEmail(otp, amount, ref);
        expect(text).toContain(ref);
      }),
      { numRuns: 100 },
    );
  });

  it('html body contains a security notice phrase ("did not initiate" or "contact support")', () => {
    fc.assert(
      fc.property(sixDigitStringArb, positiveAmountArb, merchantRefArb, (otp, amount, ref) => {
        const { html } = buildWithdrawalOtpEmail(otp, amount, ref);
        const hasSecurityNotice =
          html.includes('did not initiate') || html.includes('contact support');
        expect(hasSecurityNotice).toBe(true);
      }),
      { numRuns: 100 },
    );
  });

  it('text body contains a security notice phrase ("did not initiate" or "contact support")', () => {
    fc.assert(
      fc.property(sixDigitStringArb, positiveAmountArb, merchantRefArb, (otp, amount, ref) => {
        const { text } = buildWithdrawalOtpEmail(otp, amount, ref);
        const hasSecurityNotice =
          text.includes('did not initiate') || text.includes('contact support');
        expect(hasSecurityNotice).toBe(true);
      }),
      { numRuns: 100 },
    );
  });
});

// ─── Property 6: Amount Validation ───────────────────────────────────────────
// Feature: withdrawal-2fa-email-otp, Property 6: Amount Validation
// **Validates: Requirements 1.6**

describe('Feature: withdrawal-2fa-email-otp, Property 6: Amount Validation', () => {
  it('isValidAmount returns false for non-positive numbers (zero and negative)', () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.constant(0),
          fc.integer({ min: -1_000_000, max: -1 }).map((n) => n / 100),
        ),
        (amount) => {
          expect(isValidAmount(amount)).toBe(false);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('isValidAmount returns false for NaN', () => {
    expect(isValidAmount(NaN)).toBe(false);
  });

  it('isValidAmount returns false for Infinity', () => {
    expect(isValidAmount(Infinity)).toBe(false);
    expect(isValidAmount(-Infinity)).toBe(false);
  });

  it('isValidAmount returns false for non-numeric values', () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.string(),
          fc.constant(null),
          fc.constant(undefined),
          fc.boolean(),
          fc.constant({}),
          fc.constant([]),
        ),
        (value) => {
          expect(isValidAmount(value)).toBe(false);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('isValidAmount returns true for any finite positive number', () => {
    fc.assert(
      fc.property(positiveAmountArb, (amount) => {
        expect(isValidAmount(amount)).toBe(true);
      }),
      { numRuns: 100 },
    );
  });
});

// ─── Property 7: OTP Format Validation ───────────────────────────────────────
// Feature: withdrawal-2fa-email-otp, Property 7: OTP Format Validation
// **Validates: Requirements 2.7**

describe('Feature: withdrawal-2fa-email-otp, Property 7: OTP Format Validation', () => {
  it('isValidOtpFormat returns false for strings not matching /^\\d{6}$/', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 0, maxLength: 20 }).filter((s) => !/^\d{6}$/.test(s)),
        (s) => {
          expect(isValidOtpFormat(s)).toBe(false);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('isValidOtpFormat returns true for any string matching /^\\d{6}$/', () => {
    fc.assert(
      fc.property(sixDigitStringArb, (otp) => {
        expect(isValidOtpFormat(otp)).toBe(true);
      }),
      { numRuns: 100 },
    );
  });
});

// ─── Property 8: Rate Limit Window Check ─────────────────────────────────────
// Feature: withdrawal-2fa-email-otp, Property 8: Rate Limit Window Check
// **Validates: Requirements 5.1–5.3**

describe('Feature: withdrawal-2fa-email-otp, Property 8: Rate Limit Window Check', () => {
  it('isRateLimited returns true for n > 3 within an active 15-minute window', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 4, max: 1000 }),
        dateArb,
        fc.integer({ min: 0, max: 899_999 }),
        (n, windowStart, elapsedMs) => {
          // now is within the 15-minute window (< 900_000 ms after windowStart)
          const now = new Date(windowStart.getTime() + elapsedMs);
          expect(isRateLimited(n, windowStart, now)).toBe(true);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('isRateLimited returns false for n <= 3 within an active 15-minute window', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 3 }),
        dateArb,
        fc.integer({ min: 0, max: 899_999 }),
        (n, windowStart, elapsedMs) => {
          const now = new Date(windowStart.getTime() + elapsedMs);
          expect(isRateLimited(n, windowStart, now)).toBe(false);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('isRateLimited returns false for any n when windowStart is more than 15 minutes before now', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 1000 }),
        dateArb,
        fc.integer({ min: 900_001, max: 86_400_000 }),
        (n, windowStart, elapsedMs) => {
          // now is past the 15-minute window
          const now = new Date(windowStart.getTime() + elapsedMs);
          expect(isRateLimited(n, windowStart, now)).toBe(false);
        },
      ),
      { numRuns: 100 },
    );
  });
});
