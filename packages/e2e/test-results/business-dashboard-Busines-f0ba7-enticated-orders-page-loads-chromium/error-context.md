# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: business-dashboard.spec.ts >> Business Dashboard — Authenticated >> orders page loads
- Location: tests\business-dashboard.spec.ts:56:3

# Error details

```
Error: page.goto: Target page, context or browser has been closed
```

# Test source

```ts
  1   | import { test, expect, type Page } from '@playwright/test';
  2   | 
  3   | /**
  4   |  * Business Dashboard — Authenticated flows
  5   |  *
  6   |  * The SPA is served at / and handles all /dashboard/* routes client-side.
  7   |  * Direct navigation to /dashboard/orders hits the API endpoint, not the SPA.
  8   |  * So we always navigate to / first, then use client-side link clicks.
  9   |  *
  10  |  * Requires env vars:
  11  |  *   SMOKE_EMAIL     — verified business account email
  12  |  *   SMOKE_PASSWORD  — its password
  13  |  */
  14  | 
  15  | const BASE = 'https://augustus.silverconne.com';
  16  | const EMAIL = process.env.SMOKE_EMAIL ?? '';
  17  | const PASSWORD = process.env.SMOKE_PASSWORD ?? '';
  18  | 
  19  | test.skip(!EMAIL || !PASSWORD, 'Set SMOKE_EMAIL and SMOKE_PASSWORD to run authenticated tests');
  20  | 
  21  | /** Login via API, inject token into localStorage, load the SPA */
  22  | async function loginAs(page: Page, email: string, password: string) {
  23  |   const res = await page.request.post(`${BASE}/auth/login`, {
  24  |     data: { email, password },
  25  |   });
  26  |   const body = await res.json() as { token?: string };
> 27  |   if (!body.token) throw new Error(`Login failed: ${JSON.stringify(body)}`);
      |              ^ Error: page.goto: Target page, context or browser has been closed
  28  | 
  29  |   // Load the SPA login page first (so we're on the right origin)
  30  |   await page.goto(`${BASE}/login`);
  31  |   // Inject the token
  32  |   await page.evaluate((token: string) => {
  33  |     localStorage.setItem('augustus_token', token);
  34  |   }, body.token);
  35  | 
  36  |   // Now navigate to the dashboard root — the SPA will read the token and render
  37  |   await page.goto(`${BASE}/`);
  38  |   await page.waitForURL((url) => url.pathname.includes('dashboard'), { timeout: 15_000 });
  39  | }
  40  | 
  41  | /** Navigate to a dashboard section via the sidebar nav link */
  42  | async function goTo(page: Page, label: string) {
  43  |   await page.locator(`nav a:has-text("${label}"), aside a:has-text("${label}")`).first().click();
  44  |   await page.waitForTimeout(500);
  45  | }
  46  | 
  47  | test.describe('Business Dashboard — Authenticated', () => {
  48  |   test.beforeEach(async ({ page }) => {
  49  |     await loginAs(page, EMAIL, PASSWORD);
  50  |   });
  51  | 
  52  |   test('dashboard loads with sidebar navigation', async ({ page }) => {
  53  |     await expect(page).toHaveURL(/dashboard/);
  54  |     await expect(page.locator('aside').first()).toBeVisible({ timeout: 8000 });
  55  |     // Sidebar nav links are present
  56  |     await expect(page.locator('aside a:has-text("Subscription")')).toBeVisible();
  57  |     await expect(page.locator('aside a:has-text("Orders")')).toBeVisible();
  58  |   });
  59  | 
  60  |   test('subscription page loads with plan table', async ({ page }) => {
  61  |     await goTo(page, 'Subscription');
  62  |     await expect(page.getByText('Available Plans')).toBeVisible({ timeout: 10_000 });
  63  |   });
  64  | 
  65  |   test('catalogue page loads', async ({ page }) => {
  66  |     await goTo(page, 'Catalogue');
  67  |     await expect(page.locator('h2').first()).toBeVisible({ timeout: 8000 });
  68  |   });
  69  | 
  70  |   test('orders page loads', async ({ page }) => {
  71  |     await goTo(page, 'Orders');
  72  |     await expect(page.getByText('Orders').first()).toBeVisible({ timeout: 8000 });
  73  |   });
  74  | 
  75  |   test('revenue page loads', async ({ page }) => {
  76  |     await goTo(page, 'Revenue');
  77  |     await expect(page.getByText('Revenue & Withdrawals')).toBeVisible({ timeout: 8000 });
  78  |   });
  79  | 
  80  |   test('conversations page loads', async ({ page }) => {
  81  |     await goTo(page, 'Conversations');
  82  |     await expect(page.getByRole('heading', { name: 'Active Conversations' })).toBeVisible({ timeout: 8000 });
  83  |   });
  84  | 
  85  |   test('training page loads', async ({ page }) => {
  86  |     await goTo(page, 'Training');
  87  |     await expect(page.locator('h2').first()).toBeVisible({ timeout: 8000 });
  88  |   });
  89  | 
  90  |   test('support page loads', async ({ page }) => {
  91  |     await goTo(page, 'Support');
  92  |     await expect(page.getByText('Support').first()).toBeVisible({ timeout: 8000 });
  93  |   });
  94  | 
  95  |   test('WhatsApp setup page loads', async ({ page }) => {
  96  |     await goTo(page, 'WhatsApp Setup');
  97  |     await expect(page.locator('h2').first()).toBeVisible({ timeout: 8000 });
  98  |   });
  99  | 
  100 |   test('payment settings page loads', async ({ page }) => {
  101 |     await goTo(page, 'Payments');
  102 |     await expect(page.locator('h2').first()).toBeVisible({ timeout: 8000 });
  103 |   });
  104 | 
  105 |   test('credit usage widget visible in sidebar', async ({ page }) => {
  106 |     // CreditUsageWidget is rendered in the sidebar on every dashboard page
  107 |     await expect(page.locator('aside')).toBeVisible({ timeout: 8000 });
  108 |     // The widget shows credit info — check the aside contains some text
  109 |     const asideText = await page.locator('aside').innerText();
  110 |     expect(asideText.length).toBeGreaterThan(10);
  111 |   });
  112 | });
  113 | 
```