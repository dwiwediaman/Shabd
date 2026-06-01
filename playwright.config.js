import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2E config for Shabd.
 *
 * Tests run against the Vite dev server (localhost:5173).
 * Only Chromium is needed — this is an Android WebView app and
 * Chromium is the closest desktop analogue.
 *
 * Viewport matches a mid-range Android phone (Pixel 5).
 */
export default defineConfig({
  testDir: './e2e',

  // Each test gets 15 s; the boot sequence takes ~1.5 s minimum.
  timeout: 15_000,

  // Never run tests in parallel — they share a single dev-server instance
  // and some tests manipulate localStorage.
  workers: 1,
  fullyParallel: false,

  reporter: [['list'], ['html', { open: 'never' }]],

  use: {
    baseURL: 'http://localhost:5173',
    // Match Capacitor WebView dimensions on a typical mid-range Android.
    ...devices['Pixel 5'],
    // Silence most browser console noise in CI.
    ignoreHTTPSErrors: true,
    // Give every action 5 s before timing out (default 30 s is too long for
    // a unit-style E2E suite).
    actionTimeout: 5_000,
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Pixel 5'] },
    },
  ],

  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    // Re-use an already-running dev server in local dev; always start fresh in CI.
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
});
