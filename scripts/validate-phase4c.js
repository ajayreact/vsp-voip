#!/usr/bin/env node
/** Phase 4C — npm run validate:phase4c */
require('dotenv').config();

const axios = require('axios');
const fs = require('fs');
const path = require('path');

const BASE = process.env.API_BASE || 'http://localhost:3000';
const ROOT = path.join(__dirname, '..');
const results = [];

function pass(n, d = '') { results.push(true); console.log(`✅ ${n}${d ? ` — ${d}` : ''}`); }
function fail(n, d = '') { results.push(false); console.log(`❌ ${n}${d ? ` — ${d}` : ''}`); }

async function http(method, urlPath, opts = {}) {
  return axios({ method, url: `${BASE}${urlPath}`, validateStatus: () => true, ...opts });
}

async function main() {
  console.log('\n=== Phase 4C Enterprise Security Validation ===\n');

  const schema = fs.readFileSync(path.join(ROOT, 'prisma/schema.prisma'), 'utf8');
  if (/model ExtensionAuditLog/.test(schema)) pass('Schema: ExtensionAuditLog');
  else fail('Schema: ExtensionAuditLog');
  if (/recordingPolicy/.test(schema)) pass('Schema: recordingPolicy');
  else fail('Schema: recordingPolicy');

  for (const f of ['lib/extensionSecurity.js', 'web/src/components/extension-security-panel.tsx']) {
    if (fs.existsSync(path.join(ROOT, f))) pass(`File: ${f}`);
    else fail(`File: ${f}`);
  }

  const login = await http('POST', '/api/auth/login', {
    data: {
      email: process.env.SEED_ADMIN_EMAIL || 'admin@asuitech.com',
      password: process.env.SEED_ADMIN_PASSWORD || 'Admin@123',
    },
  });
  if (login.status !== 200) { fail('Login', `${login.status}`); process.exit(1); }
  const auth = { headers: { Authorization: `Bearer ${login.data.accessToken}` } };
  pass('Admin login');

  const suffix = Date.now().toString().slice(-4);
  const create = await http('POST', '/api/tenant/extensions', {
    ...auth,
    data: { extensionNumber: `7${suffix}`, displayName: `Sec ${suffix}` },
  });
  const extId = create.data?.extension?.id;
  if (!extId) { fail('Create extension'); process.exit(1); }
  pass('Create test extension');

  const sec = await http('PATCH', `/api/tenant/extensions/${extId}/security`, {
    ...auth,
    data: {
      whitelist: { numbers: ['+15551234567'], prefixes: ['+1555'], allowInternalExtensions: true },
      blacklist: { numbers: ['+15559999999'], patterns: ['*900*'], blockAnonymous: true, blockSpamPatterns: true },
      callerId: { outboundNumber: '+15551234000', hideCallerId: false, displayName: 'Acme Sales' },
      callingPermissions: { local: true, national: true, international: false, premium: false, emergency: true },
      timeRestrictions: { enabled: true, afterHoursAction: 'BLOCK' },
      recordingPolicy: 'INBOUND_ONLY',
    },
  });
  if (sec.status === 200 && sec.data?.security?.whitelist?.numbers?.length) {
    pass('Security PATCH', 'whitelist configured');
  } else fail('Security PATCH', `${sec.status}`);

  const audit = await http('GET', `/api/tenant/extensions/${extId}/audit-logs`, auth);
  if (audit.status === 200 && audit.data?.logs?.length > 0) pass('Audit logs', `${audit.data.logs.length} entries`);
  else fail('Audit logs', `status ${audit.status}`);

  const tenantAudit = await http('GET', '/api/tenant/extensions/security/audit', auth);
  if (tenantAudit.status === 200) pass('Tenant security audit API');
  else fail('Tenant security audit API', `${tenantAudit.status}`);

  const { evaluateInboundSecurity } = require('../lib/extensionSecurity');
  const blocked = evaluateInboundSecurity(
    {
      whitelist: { numbers: ['+15551111111'], prefixes: [], allowInternalExtensions: false },
      blacklist: { numbers: [], patterns: [], blockAnonymous: false, blockSpamPatterns: false },
      blockAnonymous: false,
      spamPatternBlockEnabled: false,
      timeRestrictionsEnabled: false,
    },
    '+15552222222',
  );
  if (!blocked.allowed) pass('Inbound security block', blocked.reason);
  else fail('Inbound security block');

  await http('DELETE', `/api/tenant/extensions/${extId}`, auth);

  const passed = results.filter(Boolean).length;
  const failed = results.length - passed;
  console.log(`\n--- ${passed} passed, ${failed} failed ---\n`);
  process.exit(failed ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
