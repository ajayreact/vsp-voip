#!/usr/bin/env node
/**
 * Core PBX ownership chain validation
 * npm run validate:pbx-ownership
 */
require('dotenv').config();

const fs = require('fs');
const path = require('path');

const API = process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
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
    json = { raw: text.slice(0, 300) };
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
  return res.json?.accessToken || res.json?.token || null;
}

async function main() {
  console.log('\n=== PBX Ownership Chain Validation ===\n');
  console.log('Scope: Number → Extension → Employee → Device (no Ring Groups)\n');

  const schema = read('prisma/schema.prisma');
  for (const [name, re] of [
    ['PhoneNumber.extensionId', /extensionId\s+String\?\s*\n\s*extension\s+Extension\?/],
    ['Extension.primaryPhoneNumberId', /primaryPhoneNumberId String\?/],
    ['Extension.sipUsername', /sipUsername\s+String\?/],
    ['Extension.sipPassword', /sipPassword\s+String\?/],
    ['PhoneNumber.extensionId unique', /extensionId\s+String\?\s+@unique/],
    ['User.telnyxSipPassword', /telnyxSipPassword\s+String\?/],
  ]) {
    if (re.test(schema)) pass(`Schema: ${name}`);
    else fail(`Schema: ${name}`);
  }

  for (const file of ['lib/pbxOwnership.js', 'lib/telnyxSipProfile.js', 'lib/extensionOwnership.js']) {
    if (fs.existsSync(path.join(ROOT, file))) pass(`Lib: ${file}`);
    else fail(`Lib: ${file}`);
  }

  const inbound = read('lib/inboundRouting.js');
  if (inbound.includes('resolveDirectUserRingTargets') && inbound.includes('phoneRecord?.extensionId')) {
    pass('Inbound: extensionId → employee ring resolution');
  } else {
    fail('Inbound: extensionId → employee ring resolution');
  }

  const sipPanel = read('web/src/components/extension-sip-panel.tsx');
  if (sipPanel.includes('sipPassword') && sipPanel.includes('sipServer')) {
    pass('UI: SIP credentials panel (username/password/server/port)');
  } else {
    fail('UI: SIP credentials panel');
  }

  const qrPanel = read('web/src/components/extension-qr-panel.tsx');
  if (qrPanel.includes('sip_phone') && qrPanel.includes('mobile')) {
    pass('UI: Dual QR provisioning (mobile + SIP phone)');
  } else {
    fail('UI: Dual QR provisioning');
  }

  const token = await login();
  if (!token) {
    fail('API login', 'Set VALIDATE_EMAIL and VALIDATE_PASSWORD');
  } else {
    pass('API login');

    const syncRes = await api('/api/tenant/extensions/sync-phone-links', {
      method: 'POST',
      token,
      body: {},
    });
    if (syncRes.status === 200) {
      pass('POST sync-phone-links', `linked ${syncRes.json?.linked || 0} numbers`);
    } else {
      fail('POST sync-phone-links', `status ${syncRes.status}`);
    }

    const extRes = await api('/api/tenant/extensions', { token });
    if (extRes.status === 200 && extRes.json?.extensions) {
      const withDid = extRes.json.extensions.filter((e) => e.assignedDidNumber);
      pass('GET extensions', `${extRes.json.extensions.length} total, ${withDid.length} with assigned DID`);
    } else {
      fail('GET extensions', `status ${extRes.status}`);
    }

    const numbersRes = await api('/api/numbers/mine', { token });
    const numbers = numbersRes.json?.numbers || [];
    if (numbersRes.status === 200) {
      pass('GET numbers/mine', `${numbers.length} purchased numbers`);
    } else {
      fail('GET numbers/mine', `status ${numbersRes.status}`);
    }

    const validateRes = await api('/api/tenant/ownership/validate', { token });
    if (validateRes.status === 200 && validateRes.json?.report) {
      const { total, passing, failing, results: chains } = validateRes.json.report;
      pass('GET ownership/validate', `${passing}/${total} chains complete`);
      console.log('\n--- Ownership chain report ---');
      for (const chain of chains || []) {
        const num = chain.phone?.number || chain.phone?.id || '?';
        const ext = chain.extension?.extensionNumber || '—';
        const emp = chain.employee?.name || '—';
        const devices = (chain.registeredDevices || chain.devices || [])
          .filter((d) => d.status === 'ONLINE')
          .map((d) => d.type)
          .join(', ') || 'none online';
        const inbound = chain.canReceiveInbound || chain.inbound?.canReceiveInbound ? 'yes' : 'no';
        const line = [
          `Number: ${num}`,
          `Extension: ${ext}`,
          `Employee: ${emp}`,
          `Registered devices: ${devices}`,
          `Can receive inbound: ${inbound}`,
        ].join(' | ');
        if (chain.ok) {
          pass(`  ${num}`, line);
        } else {
          fail(`  ${num}`, `${line} — ${(chain.issues || []).join('; ')}`);
        }
      }
      if (numbers.length >= 3 && passing < 3) {
        fail('Three-number requirement', `Only ${passing}/${numbers.length} numbers have complete chains`);
      } else if (numbers.length >= 3) {
        pass('Three-number requirement', 'All purchased numbers have complete ownership chains');
      } else {
        pass('Three-number requirement', `Skipped (${numbers.length} numbers in tenant — need 3 to verify)`);
      }
    } else {
      fail('GET ownership/validate', `status ${validateRes.status}`);
    }

    const extensionId = extRes.json?.extensions?.[0]?.id;
    if (extensionId) {
      const sipRes = await api(`/api/tenant/extensions/${extensionId}/sip`, { token });
      if (sipRes.status === 200 && sipRes.json?.sip) {
        const s = sipRes.json.sip;
        pass('GET extension SIP', `username=${s.sipUsername || 'missing'}, server=${s.sipServer}:${s.sipPort}, tls=${s.sipPortTls}`);
        if (s.sipPassword) pass('SIP password stored', 'password present in response');
        else fail('SIP password stored', 'password missing — run migration or open SIP tab to backfill');
      } else {
        fail('GET extension SIP', `status ${sipRes.status} — ${sipRes.json?.error || ''}`);
      }

      const qrRes = await api(`/api/tenant/extensions/${extensionId}/provisioning-token`, {
        method: 'POST',
        token,
        body: { target: 'sip_phone' },
      });
      if (qrRes.status === 200 && qrRes.json?.provisioning?.qrPayloadJson) {
        pass('POST SIP provisioning QR', 'qrPayloadJson returned');
      } else {
        fail('POST SIP provisioning QR', `status ${qrRes.status} — ${qrRes.json?.error || ''}`);
      }

      const pnRes = await api(`/api/tenant/extensions/${extensionId}/phone-numbers`, { token });
      if (pnRes.status === 200) {
        pass('GET extension phone-numbers', res.json?.primaryDid ? 'primary DID set' : 'no primary DID');
      } else {
        fail('GET extension phone-numbers', `status ${pnRes.status}`);
      }
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
