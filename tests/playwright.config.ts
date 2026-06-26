import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig, devices } from '@playwright/test';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const webBase = process.env.WEB_BASE || process.env.WEB_URL || 'http://localhost:3001';

export default defineConfig({
  testDir: path.join(__dirname, 'browser'),
  outputDir: path.join(__dirname, '..', 'reports', 'playwright'),
  reporter: [
    ['list'],
    ['html', { outputFolder: path.join(__dirname, '..', 'reports', 'playwright-html'), open: 'never' }],
    ['json', { outputFile: path.join(__dirname, '..', 'reports', 'playwright-results.json') }],
  ],
  use: {
    baseURL: webBase,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'off',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  timeout: 60000,
  retries: process.env.CI ? 1 : 0,
});
