#!/usr/bin/env node
/**
 * Phase 5A validation — npm run validate:phase5a
 */
require('dotenv').config();

const fs = require('fs');
const path = require('path');
const axios = require('axios');

const BASE = process.env.API_BASE || 'http://localhost:3000';
const ROOT = path.join(__dirname, '..');
const results = [];

function pass(name, detail = '') {
  results.push({ name, ok: true, detail });
  console.log(`✅ ${name}${detail ? ` — ${detail}` : ''}`);
}

function fail(name, detail = '') {
  results.push({ name, ok: false, detail });
  console.log(`❌ ${name}${detail ? ` — ${detail}` : ''}`);
}

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

function fileExists(rel) {
  return fs.existsSync(path.join(ROOT, rel));
}

async function http(method, urlPath, opts = {}) {
  return axios({ method, url: `${BASE}${urlPath}`, validateStatus: () => true, ...opts });
}

function summarize() {
  const passed = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => r.ok === false).length;
  console.log(`\n--- ${passed} passed, ${failed} failed ---\n`);
}

async function runLibFallbackTests(suffix) {
  const { createRingGroup, addRingGroupMember, deleteRingGroup, getRingGroupAnalytics } = require('../lib/ringGroups');
  const { orderMembersForStrategy } = require('../lib/ringGroupRouter');
  const { getPrisma } = require('../db');
  const prisma = await getPrisma();
  const tenant = await prisma.tenant.findFirst({ where: { isActive: true } });
  if (!tenant) {
    fail('Lib fallback tenant');
    return;
  }
  const libGroup = await createRingGroup(prisma, tenant.id, {
    name: `QA Lib ${suffix}`,
    ringStrategy: 'ROUND_ROBIN',
  });
  pass('Create ring group (lib)', libGroup.name);
  const ext = await prisma.extension.create({
    data: { tenantId: tenant.id, extensionNumber: `7${suffix}`, displayName: `RG ${suffix}` },
  });
  await addRingGroupMember(prisma, tenant.id, libGroup.id, { extensionId: ext.id });
  pass('Add ring group member (lib)');
  const analytics = await getRingGroupAnalytics(prisma, tenant.id, libGroup.id);
  if (typeof analytics.callsOffered === 'number') pass('Group analytics (lib)');
  else fail('Group analytics (lib)');
  const idleOrder = orderMembersForStrategy(
    [{ id: 'a', priority: 0, lastAnsweredAt: new Date('2026-01-01'), isActive: true }],
    'LONGEST_IDLE',
    0,
  );
  if (idleOrder[0]?.id === 'a') pass('Longest idle ordering');
  else fail('Longest idle ordering');
  const inbound = read('lib/inboundCallControl.js');
  if (inbound.includes('recordRingGroupOffered')) pass('Inbound routing hooks (static)');
  else fail('Inbound routing hooks');
  await deleteRingGroup(prisma, tenant.id, libGroup.id);
  await prisma.extension.delete({ where: { id: ext.id } });
  pass('Cleanup lib resources');
}

