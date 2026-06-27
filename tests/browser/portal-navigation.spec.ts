import { test, expect } from '@playwright/test';
import { browserTestsEnabled, loginViaPortal } from './helpers/auth';

const TENANT_ROUTES = [
  { path: '/dashboard', pattern: /dashboard/ },
  { path: '/calls', pattern: /calls/ },
  { path: '/voicemail', pattern: /voicemail/ },
  { path: '/recordings', pattern: /recordings/ },
  { path: '/sms', pattern: /sms/ },
  { path: '/settings', pattern: /settings/ },
  { path: '/my-numbers', pattern: /my-numbers/ },
  { path: '/phone-system', pattern: /phone-system/ },
  { path: '/phone-system/extensions', pattern: /extensions/ },
  { path: '/phone-system/ring-groups', pattern: /ring-groups/ },
  { path: '/phone-system/call-routing', pattern: /call-routing/ },
  { path: '/greeting', pattern: /greeting/ },
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

  test('settings profile sub-route', async ({ page }) => {
    const response = await page.goto('/settings/profile');
    expect(response?.status()).toBeLessThan(500);
    await expect(page).toHaveURL(/profile/);
  });

  test('softphone v2 loads without 5xx', async ({ page }) => {
    const response = await page.goto('/softphone-v2');
    expect(response?.status()).toBeLessThan(500);
    await expect(page).toHaveURL(/softphone/);
  });
});
