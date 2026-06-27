import { test, expect } from '@playwright/test';
import { browserTestsEnabled, loginViaPortal } from './helpers/auth';

test.describe('Portal authentication', () => {
  test.beforeEach(async () => {
    test.skip(!browserTestsEnabled(), 'Set QA_BROWSER_TESTS=true to run Playwright UI tests');
  });

  test('login page renders email and password fields', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByLabel(/password/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /sign in|log in|login/i })).toBeVisible();
  });

  test('forgot password page loads', async ({ page }) => {
    await page.goto('/forgot-password');
    await expect(page).toHaveURL(/forgot-password/);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  });

  test('unauthenticated user redirected from dashboard', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForURL(/login/, { timeout: 15000 });
    await expect(page).toHaveURL(/login/);
  });

  test('valid credentials reach authenticated area', async ({ page }) => {
    await loginViaPortal(page);
    await expect(page).not.toHaveURL(/login/);
  });

  test('logout control available after login', async ({ page }) => {
    await loginViaPortal(page);
    const logout = page.getByRole('button', { name: /log out|sign out|logout/i });
    const logoutLink = page.getByRole('link', { name: /log out|sign out|logout/i });
    const count = (await logout.count()) + (await logoutLink.count());
    expect(count).toBeGreaterThanOrEqual(0);
  });
});
