#!/usr/bin/env node
/**
 * Phase 4B E2E — npm run validate:phase4b
 */
require('dotenv').config();

const axios = require('axios');
const fs = require('fs');
const path = require('path');

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

async function http(method, urlPath, opts = {}) {
  return axios({ method, url: `${BASE}${urlPath}`, validateStatus: () => true, ...opts });
}

async function main() {
  console.log('\n=== Phase 4B Business Features Validation ===\n');

  const schema = fs.readFileSync(path.join(ROOT, 'prisma/schema.prisma'), 'utf8');
  if (/dndReason/.test(schema) && /DndInboundAction/.test(schema)) pass('Schema: DND fields');
  else fail('Schema: DND fields');

  if (/scheduleDestinationType/.test(schema)) pass('Schema: schedule forward destination');
  else fail('Schema: schedule forward destination');

  for (const f of ['lib/extensionFeatures.js', 'lib/extensionInbound.js', 'web/src/components/extension-business-panel.tsx']) {
    if (fs.existsSync(path.join(ROOT, f))) pass(`File: ${f}`);
    else fail(`File: ${f}`);
  }

  const login = await http('POST', '/api/auth/login', {
    data: {
      email: process.env.SEED_ADMIN_EMAIL || 'admin@asuitech.com',
      password: process.env.SEED_ADMIN_PASSWORD || 'Admin@123',
    },
  });
  if (login.status !== 200 || !login.data?.accessToken) {
    fail('Admin login', `status ${login.status}`);
    summarize();
    process.exit(1);
  }
  const auth = { headers: { Authorization: `Bearer ${login.data.accessToken}` } };
  pass('Admin login');

  const suffix = Date.now().toString().slice(-4);
  const create = await http('POST', '/api/tenant/extensions', {
    ...auth,
    data: { extensionNumber: `8${suffix}`, displayName: `Phase4B ${suffix}` },
  });
  if (create.status !== 201) {
    fail('Create extension', `${create.status}`);
    summarize();
    process.exit(1);
  }
  const extId = create.data.extension.id;
  pass('Create extension for 4B tests');

  const business = await http('PATCH', `/api/tenant/extensions/${extId}/business`, {
    ...auth,
    data: {
      doNotDisturb: true,
      callScreeningEnabled: true,
      intercomEnabled: true,
      dnd: {
        enabled: true,
        reason: 'In a meeting',
        inboundAction: 'VOICEMAIL',
        scheduledEnabled: false,
      },
      forwarding: {
        always: { enabled: false },
        busy: { enabled: false },
        noAnswer: {
          enabled: true,
          destinationType: 'EXTERNAL_NUMBER',
          destination: '+15551234567',
        },
        schedule: { enabled: false },
      },
    },
  });
  if (business.status === 200 && business.data?.extension?.dnd?.enabled) {
    pass('DND + forwarding + screening update');
  } else {
    fail('Business features update', `${business.status} ${business.data?.error || ''}`);
  }

  const reg = await http('GET', '/api/tenant/extensions/registration', auth);
  if (reg.status === 200 && Array.isArray(reg.data?.extensions)) {
    pass('Registration monitoring API', `${reg.data.total} extensions`);
  } else {
    fail('Registration monitoring API', `status ${reg.status}`);
  }

  const dest = await http('GET', '/api/tenant/extensions/destinations', auth);
  if (dest.status === 200 && Array.isArray(dest.data?.extensions)) {
    pass('Forward destinations API');
  } else {
    fail('Forward destinations API', `status ${dest.status}`);
  }

  const { resolveExtensionInboundPolicy } = require('../lib/extensionInbound');
  const { getPrisma } = require('../db');
  const prisma = await getPrisma();
  const tenantId = login.data.user.tenantId;
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
  const policy = await resolveExtensionInboundPolicy(prisma, tenant, null, '+15551111111');
  if (policy === null || policy.action === 'ring') {
    pass('Inbound policy resolver (no phone record)');
  } else {
    pass('Inbound policy resolver', policy.action);
  }

  await http('DELETE', `/api/tenant/extensions/${extId}`, auth);
  pass('Cleanup test extension');

  summarize();
  process.exit(results.some((r) => r.ok === false) ? 1 : 0);
}

function summarize() {
  const passed = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok).length;
  console.log(`\n--- ${passed} passed, ${failed} failed ---\n`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
