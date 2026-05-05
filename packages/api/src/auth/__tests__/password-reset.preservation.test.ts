/**
 * Preservation property tests for the password reset flow.
 *
 * These tests verify behaviors that are UNAFFECTED by the two bugs and must
 * continue to work correctly after the fix is applied.
 *
 * All tests PASS on unfixed code — they establish the baseline behavior to preserve.
 *
 * Property 3: Preservation — Anti-Enumeration and Token Lifecycle
 *
 * Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fc from 'fast-check';
import Fastify from 'fastify';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build a minimal Fastify app with authRoutes registered and all external
 * dependencies mocked so no real DB / Redis / SendGrid calls are made.
 * Mirrors the pattern from password-reset.bug.test.ts.
 */
async function buildTestApp() {
  vi.mock('../service.js', () => ({
    authService: {
      register: vi.fn(),
      verifyEmail: vi.fn(),
      login: vi.fn(),
      requestPasswordReset: vi.fn(),
      resetPassword: vi.fn(),
    },
  }));

  const { authRoutes } = await import('../routes.js');
  const { authService } = await import('../service.js');

  const app = Fastify({ logger: false });
  await authRoutes(app);
  await app.ready();

  return { app, authService };
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('Preservation — password reset baseline behavior', () => {
  let app: Awaited<ReturnType<typeof buildTestApp>>['app'];
  let authService: Awaited<ReturnType<typeof buildTestApp>>['authService'];

  beforeEach(async () => {
    vi.resetModules();
    const result = await buildTestApp();
    app = result.app;
    authService = result.authService;
  });

  afterEach(async () => {
    await app.close();
    vi.restoreAllMocks();
  });

  // -------------------------------------------------------------------------
  // Test 1 — Anti-enumeration for unregistered email
  // -------------------------------------------------------------------------
  it(
    'Test 1 — returns 200 with generic message for unregistered email (service resolves silently)',
    async () => {
      // Arrange: service resolves without throwing — simulates unregistered email
      // (the real service returns early without sending when email is not found)
      vi.mocked(authService.requestPasswordReset).mockResolvedValue(undefined);

      // Act
      const response = await app.inject({
        method: 'POST',
        url: '/auth/request-password-reset',
        payload: { email: 'notregistered@example.com' },
      });

      // Assert: anti-enumeration response
      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({
        message: 'If that email is registered, a reset link has been sent.',
      });
    },
  );

  // -------------------------------------------------------------------------
  // Test 2 — Anti-enumeration for registered email (success path)
  // -------------------------------------------------------------------------
  it(
    'Test 2 — returns 200 with generic message for registered email (service resolves after sending)',
    async () => {
      // Arrange: service resolves — simulates registered email where email was sent
      vi.mocked(authService.requestPasswordReset).mockResolvedValue(undefined);

      // Act
      const response = await app.inject({
        method: 'POST',
        url: '/auth/request-password-reset',
        payload: { email: 'registered@example.com' },
      });

      // Assert: same generic response — caller cannot distinguish registered from unregistered
      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({
        message: 'If that email is registered, a reset link has been sent.',
      });
    },
  );

  // -------------------------------------------------------------------------
  // Test 3 — Reset with invalid/expired token returns 400
  // -------------------------------------------------------------------------
  it(
    'Test 3 — returns 400 with error message when reset token is invalid or expired',
    async () => {
      // Arrange: service throws with statusCode 400 — simulates invalid/expired token
      vi.mocked(authService.resetPassword).mockRejectedValue(
        Object.assign(new Error('Invalid or expired reset token.'), { statusCode: 400 }),
      );

      // Act
      const response = await app.inject({
        method: 'POST',
        url: '/auth/reset-password',
        payload: { token: 'invalid-token', newPassword: 'ValidPass1' },
      });

      // Assert
      expect(response.statusCode).toBe(400);
      expect(response.json()).toEqual({ error: 'Invalid or expired reset token.' });
    },
  );

  // -------------------------------------------------------------------------
  // Test 4 — Reset with weak password returns 400
  // -------------------------------------------------------------------------
  it(
    'Test 4 — returns 400 with password complexity error when new password is too weak',
    async () => {
      // Arrange: service throws with statusCode 400 — simulates password validation failure
      vi.mocked(authService.resetPassword).mockRejectedValue(
        Object.assign(
          new Error('Password must be at least 8 characters with uppercase, lowercase, and digit.'),
          { statusCode: 400 },
        ),
      );

      // Act
      const response = await app.inject({
        method: 'POST',
        url: '/auth/reset-password',
        payload: { token: 'valid-token', newPassword: 'weak' },
      });

      // Assert
      expect(response.statusCode).toBe(400);
      expect(response.json()).toEqual({
        error: 'Password must be at least 8 characters with uppercase, lowercase, and digit.',
      });
    },
  );

  // -------------------------------------------------------------------------
  // Test 5 — Successful password reset returns 200
  // -------------------------------------------------------------------------
  it(
    'Test 5 — returns 200 with success message when token is valid and password is compliant',
    async () => {
      // Arrange: service resolves — simulates successful password reset
      vi.mocked(authService.resetPassword).mockResolvedValue(undefined);

      // Act
      const response = await app.inject({
        method: 'POST',
        url: '/auth/reset-password',
        payload: { token: 'valid-token', newPassword: 'ValidPass1' },
      });

      // Assert
      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({ message: 'Password reset successfully.' });
    },
  );

  // -------------------------------------------------------------------------
  // Property-based test — Anti-enumeration holds for any email string
  //
  // Validates: Requirements 3.1
  //
  // Key property: the response NEVER reveals whether the email is registered.
  // For any email string, whether the service resolves or rejects, the handler
  // must always return status 200 with the generic message.
  // -------------------------------------------------------------------------
  it(
    'Property — POST /auth/request-password-reset always returns 200 with generic message for any email string',
    async () => {
      /**
       * Validates: Requirements 3.1
       *
       * For any email-like string, the anti-enumeration property holds:
       * the response is always status 200 with the generic message,
       * regardless of whether the email is registered or not.
       */
      await fc.assert(
        fc.asyncProperty(
          // Generate arbitrary strings that could be used as email inputs
          fc.oneof(
            fc.emailAddress(),
            fc.string({ minLength: 1, maxLength: 100 }),
          ),
          async (email) => {
            // Mock service to resolve (simulates both registered and unregistered paths)
            vi.mocked(authService.requestPasswordReset).mockResolvedValue(undefined);

            const response = await app.inject({
              method: 'POST',
              url: '/auth/request-password-reset',
              payload: { email },
            });

            expect(response.statusCode).toBe(200);
            expect(response.json()).toEqual({
              message: 'If that email is registered, a reset link has been sent.',
            });
          },
        ),
        { numRuns: 50 },
      );
    },
  );

  it(
    'Property — POST /auth/request-password-reset always returns 200 with generic message even when service rejects',
    async () => {
      /**
       * Validates: Requirements 3.1
       *
       * Even when the service throws (e.g., SendGrid failure, Redis failure),
       * the anti-enumeration property must hold: the response is always
       * status 200 with the generic message.
       */
      await fc.assert(
        fc.asyncProperty(
          fc.oneof(
            fc.emailAddress(),
            fc.string({ minLength: 1, maxLength: 100 }),
          ),
          async (email) => {
            // Mock service to reject — simulates any internal error
            vi.mocked(authService.requestPasswordReset).mockRejectedValue(
              new Error('Internal service error'),
            );

            const response = await app.inject({
              method: 'POST',
              url: '/auth/request-password-reset',
              payload: { email },
            });

            expect(response.statusCode).toBe(200);
            expect(response.json()).toEqual({
              message: 'If that email is registered, a reset link has been sent.',
            });
          },
        ),
        { numRuns: 50 },
      );
    },
  );
});
