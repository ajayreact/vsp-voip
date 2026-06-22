#!/usr/bin/env node
/**
 * Phase 4A MVP E2E — npm run validate:phase4a-mvp
 * Requires: API on API_BASE (default http://localhost:3000), seeded tenant admin
 */
require('dotenv').config();

const axios = require('axios');
const { getPrisma } = require('../db');

const BASE = process.env.API_BASE || 'http://localhost:3000';
const results = [];

function pass(name, detail = '') {
  results.push({ name, ok: true, detail });
  console.log(`✅ ${name}${detail ? ` — ${detail}` : ''}`);
}

function fail(name, detail = '') {
  results.push({ name, ok: false, detail });
  console.log(`❌ ${name}${detail ? ` — ${detail}` : ''}`);
}

function warn(name, detail = '') {
  results.push({ name, ok: null, detail });
  console.log(`⚠️  ${name}${detail ? ` — ${detail}` : ''}`);
}

async function http(method, path, opts = {}) {
  return axios({ method, url: `${BASE}${path}`, validateStatus: () => true, ...opts });
}

async function main() {
  console.log('\n=== Phase 4A MVP E2E Validation ===\n');

  // Database status
  try {
    const prisma = await getPrisma();
    const tables = await prisma.$queryRawUnsafe(`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name LIKE 'Extension%'
      ORDER BY table_name
    `);
    const names = tables.map((r) => r.table_name);
    const expected = ['Extension', 'ExtensionDevice', 'ExtensionForwarding', 'ExtensionSecurity', 'ExtensionVoicemailSettings'];
    for (const t of expected) {
      if (names.includes(t)) pass(`DB table: ${t}`);
      else fail(`DB table: ${t}`);
    }
    const extCount = await prisma.extension.count();
    pass('DB Extension model query', `${extCount} row(s) before test`);
  } catch (err) {
    fail('Database connectivity', err.message);
    summarize();
    process.exit(1);
  }

  // API health
  const health = await http('GET', '/health');
  if (health.status === 200) pass('API /health', health.data?.status || 'ok');
  else fail('API /health', `status ${health.status}`);

  const unauth = await http('GET', '/api/tenant/extensions');
  if (unauth.status === 401) pass('Extension route registered', '401 without token');
  else if (unauth.status === 404) fail('Extension route registered', '404 — restart API');
  else fail('Extension route registered', `unexpected ${unauth.status}`);

  const login = await http('POST', '/api/auth/login', {
    data: {
      email: process.env.SEED_ADMIN_EMAIL || 'admin@asuitech.com',
      password: process.env.SEED_ADMIN_PASSWORD || 'Admin@123',
    },
  });

  if (login.status !== 200 || !login.data?.accessToken) {
    fail('Admin login', `status ${login.status} — set SEED_ADMIN_EMAIL/PASSWORD`);
    summarize();
    process.exit(1);
  }

  const auth = { headers: { Authorization: `Bearer ${login.data.accessToken}` } };
  pass('Admin login', login.data.user?.email || 'ok');

  if (!login.data.user?.tenantId) {
    fail('Tenant context', 'user has no tenantId');
    summarize();
    process.exit(1);
  }

  const suffix = Date.now().toString().slice(-4);
  let extensionId = null;

  // 1. Create extension
  const create = await http('POST', '/api/tenant/extensions', {
    ...auth,
    data: {
      extensionNumber: `9${suffix}`,
      displayName: `MVP Test ${suffix}`,
      email: `mvp-${suffix}@example.com`,
      department: 'QA',
      voicemailEnabled: true,
      callRecordingEnabled: true,
    },
  });

  if (create.status === 201 && create.data?.extension?.id) {
    extensionId = create.data.extension.id;
    pass('1. Create extension', `${create.data.extension.extensionNumber} — ${create.data.extension.displayName}`);
  } else {
    fail('1. Create extension', `${create.status} ${create.data?.error || ''}`);
    summarize();
    process.exit(1);
  }

  // 2. Edit extension
  const edit = await http('PATCH', `/api/tenant/extensions/${extensionId}`, {
    ...auth,
    data: {
      displayName: `MVP Edited ${suffix}`,
      department: 'Engineering',
      voicemailSettings: { enabled: true, emailNotifications: true, notificationEmail: 'alerts@example.com' },
    },
  });

  if (edit.status === 200 && edit.data?.extension?.displayName === `MVP Edited ${suffix}`) {
    pass('2. Edit extension', edit.data.extension.department);
  } else {
    fail('2. Edit extension', `${edit.status} ${edit.data?.error || ''}`);
  }

  // 3. Disable extension
  const disable = await http('POST', `/api/tenant/extensions/${extensionId}/disable`, { ...auth });
  if (disable.status === 200 && disable.data?.extension?.status === 'INACTIVE') {
    pass('3. Disable extension', 'status=INACTIVE');
  } else {
    fail('3. Disable extension', `${disable.status} status=${disable.data?.extension?.status}`);
  }

  // Re-activate for delete test (via PATCH)
  await http('PATCH', `/api/tenant/extensions/${extensionId}`, {
    ...auth,
    data: { status: 'ACTIVE' },
  });

  // 5. Devices tab
  const devices = await http('GET', '/api/tenant/extensions/devices', { ...auth });
  if (devices.status === 200 && Array.isArray(devices.data?.devices)) {
    pass('5. Devices tab API', `${devices.data.totalDevices} total, ${devices.data.registeredDevices} online`);
  } else {
    fail('5. Devices tab API', `status ${devices.status}`);
  }

  // 6. Voicemail tab (extension voicemails + stats)
  const vm = await http('GET', `/api/tenant/extensions/${extensionId}/voicemails`, { ...auth });
  if (vm.status === 200 && Array.isArray(vm.data?.voicemails)) {
    pass('6. Voicemail tab API', `${vm.data.voicemails.length} message(s)`);
  } else {
    fail('6. Voicemail tab API', `status ${vm.status}`);
  }

  // 7. Analytics counters
  const analytics = await http('GET', `/api/tenant/extensions/${extensionId}/analytics`, { ...auth });
  const stats = await http('GET', '/api/tenant/extensions/stats', { ...auth });
  const analyticsOk = analytics.status === 200
    && typeof analytics.data?.analytics?.inboundCalls === 'number'
    && typeof analytics.data?.analytics?.voicemails === 'number';
  const statsOk = stats.status === 200
    && typeof stats.data?.stats?.totalExtensions === 'number';

  if (analyticsOk && statsOk) {
    pass('7. Analytics counters', `inbound=${analytics.data.analytics.inboundCalls}, totalExt=${stats.data.stats.totalExtensions}`);
  } else {
    fail('7. Analytics counters', `analytics=${analytics.status} stats=${stats.status}`);
  }

  // List includes our extension
  const list = await http('GET', '/api/tenant/extensions', { ...auth });
  const found = list.data?.extensions?.some((e) => e.id === extensionId);
  if (list.status === 200 && found) pass('Extension list includes created row');
  else fail('Extension list', `status=${list.status} found=${found}`);

  // 4. Delete extension
  const del = await http('DELETE', `/api/tenant/extensions/${extensionId}`, { ...auth });
  const gone = await http('GET', `/api/tenant/extensions/${extensionId}`, { ...auth });
  if (del.status === 200 && del.data?.deleted && gone.status === 404) {
    pass('4. Delete extension', 'removed and 404 on GET');
  } else {
    fail('4. Delete extension', `delete=${del.status} getAfter=${gone.status}`);
  }

  // UI file checks
  const uiFiles = [
    'web/src/app/(app)/phone-system/extensions/page.tsx',
    'web/src/app/(app)/phone-system/extensions/new/page.tsx',
    'web/src/app/(app)/phone-system/extensions/[id]/page.tsx',
    'web/src/app/(app)/phone-system/devices/page.tsx',
    'web/src/app/(app)/phone-system/voicemail/page.tsx',
  ];
  const fs = require('fs');
  const path = require('path');
  for (const f of uiFiles) {
    if (fs.existsSync(path.join(__dirname, '..', f))) pass(`UI: ${f.split('/').slice(-2).join('/')}`);
    else fail(`UI: ${f}`);
  }

  summarize();
  process.exit(results.some((r) => r.ok === false) ? 1 : 0);
}

function summarize() {
  const passed = results.filter((r) => r.ok === true).length;
  const failed = results.filter((r) => r.ok === false).length;
  const warned = results.filter((r) => r.ok === null).length;
  console.log(`\n--- ${passed} passed, ${failed} failed, ${warned} warnings ---\n`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
