import { test, expect } from '@playwright/test';

/**
 * Auth flows — Business Dashboard
 * Tests the live UI at https://augustus.silverconne.com
 */

const BASE = 'https://augustus.silverconne.com';

test.describe('Business Dashboard — Auth', () => {
  test('login page loads and shows form', async ({ page }) => {
    await page.goto(`${BASE}/login`);
    await expect(page.locator('input[type="email"], input[name="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"], button:has-text("Login"), button:has-text("Sign in")')).toBeVisible();
  });

  test('login with wrong credentials shows error', async ({ page }) => {
    await page.goto(`${BASE}/login`);
    await page.locator('input[type="email"], input[name="email"]').fill('nobody@nowhere.com');
    await page.locator('input[type="password"]').fill('WrongPass1!');
    await page.locator('button[type="submit"], button:has-text("Login"), button:has-text("Sign in")').click();
    // Should show an error message, not navigate away
    await expect(page.locator('text=/invalid|incorrect|failed|wrong|error/i')).toBeVisible({ timeout: 8000 });
    await expect(page).toHaveURL(/login/);
  });

  test('register page loads', async ({ page }) => {
    await page.goto(`${BASE}/register`);
    await expect(page.locator('input[type="email"], input[name="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
  });

  test('register with weak password shows validation error', async ({ page }) => {
    await page.goto(`${BASE}/register`);
    const emailInput = page.locator('input[type="email"], input[name="email"]').first();
    const passwordInput = page.locator('input[type="password"]').first();
    const submitBtn = page.locator('button[type="submit"]').first();

    await emailInput.fill(`smoke-${Date.now()}@example.com`);
    await passwordInput.fill('weak');
    await submitBtn.click();

    // Should show a validation error or stay on register page
    await expect(page).toHaveURL(/register/, { timeout: 5000 });
  });

  test('forgot password page loads', async ({ page }) => {
    await page.goto(`${BASE}/forgot-password`);
    await expect(page.locator('input[type="email"], input[name="email"]')).toBeVisible();
  });

  test('unauthenticated access to dashboard redirects to login', async ({ page }) => {
    await page.goto(`${BASE}/`);
    // Should redirect to login if not authenticated
    await expect(page).toHaveURL(/login/, { timeout: 8000 });
  });
});
