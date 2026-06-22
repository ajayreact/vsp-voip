#!/usr/bin/env node
/**
 * DID ↔ Extension assignment validation — npm run validate:did-assignment
 */
require('dotenv').config();

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const API = process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
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

async function api(pathname, { method = 'GET', token, body } = {}) {
  const res = await fetch(`${API}${pathname}`, {
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
    json = { raw: text.slice(0, 200) };
  }
  return { status: res.status, json };
}

async function login() {
  const email = process.env.VALIDATE_EMAIL || process.env.TEST_ADMIN_EMAIL;
  const password = process.env.VALIDATE_PASSWORD || process.env.TEST_ADMIN_PASSWORD;
  if (!email || !password) return null;
  const res = await api('/api/auth/login', {
    method: 'POST',
    body: { email, password },
  });
  return res.json?.token || null;
}

async function main() {
  console.log('\n=== DID ↔ Extension Assignment Validation ===\n');

  const schema = read('prisma/schema.prisma');
  const relChecks = [
    ['PhoneNumber.extensionId → Extension', /extensionId\s+String\?\s*\n\s*extension\s+Extension\?\s+@relation\("ExtensionPhoneNumbers"/],
    ['Extension.primaryPhoneNumberId → PhoneNumber', /primaryPhoneNumberId String\?\s+@unique\s*\n\s*primaryPhoneNumber\s+PhoneNumber\?\s+@relation\("PrimaryExtensionNumber"/],
    ['Extension.phoneNumbers back-relation', /phoneNumbers\s+PhoneNumber\[\]\s+@relation\("ExtensionPhoneNumbers"\)/],
  ];
  for (const [name, re] of relChecks) {
    if (re.test(schema)) pass(`Schema: ${name}`);
    else fail(`Schema: ${name}`);
  }

  const ownership = read('lib/extensionOwnership.js');
  for (const fn of [
    'resolveExtensionPhoneNumbers',
    'listExtensionPhoneNumbersContext',
    'assignPhoneNumberToExtension',
    'unassignPhoneNumberFromExtension',
    'setPrimaryPhoneNumber',
  ]) {
    if (ownership.includes(`function ${fn}`) || ownership.includes(`async function ${fn}`)) {
      pass(`Lib: ${fn}`);
    } else {
      fail(`Lib: ${fn}`);
    }
  }

  const routes = read('routes/extensions.js');
  for (const route of [
    "router.get(\n  '/tenant/extensions/:id/phone-numbers'",
    "router.patch(\n  '/tenant/extensions/:id/primary-phone-number'",
  ]) {
    if (routes.includes(route.replace(/\n/g, '\r\n')) || routes.includes(route)) {
      pass(`Route: ${route.split("'")[1]}`);
    } else {
      fail(`Route: ${route.split("'")[1]}`);
    }
  }

  const inbound = read('lib/inboundRouting.js');
  if (inbound.includes('resolveDirectUserRingTargets') && inbound.includes('phoneRecord?.extensionId')) {
    pass('Inbound: extensionId → employee ring targets');
  } else {
    fail('Inbound: extensionId → employee ring targets');
  }

  const apiClient = read('web/src/lib/api.ts');
  for (const fn of [
    'getExtensionPhoneNumbers',
    'setExtensionPrimaryPhoneNumber',
  ]) {
    if (apiClient.includes(`export async function ${fn}`)) pass(`API client: ${fn}`);
    else fail(`API client: ${fn}`);
  }

  const panel = read('web/src/components/extension-ownership-panel.tsx');
  if (panel.includes('Primary DID') && panel.includes('setExtensionPrimaryPhoneNumber')) {
    pass('UI: Extension primary DID selector');
  } else {
    fail('UI: Extension primary DID selector');
  }
  if (!panel.includes('Additional DIDs') && !panel.includes('Assign another DID')) {
    pass('UI: multi-DID controls removed');
  } else {
    fail('UI: multi-DID controls removed');
  }

  const myNumbers = read('web/src/app/(app)/my-numbers/page.tsx');
  if (myNumbers.includes('extensionId') && myNumbers.includes('Assign to extension')) {
    pass('UI: My Numbers extension assignment');
  } else {
    fail('UI: My Numbers extension assignment');
  }

  const token = await login();
  if (!token) {
    fail('API login', 'Set VALIDATE_EMAIL and VALIDATE_PASSWORD (or TEST_ADMIN_*)');
  } else {
    pass('API login');

    const extRes = await api('/api/tenant/extensions', { token });
    if (extRes.status === 200 && extRes.json?.extensions) {
      pass('GET /tenant/extensions', `${extRes.json.extensions.length} extensions`);
      const withDid = extRes.json.extensions.filter((e) => e.assignedDidNumber);
      pass('Extensions list assignedDidNumber field', `${withDid.length} with DID`);

      const extensionId = extRes.json.extensions[0]?.id;
      if (extensionId) {
        const pnRes = await api(`/api/tenant/extensions/${extensionId}/phone-numbers`, { token });
        if (pnRes.status === 200 && ('primaryDid' in (pnRes.json || {}))) {
          pass('GET /tenant/extensions/:id/phone-numbers', pnRes.json?.primaryDid ? 'primary DID set' : 'no primary DID');
        } else {
          fail('GET /tenant/extensions/:id/phone-numbers', `status ${pnRes.status}`);
        }
      }
    } else {
      fail('GET /tenant/extensions', `status ${extRes.status}`);
    }

    const numbersRes = await api('/api/numbers/mine', { token });
    if (numbersRes.status === 200 && numbersRes.json?.extensions) {
      pass('GET /numbers/mine includes extensions', `${numbersRes.json.extensions.length} options`);
    } else {
      fail('GET /numbers/mine includes extensions', `status ${numbersRes.status}`);
    }
  }

  const passed = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok).length;
  console.log(`\n--- ${passed} passed, ${failed} failed ---\n`);
  process.exit(failed ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
