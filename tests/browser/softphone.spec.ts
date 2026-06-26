import { test, expect } from '@playwright/test';
import { config } from '../lib/config';

const email = process.env.QA_EMAIL || process.env.EMAIL || 'admin@asuitech.com';
const password = process.env.QA_PASSWORD || process.env.PASSWORD || 'Admin@123';

test.describe('Softphone browser QA', () => {
  test.beforeEach(async ({ page }) => {
    test.skip(!process.env.QA_BROWSER_TESTS, 'Set QA_BROWSER_TESTS=true to run Playwright UI tests');
  });

  test('login page loads', async ({ page }) => {
    await page.goto('/login');
    await expect(page).toHaveURL(/login/);
  });

  test('softphone login and registration', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel(/email/i).fill(email);
    await page.getByLabel(/password/i).fill(password);
    await page.getByRole('button', { name: /sign in|log in|login/i }).click();
    await page.waitForURL(/dashboard|softphone|calls/, { timeout: 30000 });
    await page.goto('/softphone-v2');
    await expect(page).toHaveURL(/softphone/);
  });

  test('dial pad visible on softphone', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel(/email/i).fill(email);
    await page.getByLabel(/password/i).fill(password);
    await page.getByRole('button', { name: /sign in|log in|login/i }).click();
    await page.waitForURL(/dashboard|softphone|calls/, { timeout: 30000 });
    await page.goto('/softphone-v2');
    await expect(page.getByRole('button', { name: /^1$|^2$|^3$/ }).first()).toBeVisible({ timeout: 15000 });
  });

  test('call history page', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel(/email/i).fill(email);
    await page.getByLabel(/password/i).fill(password);
    await page.getByRole('button', { name: /sign in|log in|login/i }).click();
    await page.waitForURL(/dashboard|softphone|calls/, { timeout: 30000 });
    await page.goto('/calls');
    await expect(page).toHaveURL(/calls/);
  });

  test('voicemail page', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel(/email/i).fill(email);
    await page.getByLabel(/password/i).fill(password);
    await page.getByRole('button', { name: /sign in|log in|login/i }).click();
    await page.waitForURL(/dashboard|softphone|calls/, { timeout: 30000 });
    await page.goto('/voicemail');
    await expect(page).toHaveURL(/voicemail/);
  });

  test('recordings page', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel(/email/i).fill(email);
    await page.getByLabel(/password/i).fill(password);
    await page.getByRole('button', { name: /sign in|log in|login/i }).click();
    await page.waitForURL(/dashboard|softphone|calls/, { timeout: 30000 });
    await page.goto('/recordings');
    await expect(page).toHaveURL(/recordings/);
  });

  test('settings page', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel(/email/i).fill(email);
    await page.getByLabel(/password/i).fill(password);
    await page.getByRole('button', { name: /sign in|log in|login/i }).click();
    await page.waitForURL(/dashboard|softphone|calls/, { timeout: 30000 });
    await page.goto('/settings');
    await expect(page).toHaveURL(/settings/);
  });

  test('WebRTC diagnostics route', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel(/email/i).fill(email);
    await page.getByLabel(/password/i).fill(password);
    await page.getByRole('button', { name: /sign in|log in|login/i }).click();
    await page.waitForURL(/dashboard|softphone|calls/, { timeout: 30000 });
    const res = await page.goto('/softphone-v2/diagnostics');
    expect(res?.status()).toBeLessThan(500);
  });

  test.skip('answer inbound call — requires QA_LIVE_CALLS', async () => {
    expect(config.liveCalls).toBe(true);
  });

  test.skip('mute hold transfer — requires active call', async () => {
    expect(config.liveCalls).toBe(true);
  });
});
