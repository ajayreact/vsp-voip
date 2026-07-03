#!/usr/bin/env node
/**
 * Final V3 staging validation — API smoke for all major modules.
 * Usage: API_BASE=https://api.vspphone.com WEB_BASE=https://app.vspphone.com node scripts/run-v3-final-staging-validation.js
 */
require('dotenv').config();
const axios = require('axios');
const fs = require('fs');
const path = require('path');

const API = (process.env.API_BASE || 'https://api.vspphone.com').replace(/\/$/, '');
const WEB = (process.env.WEB_BASE || 'https://app.vspphone.com').replace(/\/$/, '');
const SUPER_EMAIL = process.env.SEED_SUPER_EMAIL || 'superadmin@vsp-voip.com';
const SUPER_PASSWORD = process.env.SEED_SUPER_PASSWORD || 'Super@123';

const report = {
  generatedAt: new Date().toISOString(),
  apiBase: API,
  webBase: WEB,
  gitCommit: null,
  testLabTenant: null,
  ui: [],
  api: [],
  backup: null,
  runtime: null,
  issues: [],
  warnings: [],
};

async function login(email, password) {
  const res = await axios.post(`${API}/api/auth/login`, { email, password }, { validateStatus: () => true, timeout: 30000 });
  if (res.status !== 200 || !res.data?.accessToken) {
    throw new Error(`Login failed for ${email}: ${res.status} ${JSON.stringify(res.data)}`);
  }
  return { token: res.data.accessToken, user: res.data.user };
}

async function apiCheck(name, method, urlPath, token, { expect = 200, body } = {}) {
  const res = await axios({
    method,
    url: `${API}${urlPath}`,
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    data: body,
    validateStatus: () => true,
    timeout: 120000,
  });
  const ok = res.status === expect || (expect === '2xx' && res.status >= 200 && res.status < 300);
  const entry = { name, path: urlPath, status: res.status, ok, success: res.data?.success };
  if (!ok) {
    report.issues.push(`${method} ${urlPath} -> ${res.status}: ${res.data?.error || res.statusText}`);
  }
  report.api.push(entry);
  return res;
}

async function uiCheck(route) {
  const res = await axios.get(`${WEB}${route}`, { validateStatus: () => true, timeout: 30000 });
  const ok = res.status >= 200 && res.status < 400;
  report.ui.push({ route, status: res.status, ok });
  if (!ok) report.issues.push(`UI ${route} -> ${res.status}`);
}

