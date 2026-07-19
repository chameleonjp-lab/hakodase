import { defineConfig } from '@playwright/test';

const mobile = {
  isMobile: true,
  hasTouch: true,
  locale: 'ja-JP',
  timezoneId: 'Asia/Tokyo',
};

export default defineConfig({
  testDir: './test/browser',
  outputDir: 'test-results/browser',
  timeout: 30_000,
  expect: { timeout: 7_000 },
  fullyParallel: false,
  workers: process.env.CI ? 1 : undefined,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI
    ? [['line'], ['html', { outputFolder: 'playwright-report', open: 'never' }]]
    : [['list']],
  use: {
    baseURL: 'http://127.0.0.1:4173',
    locale: 'ja-JP',
    timezoneId: 'Asia/Tokyo',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  webServer: {
    command: 'node scripts/dev-server.mjs',
    env: { PORT: '4173' },
    url: 'http://127.0.0.1:4173/',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects: [
    {
      name: 'mobile-320-webkit',
      use: {
        ...mobile,
        browserName: 'webkit',
        viewport: { width: 320, height: 568 },
      },
    },
    {
      name: 'mobile-390-webkit',
      use: {
        ...mobile,
        browserName: 'webkit',
        viewport: { width: 390, height: 844 },
      },
    },
    {
      name: 'desktop-chromium',
      use: {
        browserName: 'chromium',
        viewport: { width: 1280, height: 720 },
        locale: 'ja-JP',
        timezoneId: 'Asia/Tokyo',
      },
    },
  ],
});
