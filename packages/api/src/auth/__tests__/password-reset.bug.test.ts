/**
 * Bug condition exploration tests for the password reset flow.
 *
 * These tests encode the EXPECTED (fixed) behavior.
 * They are designed to FAIL on unfixed code — failure confirms the bugs exist.
 *
 * Test 1 — Silent swallow: WILL FAIL on unfixed code
 *   The empty `.catch(() => {})` discards errors without logging.
 *   Expected (fixed) behavior: app.log.error is called with { err, email }.
 *
 * Test 2 — Anti-enumeration preserved under error: SHOULD PASS on unfixed code
 *   The generic success response is always returned regardless of errors.
 *
 * Test 3 — Proxy config: WILL FAIL on unfixed code
 *   Only `/api` is present in the Vite proxy config; `/auth` is missing.
 *   Expected (fixed) behavior: a proxy rule for `/auth` exists.
 *
 * Validates: Requirements 1.1, 1.2, 1.3
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Fastify from 'fastify';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build a minimal Fastify app with authRoutes registered and all external
 * dependencies mocked so no real DB / Redis / SendGrid calls are made.
 */
async function buildTestApp() {
  // Mock the heavy dependencies before importing routes
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

describe('Bug condition exploration — password reset', () => {
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
  // Test 1 — Silent swallow (WILL FAIL on unfixed code)
  // -------------------------------------------------------------------------
  it(
    'Test 1 — logs error when requestPasswordReset throws (WILL FAIL on unfixed code)',
    async () => {
      // Arrange: mock the service to throw a SendGrid-style error
      const sendGridError = new Error('SendGrid API error');
      vi.mocked(authService.requestPasswordReset).mockRejectedValue(sendGridError);

      // Spy on app.log.error BEFORE making the request
      const logErrorSpy = vi.spyOn(app.log, 'error');

      // Act: inject the request
      await app.inject({
        method: 'POST',
        url: '/auth/request-password-reset',
        payload: { email: 'test@example.com' },
      });

      // Assert: app.log.error must have been called with { err, email } and the expected message
      // This WILL FAIL on unfixed code because the empty .catch(() => {}) discards the error
      expect(logErrorSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          err: sendGridError,
          email: 'test@example.com',
        }),
        '[auth] requestPasswordReset failed',
      );
    },
  );

  // -------------------------------------------------------------------------
  // Test 2 — Anti-enumeration preserved under error (SHOULD PASS on unfixed code)
  // -------------------------------------------------------------------------
  it(
    'Test 2 — returns 200 with generic message even when requestPasswordReset throws (SHOULD PASS on unfixed code)',
    async () => {
      // Arrange: mock the service to throw
      vi.mocked(authService.requestPasswordReset).mockRejectedValue(
        new Error('SendGrid API error'),
      );

      // Act
      const response = await app.inject({
        method: 'POST',
        url: '/auth/request-password-reset',
        payload: { email: 'test@example.com' },
      });

      // Assert: anti-enumeration response is always returned
      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({
        message: 'If that email is registered, a reset link has been sent.',
      });
    },
  );

  // -------------------------------------------------------------------------
  // Test 3 — Proxy config (WILL FAIL on unfixed code)
  // -------------------------------------------------------------------------
  it(
    'Test 3 — Vite proxy config includes /auth rule (WILL FAIL on unfixed code)',
    () => {
      // Read the Vite config as text and inspect the proxy configuration.
      // We use a text-based check because the config exports a function and
      // importing it would require the full Vite environment.
      const viteConfigPath = resolve(
        __dirname,
        '../../../../business-dashboard/vite.config.ts',
      );
      const viteConfigContent = readFileSync(viteConfigPath, 'utf-8');

      // Assert: the proxy object must contain an entry for '/auth'
      // This WILL FAIL on unfixed code — only '/api' is present
      expect(viteConfigContent).toMatch(/['"]\/auth['"]\s*:/);
    },
  );
});
