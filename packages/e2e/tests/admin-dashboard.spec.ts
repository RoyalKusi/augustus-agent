import { test, expect, type Page } from '@playwright/test';

/**
 * Admin Dashboard — Authenticated flows
 *
 * Admin SPA is served at /admin-app (root).
 * It redirects to /admin-app/admin/login when unauthenticated.
 * Token key: augustus_operator_token
 * TOTP: stub accepts any 6-digit code (verifyTotp is a stub in this build)
 *
 * Requires env vars:
 *   ADMIN_EMAIL     — operator email (defaults to admin@augustus.ai)
 *   ADMIN_PASSWORD  — operator password (defaults to Admin@1234)
 *   ADMIN_TOTP      — any 6-digit code (defaults to 123456, stub accepts all)
 */

const BASE = 'https://augustus.silverconne.com';
const ADMIN_SPA = `${BASE}/admin-app`;
const EMAIL = process.env.ADMIN_EMAIL ?? 'admin@augustus.ai';
const PASSWORD = process.env.ADMIN_PASSWORD ?? 'Admin@1234';
const TOTP = process.env.ADMIN_TOTP || '123456';

/**
 * Login via API (handles 2-step MFA), inject token into localStorage,
 * then navigate to the admin SPA root so it reads the token on mount.
 */
async function adminLoginViaApi(page: Page) {
  // Step 1: credentials only
  const step1 = await page.request.post(`${BASE}/admin/auth/login`, {
    data: { email: EMAIL, password: PASSWORD, totpCode: '' },
  });
  const step1Body = await step1.json() as { mfaRequired?: boolean; token?: string };

  let token: string;
  if (step1Body.token) {
    token = step1Body.token;
  } else if (step1Body.mfaRequired) {
    // Step 2: submit TOTP
    const step2 = await page.request.post(`${BASE}/admin/auth/login`, {
      data: { email: EMAIL, password: PASSWORD, totpCode: TOTP },
    });
    const step2Body = await step2.json() as { token?: string };
    if (!step2Body.token) throw new Error(`Admin MFA login failed: ${JSON.stringify(step2Body)}`);
    token = step2Body.token;
  } else {
    throw new Error(`Unexpected login response: ${JSON.stringify(step1Body)}`);
  }

  // Load the admin SPA root (establishes the correct origin for localStorage)
  await page.goto(ADMIN_SPA);
  // Inject the operator token
  await page.evaluate((t: string) => {
    localStorage.setItem('augustus_operator_token', t);
  }, token);

  // Reload — SPA reads token and navigates to /admin/businesses
  await page.goto(ADMIN_SPA);
  await page.waitForURL((url) => url.pathname.includes('/admin/'), { timeout: 15_000 });
}

// ── Login page tests ──────────────────────────────────────────────────────────

test.describe('Admin Dashboard — Login', () => {
  test.beforeEach(async ({ page }) => {
    // Clear any existing token so we always see the login form
    await page.goto(ADMIN_SPA);
    await page.evaluate(() => localStorage.removeItem('augustus_operator_token'));
    await page.goto(ADMIN_SPA);
    await page.waitForURL((url) => url.pathname.includes('login'), { timeout: 8000 });
  });

  test('admin login page loads with email and password fields', async ({ page }) => {
    await expect(page.locator('input[type="email"]')).toBeVisible({ timeout: 8000 });
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test('admin login with wrong credentials shows error', async ({ page }) => {
    await page.locator('input[type="email"]').fill('nobody@nowhere.com');
    await page.locator('input[type="password"]').fill('WrongPass1!');
    await page.locator('button[type="submit"]').click();
    await expect(page.locator('text=/invalid|incorrect|failed|error/i')).toBeVisible({ timeout: 8000 });
  });

  test('valid credentials advance to TOTP step', async ({ page }) => {
    await page.locator('input[type="email"]').fill(EMAIL);
    await page.locator('input[type="password"]').fill(PASSWORD);
    await page.locator('button[type="submit"]').click();
    // Step 2 TOTP input should appear
    await expect(page.locator('input[type="text"][maxlength="6"]').first()).toBeVisible({ timeout: 8000 });
  });

  test('full login flow with TOTP succeeds', async ({ page }) => {
    // Step 1
    await page.locator('input[type="email"]').fill(EMAIL);
    await page.locator('input[type="password"]').fill(PASSWORD);
    await page.locator('button[type="submit"]').click();
    // Step 2
    const totpInput = page.locator('input[type="text"][maxlength="6"]').first();
    await expect(totpInput).toBeVisible({ timeout: 8000 });
    await totpInput.fill(TOTP);
    await page.locator('button[type="submit"]').click();
    // Should navigate to admin dashboard
    await page.waitForURL((url) => url.pathname.includes('/admin/businesses'), { timeout: 15_000 });
    await expect(page.locator('text=/business|account/i').first()).toBeVisible({ timeout: 8000 });
  });
});

// ── Authenticated admin tests ─────────────────────────────────────────────────

test.describe('Admin Dashboard — Authenticated', () => {
  test.beforeEach(async ({ page }) => {
    await adminLoginViaApi(page);
  });

  test('businesses list page loads', async ({ page }) => {
    await expect(page.locator('text=/business|account/i').first()).toBeVisible({ timeout: 8000 });
  });

  test('businesses list shows registered test account', async ({ page }) => {
    await expect(page.locator('text=/Eco|11gsroyal/i').first()).toBeVisible({ timeout: 8000 });
  });

  test('metrics page loads', async ({ page }) => {
    await page.goto(ADMIN_SPA);
    await page.waitForURL((url) => url.pathname.includes('/admin/'), { timeout: 10_000 });
    const metricsLink = page.locator('a:has-text("Metrics"), a:has-text("AI Usage"), nav a').filter({ hasText: /metric|usage/i }).first();
    if (await metricsLink.isVisible({ timeout: 2000 }).catch(() => false)) {
      await metricsLink.click();
    } else {
      // Navigate via URL — but we need to stay in SPA context
      await page.evaluate(() => { window.history.pushState({}, '', '/admin-app/admin/metrics'); window.dispatchEvent(new PopStateEvent('popstate')); });
    }
    await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 8000 });
  });

  test('withdrawals page loads', async ({ page }) => {
    await page.evaluate(() => { window.history.pushState({}, '', '/admin-app/admin/withdrawals'); window.dispatchEvent(new PopStateEvent('popstate')); });
    await page.waitForTimeout(500);
    await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 8000 });
  });

  test('API key status page loads', async ({ page }) => {
    await page.evaluate(() => { window.history.pushState({}, '', '/admin-app/admin/api-keys'); window.dispatchEvent(new PopStateEvent('popstate')); });
    await page.waitForTimeout(500);
    await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 8000 });
  });

  test('support tickets page loads', async ({ page }) => {
    await page.evaluate(() => { window.history.pushState({}, '', '/admin-app/admin/support'); window.dispatchEvent(new PopStateEvent('popstate')); });
    await page.waitForTimeout(500);
    await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 8000 });
  });
});
