#!/usr/bin/env node
/**
 * Verify tenant JWT auth for mobile API routes.
 *
 * Usage:
 *   node scripts/verify-mobile-auth.js
 *   API_URL=https://api.vspphone.com EMAIL=admin@asuitech.com PASSWORD=Admin@123 node scripts/verify-mobile-auth.js
 */

const API_URL = (process.env.API_URL || 'http://localhost:3000').replace(/\/$/, '');
const EMAIL = process.env.EMAIL || 'admin@asuitech.com';
const PASSWORD = process.env.PASSWORD || 'Admin@123';

async function request(path, { method = 'GET', token, body } = {}) {
  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = { raw: text.slice(0, 200) };
  }

  return { status: res.status, data };
}

async function main() {
  console.log(`API: ${API_URL}`);
  console.log(`User: ${EMAIL}\n`);

  const login = await request('/api/auth/login', {
    method: 'POST',
    body: { email: EMAIL, password: PASSWORD },
  });

  if (login.status !== 200 || !login.data.accessToken) {
    console.error('FAIL login', login.status, login.data);
    process.exit(1);
  }

  const token = login.data.accessToken;
  console.log('OK  POST /api/auth/login');
  console.log(`    role=${login.data.user?.role} tenantId=${login.data.user?.tenantId || 'none'}\n`);

  const routes = [
    ['GET', '/api/auth/me'],
    ['GET', '/api/dashboard/stats'],
    ['GET', '/api/calls?limit=5'],
    ['GET', '/api/tenant/profile'],
    ['GET', '/api/tenant/recordings?limit=5&sync=0'],
    ['GET', '/api/tenant/voicemails?limit=5'],
    ['GET', '/api/sms/conversations'],
  ];

  let failed = 0;

  for (const [method, path] of routes) {
    const result = await request(path, { method, token });
    const ok = result.status >= 200 && result.status < 300;
    const label = `${method} ${path}`;
    if (ok) {
      console.log(`OK  ${label} (${result.status})`);
    } else {
      failed += 1;
      console.log(`FAIL ${label} (${result.status})`, result.data.error || result.data);
    }
  }

  console.log('');
  if (failed) {
    console.error(`${failed} route(s) failed — check JWT_SECRET consistency and Authorization header forwarding.`);
    process.exit(1);
  }

  console.log('All mobile API routes authorized successfully.');
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
