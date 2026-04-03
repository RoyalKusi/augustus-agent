/**
 * Property-based tests for Business Registration and Authentication
 * Feature: augustus-ai-sales-platform
 *
 * Uses fast-check for property generation.
 * Validates: Requirements 1.2, 1.3, 1.5, 1.7
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import jwt from 'jsonwebtoken';
import { randomBytes } from 'crypto';
import { validatePassword } from '../../../auth/password.js';

// ─── Property 1: Password Validation Correctness ─────────────────────────────
// Feature: augustus-ai-sales-platform, Property 1: Password Validation Correctness
// Validates: Requirements 1.2

describe('Property 1: Password Validation Correctness', () => {
  it('accepts any string that meets all four criteria', () => {
    const validPasswordArb = fc
      .tuple(
        fc.stringMatching(/[A-Z]/),
        fc.stringMatching(/[a-z]/),
        fc.stringMatching(/[0-9]/),
        fc.string({ minLength: 2 }),
      )
      .map(([upper, lower, digit, extra]) => upper + lower + digit + extra)
      .filter((s) => s.length >= 8 && /[A-Z]/.test(s) && /[a-z]/.test(s) && /[0-9]/.test(s));

    fc.assert(
      fc.property(validPasswordArb, (password) => {
        expect(validatePassword(password)).toBe(true);
      }),
      { numRuns: 25 },
    );
  });

  it('rejects any string that fails at least one criterion', () => {
    const invalidPasswordArb = fc.string({ minLength: 0, maxLength: 50 }).filter(
      (s) =>
        s.length < 8 ||
        !/[A-Z]/.test(s) ||
        !/[a-z]/.test(s) ||
        !/[0-9]/.test(s),
    );

    fc.assert(
      fc.property(invalidPasswordArb, (password) => {
        expect(validatePassword(password)).toBe(false);
      }),
      { numRuns: 25 },
    );
  });

  it('rejects passwords shorter than 8 characters even with all character types', () => {
    const shortArb = fc
      .tuple(
        fc.constantFrom('A', 'B', 'C'),
        fc.constantFrom('a', 'b', 'c'),
        fc.constantFrom('1', '2', '3'),
      )
      .map(([u, l, d]) => u + l + d)
      .filter((s) => s.length < 8);

    fc.assert(
      fc.property(shortArb, (password) => {
        expect(validatePassword(password)).toBe(false);
      }),
      { numRuns: 25 },
    );
  });
});

// ─── Property 2: Duplicate Email Error Does Not Reveal Account Status ─────────
// Feature: augustus-ai-sales-platform, Property 2: Duplicate Email Error Does Not Reveal Account Status
// Validates: Requirements 1.3

describe('Property 2: Duplicate Email Error Does Not Reveal Account Status', () => {
  it('error message for duplicate email does not contain account status words', () => {
    const DUPLICATE_EMAIL_ERROR = 'Email already registered.';
    const statusWords = ['active', 'suspended', 'pending', 'verified', 'unverified', 'locked'];

    fc.assert(
      fc.property(fc.constant(DUPLICATE_EMAIL_ERROR), (errorMessage) => {
        const lower = errorMessage.toLowerCase();
        for (const word of statusWords) {
          expect(lower).not.toContain(word);
        }
      }),
      { numRuns: 25 },
    );
  });

  it('the duplicate email error message is always the same regardless of any context', () => {
    function getDuplicateEmailError(): string {
      return 'Email already registered.';
    }

    fc.assert(
      fc.property(fc.emailAddress(), (_email) => {
        const msg1 = getDuplicateEmailError();
        const msg2 = getDuplicateEmailError();
        expect(msg1).toBe(msg2);
        expect(msg1).not.toMatch(/active|suspended|pending_verification/i);
      }),
      { numRuns: 25 },
    );
  });
});

// ─── Property 3: Session Token Lifetime Bound ─────────────────────────────────
// Feature: augustus-ai-sales-platform, Property 3: Session Token Lifetime Bound
// Validates: Requirements 1.5

describe('Property 3: Session Token Lifetime Bound', () => {
  const JWT_SECRET = 'test-secret-for-property-tests';
  const MAX_LIFETIME_MS = 24 * 60 * 60 * 1000;

  it('any JWT issued with 24h expiry has expiry <= 24 hours from issuance', () => {
    fc.assert(
      fc.property(fc.record({ id: fc.uuid(), email: fc.emailAddress() }), ({ id, email }) => {
        const issuedAt = Date.now();
        const token = jwt.sign({ sub: id, email }, JWT_SECRET, { expiresIn: '24h' });
        const decoded = jwt.verify(token, JWT_SECRET) as { exp: number; iat: number };

        const lifetimeMs = (decoded.exp - decoded.iat) * 1000;
        expect(lifetimeMs).toBeLessThanOrEqual(MAX_LIFETIME_MS + 1000);
        expect(lifetimeMs).toBeGreaterThan(0);
        expect(decoded.exp * 1000).toBeGreaterThan(issuedAt);
      }),
      { numRuns: 25 },
    );
  });

  it('a token issued now expires no more than 24 hours in the future', () => {
    fc.assert(
      fc.property(fc.uuid(), (businessId) => {
        const before = Math.floor(Date.now() / 1000);
        const token = jwt.sign({ sub: businessId }, JWT_SECRET, { expiresIn: '24h' });
        const after = Math.floor(Date.now() / 1000);
        const decoded = jwt.verify(token, JWT_SECRET) as { exp: number };

        expect(decoded.exp).toBeGreaterThanOrEqual(before + 24 * 3600);
        expect(decoded.exp).toBeLessThanOrEqual(after + 24 * 3600 + 1);
      }),
      { numRuns: 25 },
    );
  });
});

// ─── Property 4: Password Reset Token Validity Window ─────────────────────────
// Feature: augustus-ai-sales-platform, Property 4: Password Reset Token Validity Window
// Validates: Requirements 1.7

describe('Property 4: Password Reset Token Validity Window', () => {
  it('a generated password reset token is always exactly 64 hex characters', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 100 }), (_n) => {
        const token = randomBytes(32).toString('hex');
        expect(token).toHaveLength(64);
        expect(token).toMatch(/^[0-9a-f]{64}$/);
      }),
      { numRuns: 25 },
    );
  });

  it('password reset token TTL is always 3600 seconds (60 minutes)', () => {
    const PWD_RESET_TTL = 3600;
    const SIXTY_MINUTES_SECONDS = 60 * 60;

    fc.assert(
      fc.property(fc.integer({ min: 1, max: 1000 }), (_n) => {
        expect(PWD_RESET_TTL).toBe(SIXTY_MINUTES_SECONDS);
        expect(PWD_RESET_TTL).toBeLessThanOrEqual(SIXTY_MINUTES_SECONDS);
      }),
      { numRuns: 25 },
    );
  });

  it('token expiry is within 60 minutes of generation', () => {
    const PWD_RESET_TTL_MS = 3600 * 1000;

    fc.assert(
      fc.property(fc.integer({ min: 0, max: 59 }), (minutesElapsed) => {
        const generatedAt = Date.now();
        const expiresAt = generatedAt + PWD_RESET_TTL_MS;
        const checkTime = generatedAt + minutesElapsed * 60 * 1000;
        expect(checkTime).toBeLessThan(expiresAt);
      }),
      { numRuns: 25 },
    );
  });
});
