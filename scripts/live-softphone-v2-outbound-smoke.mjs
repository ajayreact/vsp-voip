#!/usr/bin/env node
/** Quick outbound-only softphone v2 smoke test */
import { chromium } from 'playwright';
import { config as loadEnv } from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

loadEnv({ path: path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '.env') });

const WEB_URL = process.env.WEB_URL || 'http://localhost:3001';
const API_URL = process.env.API_URL || 'https://api.vspphone.com';
const EMAIL = process.env.EMAIL || 'admin@asuitech.com';
const PASSWORD = process.env.PASSWORD || 'Admin@123';
const OUTBOUND = process.env.OUTBOUND_TEST_NUMBER || '102';

async function login() {
  const res = await fetch(`${API_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'login failed');
  return data.accessToken;
}

async function main() {
  const token = await login();
  const browser = await chromium.launch({
    channel: 'chrome',
    headless: true,
    args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'],
  });
  const context = await browser.newContext({ permissions: ['microphone'] });
  await context.addInitScript((t) => localStorage.setItem('vsp_token', t), token);
  const page = await context.newPage();
  let ready = false;
  page.on('console', (msg) => {
    if (msg.text().includes('[softphone-v2] telnyx.ready')) ready = true;
  });
  await page.goto(`${WEB_URL}/softphone-v2`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => true, {}, { timeout: 1000 }).catch(() => {});
  for (let i = 0; i < 120 && !ready; i += 1) await page.waitForTimeout(500);
  if (!ready) throw new Error('not registered');
  await page.locator('[aria-label="Entered phone number"]').fill(OUTBOUND);
  await page.click('[aria-label="Call"]');
  await page.waitForSelector('[aria-label="End Call"]', { timeout: 45000 });
  await page.waitForTimeout(5000);
  const audioOk = await page.evaluate(() => {
    const el = document.getElementById('softphone-v2-remote');
    return Boolean(el?.srcObject);
  });
  await page.click('[aria-label="End Call"]');
  await browser.close();
  console.log(JSON.stringify({ outboundConnected: true, remoteAudioAttached: audioOk }, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
