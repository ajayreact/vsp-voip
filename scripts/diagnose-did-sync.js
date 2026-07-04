#!/usr/bin/env node
/**
 * Verify DID sync API is deployed and Telnyx inventory is reachable.
 *
 *   API_URL=https://api.vspphone.com node scripts/diagnose-did-sync.js
 *   API_URL=https://api.vspphone.com EMAIL=... PASSWORD=... node scripts/diagnose-did-sync.js
 */
require('dotenv').config();

const API_URL = (process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000').replace(/\/$/, '');

async function fetchJson(path, { method = 'GET', token, body } = {}) {
  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text.slice(0, 300) };
  }
  return { status: res.status, json };
}

async function login() {
  const email = process.env.EMAIL || process.env.TEST_ADMIN_EMAIL || process.env.VALIDATE_EMAIL;
  const password = process.env.PASSWORD || process.env.TEST_ADMIN_PASSWORD || process.env.VALIDATE_PASSWORD;
  if (!email || !password) return null;
  const res = await fetchJson('/api/auth/login', {
    method: 'POST',
    body: { email, password },
  });
  return res.json?.token || null;
}

async function main() {
  console.log(`\n=== DID Sync Diagnostic ===\nAPI_URL=${API_URL}\n`);

  const ready = await fetchJson('/ready');
  console.log(`GET /ready -> ${ready.status}`);
  if (ready.json?.build) {
    console.log(`  gitCommit: ${ready.json.build.gitCommit || '(not set)'}`);
    console.log(`  telnyx.apiKeyConfigured: ${ready.json.telnyx?.apiKeyConfigured ?? ready.json.telnyx}`);
  }

  const unauth = await fetchJson('/api/admin/numbers/sync', { method: 'POST' });
  console.log(`POST /api/admin/numbers/sync (no auth) -> ${unauth.status}`);
  if (unauth.status === 404) {
    console.error('\nFAIL: Sync route missing on API. Rebuild and restart the API container:');
    console.error('  cd /opt/vsp-voip && docker compose up -d --build api');
    console.error('  curl -s https://api.vspphone.com/ready | jq .build.gitCommit');
    process.exit(1);
  }
  if (unauth.status !== 401) {
    console.warn(`  expected 401 without token, got ${unauth.status}`);
  } else {
    console.log('  OK: route registered (401 without token)');
  }

  const token = await login();
  if (!token) {
    console.log('\nSkip authenticated sync probe (set EMAIL and PASSWORD to test full sync).');
    process.exit(0);
  }

  const authed = await fetchJson('/api/admin/numbers/sync', { method: 'POST', token });
  console.log(`POST /api/admin/numbers/sync (authenticated) -> ${authed.status}`);
  if (authed.status === 200) {
    console.log('  telnyxTotal:', authed.json?.telnyxTotal);
    console.log('  created:', authed.json?.created);
    console.log('  dbTotal:', authed.json?.dbTotal);
    console.log('  assigned:', authed.json?.assigned);
    console.log('  unassigned:', authed.json?.unassigned);
    console.log('\nOK: Telnyx DID sync succeeded.');
    process.exit(0);
  }

  console.error('  error:', authed.json?.error || authed.json);
  if (authed.status === 503 && String(authed.json?.error || '').includes('Telnyx API key')) {
    console.error('\nSet TELNYX_API_KEY in the API .env and restart the api container.');
  }
  process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
