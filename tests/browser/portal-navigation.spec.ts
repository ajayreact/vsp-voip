import { test, expect } from '@playwright/test';
import { browserTestsEnabled, loginViaPortal } from './helpers/auth';

const TENANT_ROUTES = [
  { path: '/dashboard', pattern: /dashboard/ },
  { path: '/employees', pattern: /employees/ },
  { path: '/numbers', pattern: /numbers/ },
  { path: '/devices', pattern: /devices/ },
  { path: '/ring-groups', pattern: /ring-groups/ },
  { path: '/callflows', pattern: /callflows/ },
  { path: '/voicemail', pattern: /voicemail/ },
  { path: '/reports', pattern: /reports/ },
  { path: '/billing', pattern: /billing/ },
  { path: '/profile', pattern: /profile/ },
  { path: '/health', pattern: /health/ },
  { path: '/activity', pattern: /activity/ },
];

test.describe('Portal navigation', () => {
  test.beforeEach(async ({ page }) => {
    test.skip(!browserTestsEnabled(), 'Set QA_BROWSER_TESTS=true to run Playwright UI tests');
    await loginViaPortal(page);
  });

  for (const route of TENANT_ROUTES) {
    test(`loads ${route.path}`, async ({ page }) => {
      const response = await page.goto(route.path);
      expect(response?.status()).toBeLessThan(500);
      await expect(page).toHaveURL(route.pattern);
    });
  }

  test('legacy /v3/dashboard redirects to /dashboard', async ({ page }) => {
    await page.goto('/v3/dashboard');
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test('softphone v2 loads without 5xx', async ({ page }) => {
    const response = await page.goto('/softphone-v2');
    expect(response?.status()).toBeLessThan(500);
    await expect(page).toHaveURL(/softphone/);
  });
});