async function main() {
  console.log('\n=== Phase 5A Ring Groups Validation ===\n');

  const schema = read('prisma/schema.prisma');
  for (const check of [
    ['model RingGroup', /model RingGroup \{/],
    ['model RingGroupMember', /model RingGroupMember \{/],
    ['enum RingStrategy', /enum RingStrategy/],
    ['PhoneNumber.ringGroupId', /ringGroupId\s+String\?/],
  ]) {
    if (check[1].test(schema)) pass(`Schema: ${check[0]}`);
    else fail(`Schema: ${check[0]}`);
  }

  if (fileExists('prisma/migrations/20260622000000_phase5a_ring_groups/migration.sql')) {
    pass('Migration phase5a_ring_groups');
  } else {
    fail('Migration phase5a_ring_groups');
  }

  for (const f of [
    'lib/ringGroups.js',
    'lib/ringGroupRouter.js',
    'routes/ringGroups.js',
    'web/src/app/(app)/phone-system/ring-groups/page.tsx',
    'web/src/app/(app)/phone-system/ring-groups/new/page.tsx',
    'web/src/app/(app)/phone-system/ring-groups/[id]/page.tsx',
  ]) {
    if (fileExists(f)) pass(`File: ${f}`);
    else fail(`File: ${f}`);
  }

  const portal = read('routes/portal.js');
  if (portal.includes("require('./ringGroups')") && portal.includes('router.use(ringGroupRoutes)')) {
    pass('Portal mounts ring group routes');
  } else {
    fail('Portal mounts ring group routes');
  }

  const inbound = read('lib/inboundCallControl.js');
  if (inbound.includes('recordRingGroupOffered') && inbound.includes('dialAllTargetsSimultaneously')) {
    pass('Inbound Call Control ring group hooks + Phase 3B engines');
  } else {
    fail('Inbound Call Control integration');
  }

  const router = read('lib/ringGroupRouter.js');
  if (/LONGEST_IDLE/.test(router) && /ROUND_ROBIN/.test(router)) {
    pass('Ring strategies: longest idle + round robin ordering');
  } else {
    fail('Ring strategy router');
  }

  const api = read('web/src/lib/api.ts');
  if (api.includes('getRingGroups') && api.includes('createRingGroup')) {
    pass('Web API client ring group functions');
  } else {
    fail('Web API client');
  }

  try {
    const { getPrisma } = require('../db');
    const prisma = await getPrisma();
    for (const model of ['ringGroup', 'ringGroupMember']) {
      if (typeof prisma[model]?.findMany === 'function') pass(`Prisma client: ${model}`);
      else fail(`Prisma client: ${model} — run migrate + generate`);
    }
  } catch (err) {
    fail('Prisma client check', err.message);
  }

  const login = await http('POST', '/api/auth/login', {
    data: {
      email: process.env.SEED_ADMIN_EMAIL || 'admin@asuitech.com',
      password: process.env.SEED_ADMIN_PASSWORD || 'Admin@123',
    },
  });
  if (login.status !== 200 || !login.data?.accessToken) {
    fail('Admin login', `status ${login.status} — restart API (npm run dev:api)`);
    await runLibFallbackTests(Date.now().toString().slice(-4));
    summarize();
    process.exit(results.some((r) => r.ok === false) ? 1 : 0);
    return;
  }
  const auth = { headers: { Authorization: `Bearer ${login.data.accessToken}` } };
  pass('Admin login');

  const suffix = Date.now().toString().slice(-4);
  const createGroup = await http('POST', '/api/tenant/ring-groups', {
    ...auth,
    data: {
      name: `QA Group ${suffix}`,
      ringStrategy: 'ROUND_ROBIN',
      ringTimeoutSeconds: 25,
      voicemailEnabled: true,
      callRecordingEnabled: true,
    },
  });

  let groupId = createGroup.data?.ringGroup?.id;
  let extId;

  if (createGroup.status === 201 && groupId) {
    pass('Create ring group API', createGroup.data.ringGroup.name);
  } else if (createGroup.status === 404) {
    fail('Create ring group API', '404 — restart API (npm run dev:api) after backend changes');
    await runLibFallbackTests(suffix);
    summarize();
    process.exit(results.some((r) => r.ok === false) ? 1 : 0);
    return;
  } else {
    fail('Create ring group', `${createGroup.status} ${createGroup.data?.error || ''}`);
    summarize();
    process.exit(1);
  }

  const createExt = await http('POST', '/api/tenant/extensions', {
    ...auth,
    data: { extensionNumber: `9${suffix}`, displayName: `RG Member ${suffix}` },
  });
  extId = createExt.data?.extension?.id;
  if (createExt.status === 201 && extId) {
    pass('Create extension for member test');
    const addMember = await http('POST', `/api/tenant/ring-groups/${groupId}/members`, {
      ...auth,
      data: { extensionId: extId },
    });
    if (addMember.status === 201) pass('Add ring group member');
    else fail('Add ring group member', `${addMember.status}`);
  } else {
    fail('Create extension for member test', `${createExt.status}`);
  }

  for (const strategy of ['SIMULTANEOUS', 'SEQUENTIAL', 'LONGEST_IDLE']) {
    const patch = await http('PATCH', `/api/tenant/ring-groups/${groupId}`, {
      ...auth,
      data: { ringStrategy: strategy },
    });
    if (patch.status === 200) pass(`Strategy update: ${strategy}`);
    else fail(`Strategy update: ${strategy}`, `${patch.status}`);
  }

  const preview = await http('GET', `/api/tenant/ring-groups/${groupId}/routing-preview`, auth);
  if (preview.status === 200 && preview.data?.preview) {
    pass('Incoming routing preview', `${preview.data.preview.targetCount} target(s), engine=${preview.data.preview.strategy}`);
  } else {
    fail('Routing preview', `status ${preview.status}`);
  }

  const analytics = await http('GET', `/api/tenant/ring-groups/${groupId}/analytics`, auth);
  if (analytics.status === 200 && typeof analytics.data?.analytics?.callsOffered === 'number') {
    pass('Group analytics API');
  } else {
    fail('Group analytics API', `status ${analytics.status}`);
  }

  const vm = await http('GET', `/api/tenant/ring-groups/${groupId}/voicemails`, auth);
  if (vm.status === 200 && Array.isArray(vm.data?.voicemails)) {
    pass('Group voicemail API');
  } else {
    fail('Group voicemail API', `status ${vm.status}`);
  }

  const { orderMembersForStrategy } = require('../lib/ringGroupRouter');
  const members = [
    { id: 'a', priority: 0, lastAnsweredAt: new Date('2026-01-01'), isActive: true },
    { id: 'b', priority: 1, lastAnsweredAt: null, isActive: true },
  ];
  const idleOrder = orderMembersForStrategy(members, 'LONGEST_IDLE', 0);
  if (idleOrder[0]?.id === 'a') pass('Longest idle ordering');
  else fail('Longest idle ordering');

  const rrOrder = orderMembersForStrategy(
    [{ id: 'x', priority: 0, isActive: true }, { id: 'y', priority: 1, isActive: true }],
    'ROUND_ROBIN',
    1,
  );
  if (rrOrder[0]?.id === 'y') pass('Round robin ordering');
  else fail('Round robin ordering');

  const voicemailLib = read('lib/voicemail.js');
  if (voicemailLib.includes('ringGroupId')) pass('Voicemail fallback ringGroupId support');
  else fail('Voicemail ringGroupId');

  if (inbound.includes('callRecordingEnabled === false')) pass('Group recording toggle in Call Control');
  else fail('Group recording toggle');

  await http('DELETE', `/api/tenant/ring-groups/${groupId}`, auth);
  if (extId) await http('DELETE', `/api/tenant/extensions/${extId}`, auth);
  pass('Cleanup test resources');

  summarize();
  process.exit(results.some((r) => r.ok === false) ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
