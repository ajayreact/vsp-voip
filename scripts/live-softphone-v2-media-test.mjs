#!/usr/bin/env node
/**
 * Live browser verification for Softphone V2 inbound WebRTC media wiring.
 * Requires: local web dev server, production (or local) API, Telnyx credentials in .env
 *
 * Usage:
 *   node scripts/live-softphone-v2-media-test.mjs
 *
 * Env:
 *   WEB_URL=http://localhost:3001
 *   API_URL=https://api.vspphone.com
 *   EMAIL / PASSWORD — tenant login
 *   INBOUND_TEST_DID=+13099880196
 */
import { chromium } from 'playwright';
import { config as loadEnv } from 'dotenv';
import axios from 'axios';
import { fileURLToPath } from 'url';
import path from 'path';

loadEnv({ path: path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '.env') });

const WEB_URL = process.env.WEB_URL || 'http://localhost:3001';
const API_URL = process.env.API_URL || 'https://api.vspphone.com';
const EMAIL = process.env.EMAIL || 'admin@asuitech.com';
const PASSWORD = process.env.PASSWORD || 'Admin@123';
const INBOUND_DID = process.env.INBOUND_TEST_DID || '+13099880196';
const OUTBOUND_TEST = process.env.OUTBOUND_TEST_NUMBER || '102';
const HOLD_SECONDS = Number(process.env.MEDIA_TEST_HOLD_SECONDS || 32);
const TELNYX_KEY = process.env.TELNYX_API_KEY?.trim();

/** @type {string[]} */
const consoleLogs = [];
/** @type {Record<string, unknown>[]} */
const iceStates = [];
const errors = [];

function record(line) {
  consoleLogs.push(line);
  process.stdout.write(`${line}\n`);
}

function parseIceFromLog(text) {
  const match = text.match(/WebRTC state[\s\S]*?(\{[\s\S]*?\})/);
  if (!match) return null;
  try {
    return JSON.parse(match[1]);
  } catch {
    return null;
  }
}

async function apiLogin() {
  const res = await fetch(`${API_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Login failed: ${data.error || res.status}`);
  return data.accessToken;
}

async function pickFromNumber() {
  if (!TELNYX_KEY) return null;
  const res = await axios.get('https://api.telnyx.com/v2/phone_numbers', {
    headers: { Authorization: `Bearer ${TELNYX_KEY}` },
    params: { 'page[size]': 20 },
    timeout: 20000,
  });
  const rows = res.data?.data || [];
  const row = rows.find((n) => n.phone_number && n.phone_number !== INBOUND_DID);
  return row?.phone_number || rows[0]?.phone_number || null;
}

async function triggerInboundCall(fromNumber) {
  if (!TELNYX_KEY) {
    record('[telnyx] skip — no TELNYX_API_KEY');
    return null;
  }
  const connectionCandidates = [
    process.env.TELNYX_CREDENTIAL_CONNECTION_ID?.trim(),
    process.env.TELNYX_CONNECTION_ID?.trim(),
    process.env.TELNYX_CALL_CONTROL_APP_ID?.trim(),
  ].filter(Boolean);
  if (!connectionCandidates.length) {
    record('[telnyx] skip — no connection id');
    return null;
  }
  if (!fromNumber) {
    record('[telnyx] skip — no from number');
    return null;
  }
  for (const connectionId of connectionCandidates) {
    try {
      record(`[telnyx] placing test call via ${connectionId}: ${fromNumber} → ${INBOUND_DID}`);
      const res = await axios.post(
        'https://api.telnyx.com/v2/calls',
        {
          connection_id: connectionId,
          to: INBOUND_DID,
          from: fromNumber,
        },
        {
          headers: {
            Authorization: `Bearer ${TELNYX_KEY}`,
            'Content-Type': 'application/json',
          },
          timeout: 30000,
        },
      );
      record(`[telnyx] call initiated: ${res.data?.data?.call_control_id || res.data?.data?.id || 'ok'}`);
      return res.data?.data;
    } catch (err) {
      const detail = err.response?.data?.errors?.[0]?.detail || err.message;
      record(`[telnyx] attempt failed (${connectionId}): ${detail}`);
    }
  }
  return null;
}

