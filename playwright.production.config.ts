import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright configuration for production environment
 */
export default defineConfig({
  testDir: './tests/e2e/production',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 3 : 0,
  workers: process.env.CI ? 1 : undefined,
  timeout: 90000,
  expect: {
    timeout: 15000,
  },
  reporter: [
    ['html'],
    ['json', { outputFile: 'test-results-production.json' }],
    ['junit', { outputFile: 'test-results-production.xml' }],
  ],
  use: {
    baseURL: 'https://wishcraft.up.railway.app',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 0,
    navigationTimeout: 45000,
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      testMatch: /.*\.production\.spec\.ts$/,
    },
  ],

  // Don't start local server for production tests
  webServer: undefined,
});