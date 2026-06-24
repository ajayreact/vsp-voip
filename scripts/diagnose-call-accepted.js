#!/usr/bin/env node
/**
 * Diagnose POST /api/softphone/call-accepted availability and session lookup.
 *
 * Usage:
 *   node scripts/diagnose-call-accepted.js
 *   API_URL=https://api.vspphone.com node scripts/diagnose-call-accepted.js
 */
require('dotenv').config();

const API_URL = process.env.API_URL || process.env.API_PUBLIC_URL || 'http://localhost:3000';
const EMAIL = process.env.EMAIL || 'admin@asuitech.com';
const PASSWORD = process.env.PASSWORD || 'Admin@123';
const PATH = '/api/softphone/call-accepted';

async function request(method, path, body, token) {
  const url = `${API_URL}${path}`;
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  let res;
  try {
    res = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (err) {
    return {
      url,
      method,
      networkError: err.message,
    };
  }
  const raw = await res.text();
  let parsed;
  try {
    parsed = raw ? JSON.parse(raw) : null;
  } catch {
    parsed = { raw };
  }
  return {
    url,
    method,
    status: res.status,
    statusText: res.statusText,
    body: parsed,
  };
}

async function main() {
  console.log('=== diagnose-call-accepted ===');
  console.log(`API_URL=${API_URL}`);
  console.log(`PATH=${PATH}\n`);

  const unauth = await request('POST', PATH, {});
  console.log('1) Unauthenticated probe (expect 401 if route exists, 404 if missing):');
  console.log(JSON.stringify(unauth, null, 2));

  const login = await request('POST', '/api/auth/login', { email: EMAIL, password: PASSWORD });
  console.log('\n2) Login:');
  if (login.status !== 200) {
    console.log(JSON.stringify(login, null, 2));
    process.exit(1);
  }
  const token = login.body?.accessToken;
  console.log(`   status=${login.status} user=${login.body?.user?.email}`);

  const accepted = await request('POST', PATH, {}, token);
  console.log('\n3) Authenticated call-accepted (no active ring expected):');
  console.log(JSON.stringify(accepted, null, 2));

  if (accepted.status === 404) {
    console.log('\n>>> ROOT CAUSE: Route not deployed on this API host.');
    console.log('>>> Deploy latest API (commit 12b0ea6+) then re-run this script.');
    process.exit(2);
  }

  if (accepted.status === 200 && accepted.body?.reason === 'no_pending_ring') {
    console.log('\n>>> Route exists. Session lookup returned no_pending_ring (expected with no live call).');
    console.log('>>> During a live inbound ring, re-run while Accept is pending to verify ok:true.');
  }

  if (accepted.status === 200 && accepted.body?.ok === true) {
    console.log('\n>>> markAgentWebRtcAccepted succeeded — bridge grace should be armed.');
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
