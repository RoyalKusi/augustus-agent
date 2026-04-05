import { defineConfig, devices } from '@playwright/test';

/**
 * Live E2E test config targeting https://augustus.silverconne.com
 * Business dashboard: https://augustus.silverconne.com
 * Admin dashboard:    https://augustus.silverconne.com/admin-app
 * API:                https://augustus.silverconne.com/api  (or same origin)
 */
export default defineConfig({
  testDir: './tests',
  timeout: 30_000,
  retries: 1,
  workers: 1,
  reporter: [['html', { open: 'never' }], ['list']],

  use: {
    baseURL: 'https://augustus.silverconne.com',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    ignoreHTTPSErrors: false,
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