async function main() {
  const results = {
    passed: false,
    checks: {},
    iceStates: [],
    errors: [],
    consoleSnippet: [],
  };

  record(`=== Softphone V2 live media test ===`);
  record(`WEB_URL=${WEB_URL} API_URL=${API_URL}`);

  const token = await apiLogin();
  record('[auth] login ok');

  const fromNumber = await pickFromNumber();
  record(`[telnyx] from number: ${fromNumber || '(none)'}`);

  const browser = await chromium.launch({
    channel: 'chrome',
    headless: false,
    args: [
      '--use-fake-ui-for-media-stream',
      '--use-fake-device-for-media-stream',
      '--autoplay-policy=no-user-gesture-required',
    ],
  });

  const context = await browser.newContext({
    permissions: ['microphone'],
    ignoreHTTPSErrors: true,
  });

  await context.addInitScript((t) => {
    localStorage.setItem('vsp_token', t);
  }, token);

  const page = await context.newPage();

  let telnyxReadyResolve;
  const telnyxReadyPromise = new Promise((resolve) => {
    telnyxReadyResolve = resolve;
  });

  page.on('console', (msg) => {
    const text = msg.text();
    const line = `[browser:${msg.type()}] ${text}`;
    consoleLogs.push(line);
    if (
      text.includes('[softphone-v2]')
      || text.includes('[VSP Softphone]')
      || text.includes('media.playback-blocked')
      || text.includes('NotAllowedError')
    ) {
      record(line);
    }
    if (text.includes('WebRTC state')) {
      const ice = parseIceFromLog(text);
      if (ice) {
        iceStates.push({ label: text.split(':')[0], ...ice });
        record(`[ice] ${JSON.stringify(ice)}`);
      }
    }
    if (text.includes('[softphone-v2] telnyx.ready')) {
      telnyxReadyResolve?.();
    }
  });

  page.on('pageerror', (err) => {
    errors.push(err.message);
    record(`[pageerror] ${err.message}`);
  });

  try {
    await page.goto(`${WEB_URL}/softphone-v2`, { waitUntil: 'domcontentloaded', timeout: 120000 });

    await Promise.race([
      telnyxReadyPromise,
      page.waitForSelector('[aria-label="Entered phone number"]', { timeout: 120000 }),
    ]);
    results.checks.registration = true;
    record('[test] telnyx ready');

    // Trigger inbound PSTN call to DID (start before waiting for ring)
    const triggerPromise = triggerInboundCall(fromNumber);

    await page.waitForSelector('[aria-label="Accept"]', { timeout: 120000 });
    results.checks.inboundRing = true;
    record('[test] inbound ringing');

    await page.click('[aria-label="Accept"]');
    results.checks.acceptClicked = true;
    record('[test] accept clicked');

    await page.waitForFunction(
      () => {
        const logs = window.__mediaTestLogs || [];
        return logs.some((l) => l.includes('answer.invoked') || l.includes('state: active'));
      },
      { timeout: 45000 },
    ).catch(() => {});

    await page.waitForSelector('[aria-label="End Call"]', { timeout: 45000 });

    await page.waitForFunction(
      () => {
        const audio = document.getElementById('softphone-v2-remote');
        return audio && audio.srcObject != null;
      },
      { timeout: 45000 },
    );
    results.checks.remoteAudioAttached = true;
    record('[test] remote audio srcObject attached');

    // Wait for ICE connected/completed in console logs or live remote track
    const iceOk = await page.waitForFunction(
      async (holdMs) => {
        const start = Date.now();
        while (Date.now() - start < holdMs) {
          const audio = document.getElementById('softphone-v2-remote');
          const stream = audio?.srcObject;
          if (stream instanceof MediaStream) {
            const tracks = stream.getAudioTracks();
            if (tracks.length > 0 && tracks[0].readyState === 'live') {
              return true;
            }
          }
          await new Promise((r) => setTimeout(r, 500));
        }
        return false;
      },
      20000,
      { timeout: 25000 },
    ).then(() => true).catch(() => false);

    results.checks.liveRemoteTrack = iceOk;
    record(`[test] live remote track: ${iceOk}`);

    // Hold call 30+ seconds
    record(`[test] holding ${HOLD_SECONDS}s…`);
    const holdStart = Date.now();
    while (Date.now() - holdStart < HOLD_SECONDS * 1000) {
      const missed = await page.locator('text=Missed Call').count();
      if (missed > 0) {
        results.checks.missedDuringCall = true;
        throw new Error('Missed Call toast appeared during active call');
      }
      const hangupVisible = await page.locator('[aria-label="End Call"]').count();
      if (!hangupVisible) {
        throw new Error('Active call UI disappeared before hold period ended');
      }
      await page.waitForTimeout(2000);
    }
    results.checks.held30s = true;
    record('[test] call held 30+ seconds');

    const missedAfter = await page.locator('text=Missed Call').count();
    results.checks.noMissedToast = missedAfter === 0;

    // Hang up inbound
    await page.click('[aria-label="End Call"]');
    await page.waitForTimeout(3000);
    results.checks.inboundHangup = true;

    // Outbound test
    await page.goto(`${WEB_URL}/softphone-v2`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('[aria-label="Entered phone number"]', { timeout: 120000 });

    const keypadInput = page.locator('[aria-label="Entered phone number"]');
    await keypadInput.fill(OUTBOUND_TEST);
    await page.click('[aria-label="Call"]');
    record(`[test] outbound dial ${OUTBOUND_TEST}`);

    await page.waitForSelector('[aria-label="End Call"]', { timeout: 45000 });
    results.checks.outboundConnected = true;

    await page.waitForFunction(
      () => {
        const audio = document.getElementById('softphone-v2-remote');
        return audio && audio.srcObject != null;
      },
      { timeout: 30000 },
    );
    results.checks.outboundRemoteAudio = true;
    record('[test] outbound remote audio attached');

    await page.waitForTimeout(8000);
    await page.click('[aria-label="End Call"]');
    results.checks.outboundHangup = true;
    record('[test] outbound hangup');

    await triggerPromise.catch((err) => {
      record(`[telnyx] trigger warning: ${err.message}`);
    });

    const hasPlaybackBlocked = consoleLogs.some((l) => l.includes('media.playback-blocked'));
    const hasNotAllowed = consoleLogs.some((l) => l.includes('NotAllowedError'))
      || errors.some((e) => e.includes('NotAllowedError'));
    results.checks.noPlaybackBlocked = !hasPlaybackBlocked;
    results.checks.noNotAllowed = !hasNotAllowed;

    const iceConnected = iceStates.some((s) =>
      s.iceConnectionState === 'connected' || s.iceConnectionState === 'completed',
    ) || results.checks.liveRemoteTrack;

    results.checks.iceConnected = iceConnected;
    results.iceStates = iceStates;
    results.errors = errors;
    results.consoleSnippet = consoleLogs.filter((l) =>
      l.includes('WebRTC state')
      || l.includes('answer.')
      || l.includes('inbound:active')
      || l.includes('media.')
      || l.includes('telnyx.notification.call'),
    ).slice(-40);

    results.passed = Object.values(results.checks).every(Boolean);
    record('\n=== RESULTS ===');
    record(JSON.stringify(results, null, 2));

    if (!results.passed) {
      process.exitCode = 1;
    }
  } catch (err) {
    results.errors.push(err.message);
    record(`[fail] ${err.message}`);
    results.consoleSnippet = consoleLogs.slice(-50);
    record(JSON.stringify(results, null, 2));
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
