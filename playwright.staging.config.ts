import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright configuration for staging environment
 */
export default defineConfig({
  testDir: './tests/e2e/staging',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  timeout: 60000,
  expect: {
    timeout: 10000,
  },
  reporter: [
    ['html'],
    ['json', { outputFile: 'test-results-staging.json' }],
    ['junit', { outputFile: 'test-results-staging.xml' }],
  ],
  use: {
    baseURL: 'https://wishcraft-staging.up.railway.app',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 0,
    navigationTimeout: 30000,
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      testMatch: /.*\.staging\.spec\.ts$/,
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
      testMatch: /.*\.staging\.spec\.ts$/,
    },
  ],

  // Don't start local server for staging tests
  webServer: undefined,
});