#!/usr/bin/env node
/**
 * Post-deploy smoke validation — health, readiness, critical REST routes.
 * Run: API_BASE=https://api.example.com npm run smoke:deploy
 * Local:  API_BASE=http://localhost:3000 npm run smoke:deploy
 */
require('dotenv').config();

const axios = require('axios');

const BASE = (process.env.API_BASE || process.env.API_URL || 'http://localhost:3000').replace(/\/$/, '');
const WEB = (process.env.WEB_BASE || process.env.WEB_URL || 'http://localhost:3001').replace(/\/$/, '');
const EMAIL = process.env.QA_EMAIL || process.env.EMAIL || 'admin@asuitech.com';
const PASSWORD = process.env.QA_PASSWORD || process.env.PASSWORD || 'Admin@123';
const CHECK_WEB = process.env.SMOKE_CHECK_WEB === 'true';

const results = [];
let failed = 0;

function pass(name, detail = '') {
  results.push({ name, ok: true, detail });
  console.log(`  ✓ ${name}${detail ? ` — ${detail}` : ''}`);
}

function fail(name, detail = '') {
  results.push({ name, ok: false, detail });
  console.error(`  ✗ ${name}${detail ? ` — ${detail}` : ''}`);
  failed += 1;
}

async function http(method, path, opts = {}) {
  return axios({
    method,
    url: `${BASE}${path}`,
    validateStatus: () => true,
    timeout: 15000,
    ...opts,
  });
}

async function checkHealth() {
  console.log('\n== Health ==');
  const health = await http('GET', '/health');
  if (health.status === 200 && health.data?.status === 'ok') {
    pass('/health', `uptime ${health.data.uptimeSeconds ?? '?'}s`);
  } else {
    fail('/health', `status ${health.status}`);
  }

  const ready = await http('GET', '/ready');
  if (ready.status === 200 || ready.status === 503) {
    pass('/ready responds', `status ${ready.status}`);
    if (ready.data?.database?.connected) pass('database connected');
    else fail('database connected', ready.data?.database?.error || 'not connected');
  } else {
    fail('/ready responds', `status ${ready.status}`);
  }
}

async function checkAuthRoutes() {
  console.log('\n== Auth ==');
  const anonMe = await http('GET', '/api/auth/me');
  anonMe.status === 401 ? pass('GET /api/auth/me requires auth') : fail('GET /api/auth/me requires auth', `got ${anonMe.status}`);

  const login = await http('POST', '/api/auth/login', {
    data: { email: EMAIL, password: PASSWORD },
  });
  if (login.status !== 200 || !login.data?.accessToken) {
    fail('POST /api/auth/login', `status ${login.status}`);
    return null;
  }
  pass('POST /api/auth/login');
  return login.data.accessToken;
}

async function checkTenantRoutes(token) {
  console.log('\n== Tenant routes ==');
  const routes = [
    ['GET', '/api/auth/me'],
    ['GET', '/api/dashboard/stats'],
    ['GET', '/api/calls'],
    ['GET', '/api/conversations'],
    ['GET', '/api/sms/conversations'],
    ['GET', '/api/softphone/config'],
    ['GET', '/api/tenant/voicemails'],
    ['GET', '/api/tenant/recordings'],
    ['GET', '/api/tenant/extensions'],
    ['GET', '/api/tenant/ring-groups'],
  ];

  for (const [method, path] of routes) {
    const res = await http(method, path, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if ([200, 403].includes(res.status)) pass(`${method} ${path}`, `status ${res.status}`);
    else fail(`${method} ${path}`, `status ${res.status}`);
  }
}

async function checkWeb() {
  if (!CHECK_WEB) {
    console.log('\n== Web (skipped — set SMOKE_CHECK_WEB=true) ==');
    return;
  }
  console.log('\n== Web ==');
  try {
    const res = await axios.get(`${WEB}/login`, { validateStatus: () => true, timeout: 15000 });
    if (res.status < 500) pass('Web /login', `status ${res.status}`);
    else fail('Web /login', `status ${res.status}`);
  } catch (error) {
    fail('Web /login', error.message);
  }
}

async function main() {
  console.log(`Smoke deploy validation\nAPI: ${BASE}`);
  await checkHealth();
  const token = await checkAuthRoutes();
  if (token) await checkTenantRoutes(token);
  await checkWeb();

  console.log(`\n${failed === 0 ? 'PASS' : 'FAIL'} — ${failed} failure(s), ${results.length} checks`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
