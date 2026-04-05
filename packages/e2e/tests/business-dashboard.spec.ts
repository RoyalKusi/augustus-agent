import { test, expect, type Page } from '@playwright/test';

/**
 * Business Dashboard — Authenticated flows
 *
 * The SPA is served at / and handles all /dashboard/* routes client-side.
 * Direct navigation to /dashboard/orders hits the API endpoint, not the SPA.
 * So we always navigate to / first, then use client-side link clicks.
 *
 * Requires env vars:
 *   SMOKE_EMAIL     — verified business account email
 *   SMOKE_PASSWORD  — its password
 */

const BASE = 'https://augustus.silverconne.com';
const EMAIL = process.env.SMOKE_EMAIL ?? '';
const PASSWORD = process.env.SMOKE_PASSWORD ?? '';

test.skip(!EMAIL || !PASSWORD, 'Set SMOKE_EMAIL and SMOKE_PASSWORD to run authenticated tests');

/** Login via API, inject token into localStorage, load the SPA */
async function loginAs(page: Page, email: string, password: string) {
  const res = await page.request.post(`${BASE}/auth/login`, {
    data: { email, password },
  });
  const body = await res.json() as { token?: string };
  if (!body.token) throw new Error(`Login failed: ${JSON.stringify(body)}`);

  // Load the SPA login page first (so we're on the right origin)
  await page.goto(`${BASE}/login`);
  // Inject the token
  await page.evaluate((token: string) => {
    localStorage.setItem('augustus_token', token);
  }, body.token);

  // Now navigate to the dashboard root — the SPA will read the token and render
  await page.goto(`${BASE}/`);
  await page.waitForURL((url) => url.pathname.includes('dashboard'), { timeout: 15_000 });
}

/** Navigate to a dashboard section via the sidebar nav link */
async function goTo(page: Page, label: string) {
  await page.locator(`nav a:has-text("${label}"), aside a:has-text("${label}")`).first().click();
  await page.waitForTimeout(500);
}

test.describe('Business Dashboard — Authenticated', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, EMAIL, PASSWORD);
  });

  test('dashboard loads with sidebar navigation', async ({ page }) => {
    await expect(page).toHaveURL(/dashboard/);
    await expect(page.locator('aside').first()).toBeVisible({ timeout: 8000 });
    // Sidebar nav links are present
    await expect(page.locator('aside a:has-text("Subscription")')).toBeVisible();
    await expect(page.locator('aside a:has-text("Orders")')).toBeVisible();
  });

  test('subscription page loads with plan table', async ({ page }) => {
    await goTo(page, 'Subscription');
    await expect(page.getByText('Available Plans')).toBeVisible({ timeout: 10_000 });
  });

  test('catalogue page loads', async ({ page }) => {
    await goTo(page, 'Catalogue');
    await expect(page.locator('h2').first()).toBeVisible({ timeout: 8000 });
  });

  test('orders page loads', async ({ page }) => {
    await goTo(page, 'Orders');
    await expect(page.getByText('Orders').first()).toBeVisible({ timeout: 8000 });
  });

  test('revenue page loads', async ({ page }) => {
    await goTo(page, 'Revenue');
    await expect(page.getByText('Revenue & Withdrawals')).toBeVisible({ timeout: 8000 });
  });

  test('conversations page loads', async ({ page }) => {
    await goTo(page, 'Conversations');
    await expect(page.getByRole('heading', { name: 'Active Conversations' })).toBeVisible({ timeout: 8000 });
  });

  test('training page loads', async ({ page }) => {
    await goTo(page, 'Training');
    await expect(page.locator('h2').first()).toBeVisible({ timeout: 8000 });
  });

  test('support page loads', async ({ page }) => {
    await goTo(page, 'Support');
    await expect(page.getByText('Support').first()).toBeVisible({ timeout: 8000 });
  });

  test('WhatsApp setup page loads', async ({ page }) => {
    await goTo(page, 'WhatsApp Setup');
    await expect(page.locator('h2').first()).toBeVisible({ timeout: 8000 });
  });

  test('payment settings page loads', async ({ page }) => {
    await goTo(page, 'Payments');
    await expect(page.locator('h2').first()).toBeVisible({ timeout: 8000 });
  });

  test('credit usage widget visible in sidebar', async ({ page }) => {
    // CreditUsageWidget is rendered in the sidebar on every dashboard page
    await expect(page.locator('aside')).toBeVisible({ timeout: 8000 });
    // The widget shows credit info — check the aside contains some text
    const asideText = await page.locator('aside').innerText();
    expect(asideText.length).toBeGreaterThan(10);
  });
});
