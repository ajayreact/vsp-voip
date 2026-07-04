import type { Page } from '@playwright/test';
import { config } from '../../lib/config';

export const qaEmail = process.env.QA_EMAIL || process.env.EMAIL || config.email;
export const qaPassword = process.env.QA_PASSWORD || process.env.PASSWORD || config.password;

export function browserTestsEnabled(): boolean {
  return process.env.QA_BROWSER_TESTS === 'true';
}

export async function loginViaPortal(page: Page): Promise<void> {
  await page.goto('/login');
  await page.getByLabel(/email/i).fill(qaEmail);
  await page.getByLabel(/password/i).fill(qaPassword);
  await page.getByRole('button', { name: /sign in|log in|login/i }).click();
  await page.waitForURL(/dashboard|softphone|calls|admin/, { timeout: 30000 });
}

export async function expectAuthenticatedShell(page: Page): Promise<void> {
  await expectNoServerError(page);
}

async function expectNoServerError(page: Page): Promise<void> {
  const body = await page.locator('body').innerText();
  if (/internal server error|application error/i.test(body)) {
    throw new Error('Page rendered a server error');
  }
}
