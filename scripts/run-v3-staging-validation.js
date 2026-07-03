#!/usr/bin/env node
/**
 * One-shot V3 staging validation — API, UI smoke, Test Lab (teardown + persist).
 * Usage: node scripts/run-v3-staging-validation.js
 */
require('dotenv').config();

const axios = require('axios');

const API = (process.env.API_BASE || 'http://localhost:3000').replace(/\/$/, '');
const WEB = (process.env.WEB_BASE || 'http://localhost:3001').replace(/\/$/, '');
const TENANT_ADMIN_EMAIL = process.env.QA_EMAIL || 'admin@asuitech.com';
const TENANT_ADMIN_PASSWORD = process.env.QA_PASSWORD || 'Admin@123';
const SUPER_EMAIL = process.env.SEED_SUPER_EMAIL || 'superadmin@vsp-voip.com';
const SUPER_PASSWORD = process.env.SEED_SUPER_PASSWORD || 'Super@123';

const report = {
  api: [],
  ui: [],
  testLabTeardown: null,
  testLabPersist: null,
  gitCommit: null,
  errors: [],
  warnings: [],
};

async function login(email, password) {
  const res = await axios.post(`${API}/api/auth/login`, { email, password }, { validateStatus: () => true });
  if (res.status !== 200 || !res.data?.accessToken) {
    throw new Error(`Login failed for ${email}: HTTP ${res.status} ${JSON.stringify(res.data)}`);
  }
  return res.data.accessToken;
}

async function checkApi(name, method, path, token, expectStatus = 200) {
  const res = await axios({
    method,
    url: `${API}${path}`,
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    validateStatus: () => true,
    timeout: 120000,
  });
  const ok = res.status === expectStatus;
  report.api.push({ name, path, status: res.status, ok, success: res.data?.success });
  if (!ok) report.errors.push(`API ${method} ${path} -> ${res.status}`);
  return res;
}

async function checkUi(path) {
  const res = await axios.get(`${WEB}${path}`, { validateStatus: () => true, timeout: 30000 });
  const ok = res.status >= 200 && res.status < 400;
  report.ui.push({ path, status: res.status, ok });
  if (!ok) report.errors.push(`UI ${path} -> ${res.status}`);
}

async function main() {
  const { execSync } = require('child_process');
  try {
    report.gitCommit = execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();
  } catch {
    report.gitCommit = 'unknown';
  }

  console.log('== Phase 3: API verification ==');
  const tenantToken = await login(TENANT_ADMIN_EMAIL, TENANT_ADMIN_PASSWORD);
  const superToken = await login(SUPER_EMAIL, SUPER_PASSWORD);

  await checkApi('GET /api/v3/health', 'GET', '/api/v3/health', tenantToken);
  await checkApi('GET /api/v3/dashboard', 'GET', '/api/v3/dashboard', tenantToken);
  await checkApi('GET /api/v3/runtime/status', 'GET', '/api/v3/runtime/status', tenantToken);
  await checkApi('GET /api/v3/system-health', 'GET', '/api/v3/system-health', tenantToken);
  await checkApi('GET /api/v3/test-lab/status', 'GET', '/api/v3/test-lab/status', superToken);

  console.log('== Phase 4: UI verification ==');
  const uiPaths = [
    '/v3/dashboard',
    '/v3/health',
    '/v3/employees',
    '/v3/numbers',
    '/v3/devices',
    '/v3/callflows',
    '/v3/runtime',
    '/v3/test-lab',
    '/v3/reports',
    '/v3/backups',
    '/v3/system-health',
  ];
  for (const p of uiPaths) await checkUi(p);

  console.log('== Phase 5a: Test Lab (teardown enabled) ==');
  const teardownRes = await axios.post(
    `${API}/api/v3/test-lab/run`,
    { teardown: true, teardownOnFinish: true, employeeCount: 5, simulateNumbers: true },
    { headers: { Authorization: `Bearer ${superToken}` }, validateStatus: () => true, timeout: 300000 },
  );
  report.testLabTeardown = {
    status: teardownRes.status,
    ok: teardownRes.status === 200 && teardownRes.data?.summary?.overallPass === true,
    summary: teardownRes.data?.summary || teardownRes.data?.report?.summary || null,
    steps: teardownRes.data?.report?.steps || teardownRes.data?.steps || [],
    error: teardownRes.data?.error || teardownRes.data?.summary?.error || null,
  };
  if (!report.testLabTeardown.ok) {
    report.errors.push(`Test Lab teardown run failed: HTTP ${teardownRes.status} ${teardownRes.data?.error || ''}`);
  }

  console.log('== Phase 5b: Test Lab (teardown disabled) ==');
  const persistRes = await axios.post(
    `${API}/api/v3/test-lab/run`,
    { teardown: false, teardownOnFinish: false, employeeCount: 5, simulateNumbers: true },
    { headers: { Authorization: `Bearer ${superToken}` }, validateStatus: () => true, timeout: 300000 },
  );
  report.testLabPersist = {
    status: persistRes.status,
    ok: persistRes.status === 200 && persistRes.data?.summary?.overallPass === true,
    tenantId: persistRes.data?.report?.tenantId || persistRes.data?.tenantId || null,
    adminEmail: persistRes.data?.report?.credentials?.email || persistRes.data?.credentials?.email || null,
    adminPassword: persistRes.data?.report?.credentials?.password || persistRes.data?.credentials?.password || null,
    summary: persistRes.data?.summary || persistRes.data?.report?.summary || null,
    steps: persistRes.data?.report?.steps || persistRes.data?.steps || [],
    error: persistRes.data?.error || persistRes.data?.summary?.error || null,
  };
  if (!report.testLabPersist.ok) {
    report.errors.push(`Test Lab persist run failed: HTTP ${persistRes.status} ${persistRes.data?.error || ''}`);
  }

  if (report.testLabPersist.tenantId) {
    report.runtimeSyncAllowlist = `V3_RUNTIME_SYNC_TENANT_ALLOWLIST=${report.testLabPersist.tenantId}`;
  }

  const outPath = require('path').join(__dirname, '..', 'reports', 'v3-staging-validation.json');
  require('fs').mkdirSync(require('path').dirname(outPath), { recursive: true });
  require('fs').writeFileSync(outPath, JSON.stringify(report, null, 2));
  console.log(`\nReport written: ${outPath}`);
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.errors.length ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