async function main() {
  const { execSync } = require('child_process');
  try {
    report.gitCommit = execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();
  } catch {
    report.gitCommit = 'unknown';
  }

  const ready = await axios.get(`${API}/ready`, { timeout: 15000 });
  report.platformReady = ready.data;

  const superAuth = await login(SUPER_EMAIL, SUPER_PASSWORD);

  // Persist Test Lab tenant if none exists
  console.log('==> Test Lab persist run');
  const tlRun = await axios.post(
    `${API}/api/v3/test-lab/run`,
    { teardown: false, teardownOnFinish: false, employeeCount: 5, simulateNumbers: true },
    { headers: { Authorization: `Bearer ${superAuth.token}` }, validateStatus: () => true, timeout: 300000 },
  );
  report.testLab = {
    status: tlRun.status,
    summary: tlRun.data?.summary || tlRun.data?.report?.summary,
    error: tlRun.data?.error,
  };
  if (tlRun.status !== 200 || !tlRun.data?.summary?.overallPass) {
    report.issues.push(`Test Lab persist failed: ${tlRun.data?.error || tlRun.status}`);
  } else {
    report.testLabTenant = {
      tenantId: tlRun.data.report?.tenantId || tlRun.data.run?.tenantId,
      credentials: tlRun.data.report?.credentials || tlRun.data.credentials,
    };
  }

  const tenantCreds = report.testLabTenant?.credentials;
  if (!tenantCreds?.email) {
    console.error('No test tenant credentials — stopping API tenant checks');
  } else {
    const tenantAuth = await login(tenantCreds.email, tenantCreds.password);
    const t = tenantAuth.token;
    report.testLabTenant.tenantId = report.testLabTenant.tenantId || tenantAuth.user.tenantId;

    const tenantGets = [
      ['Dashboard', 'GET', '/api/v3/dashboard'],
      ['Dashboard summary', 'GET', '/api/v3/dashboard/summary'],
      ['Health Center', 'GET', '/api/v3/health'],
      ['Numbers', 'GET', '/api/v3/numbers'],
      ['Numbers health', 'GET', '/api/v3/numbers/health'],
      ['Devices', 'GET', '/api/v3/devices'],
      ['Devices health', 'GET', '/api/v3/devices/health'],
      ['Device vendors', 'GET', '/api/v3/devices/vendors'],
      ['Ring groups', 'GET', '/api/v3/pbx/ring-groups'],
      ['Queues', 'GET', '/api/v3/pbx/queues'],
      ['Business hours', 'GET', '/api/v3/pbx/business-hours'],
      ['Holidays', 'GET', '/api/v3/pbx/holidays'],
      ['Voicemail', 'GET', '/api/v3/pbx/voicemail'],
      ['Call flows', 'GET', '/api/v3/callflows'],
      ['Call flow node types', 'GET', '/api/v3/callflows/node-types'],
      ['Runtime status', 'GET', '/api/v3/runtime/status'],
      ['Runtime jobs', 'GET', '/api/v3/runtime/jobs'],
      ['Runtime health', 'GET', '/api/v3/runtime/health'],
      ['Reports', 'GET', '/api/v3/reports'],
      ['Analytics', 'GET', '/api/v3/analytics'],
      ['Activity', 'GET', '/api/v3/activity'],
      ['Notifications', 'GET', '/api/v3/notifications'],
      ['Billing', 'GET', '/api/v3/billing'],
      ['Subscription', 'GET', '/api/v3/subscription'],
      ['License', 'GET', '/api/v3/license'],
      ['Backup list', 'GET', '/api/v3/backup'],
      ['Lifecycle', 'GET', '/api/v3/lifecycle'],
      ['Production health', 'GET', '/api/v3/production-health'],
      ['Monitoring', 'GET', '/api/v3/monitoring'],
      ['Metrics', 'GET', '/api/v3/metrics'],
      ['Diagnostics', 'GET', '/api/v3/diagnostics'],
      ['Runtime validation', 'GET', '/api/v3/runtime-validation'],
      ['System health', 'GET', '/api/v3/system-health'],
      ['Migration report', 'GET', '/api/v3/migration/report'],
      ['PBX references', 'GET', '/api/v3/pbx/references'],
      ['Directory', 'GET', '/api/v3/directory'],
      ['Profile', 'GET', '/api/v3/profile'],
      ['Deployment', 'GET', '/api/v3/deployment'],
    ];

    for (const [name, method, p] of tenantGets) {
      await apiCheck(name, method, p, t);
    }

    // Phase 4 — Backup create + restore preview (non-destructive)
    console.log('==> Backup validation');
    const backupCreate = await apiCheck('Backup create', 'POST', '/api/v3/backup/create', t, {
      body: { label: 'Final staging validation snapshot', includeConfig: true },
    });
    const backupId = backupCreate.data?.backup?.id || backupCreate.data?.id;
    report.backup = { createStatus: backupCreate.status, backupId };
    if (backupId) {
      const preview = await apiCheck('Restore preview', 'POST', '/api/v3/backup/restore-preview', t, {
        body: { backupId },
      });
      report.backup.previewStatus = preview.status;
      report.backup.previewDestructive = preview.data?.destructive ?? preview.data?.wouldDestruct ?? null;
    } else {
      report.warnings.push('Backup create did not return backupId — restore preview skipped');
    }

    // Runtime validation run (sync may be off)
    await apiCheck('Runtime validation run', 'POST', '/api/v3/runtime-validation/run', t, { body: {} });
  }

  // Super admin only
  await apiCheck('Test Lab status', 'GET', '/api/v3/test-lab/status', superAuth.token);
  await apiCheck('Marketplace search', 'POST', '/api/v3/numbers/search', superAuth.token, {
    body: { countryCode: 'US', limit: 1 },
  });

  const uiRoutes = [
    '/v3/dashboard', '/v3/employees', '/v3/numbers', '/v3/marketplace', '/v3/devices',
    '/v3/device-provision', '/v3/ring-groups', '/v3/queues', '/v3/business-hours', '/v3/holidays',
    '/v3/voicemail', '/v3/callflows', '/v3/callflows/builder', '/v3/callflows/simulator',
    '/v3/runtime', '/v3/runtime/jobs', '/v3/runtime/health', '/v3/health', '/v3/reports',
    '/v3/analytics', '/v3/activity', '/v3/notifications', '/v3/billing', '/v3/subscription',
    '/v3/license', '/v3/backups', '/v3/import-export', '/v3/lifecycle', '/v3/production-health',
    '/v3/monitoring', '/v3/metrics', '/v3/diagnostics', '/v3/runtime-validation', '/v3/migration',
    '/v3/test-lab', '/v3/system-health',
  ];
  console.log('==> UI route smoke');
  for (const route of uiRoutes) await uiCheck(route);

  const out = path.join(__dirname, '..', 'reports', 'v3-final-staging-validation.json');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify(report, null, 2));
  console.log(`\nReport: ${out}`);
  console.log(`Issues: ${report.issues.length}, Warnings: ${report.warnings.length}`);
  if (report.testLabTenant) {
    console.log('Test tenant:', JSON.stringify(report.testLabTenant, null, 2));
  }
  process.exit(report.issues.length ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
