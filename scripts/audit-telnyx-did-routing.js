#!/usr/bin/env node
/**
 * Audit Telnyx DID → connection/application assignment (no DB required).
 * Usage: node scripts/audit-telnyx-did-routing.js [+13392401891 ...]
 */
require('dotenv').config();

const axios = require('axios');
const { normalizePhoneNumber } = require('../lib/phone');

const TELNYX_API_KEY = process.env.TELNYX_API_KEY?.trim();
const DEFAULT_NUMBERS = [
  '+13392401891',
  '+13136506292',
  '+13136505770',
  '+13136505581',
];

async function telnyxList(path) {
  const items = [];
  let page = 1;
  while (true) {
    const response = await axios.get(`https://api.telnyx.com/v2${path}`, {
      headers: {
        Authorization: `Bearer ${TELNYX_API_KEY}`,
        Accept: 'application/json',
      },
      params: { 'page[number]': page, 'page[size]': 250 },
      timeout: 20000,
    });
    const rows = response.data?.data || [];
    items.push(...rows);
    const totalPages = response.data?.meta?.total_pages ?? 1;
    if (page >= totalPages || !rows.length) break;
    page += 1;
  }
  return items;
}

function buildConnectionIndex({ callControlApps, texmlApps, credentialConns, sipConns }) {
  const index = new Map();
  for (const app of callControlApps) {
    index.set(app.id, {
      type: 'call_control',
      id: app.id,
      name: app.application_name || app.name || '(unnamed)',
      webhookUrl: app.webhook_event_url || null,
    });
  }
  for (const app of texmlApps) {
    index.set(app.id, {
      type: 'texml',
      id: app.id,
      name: app.application_name || app.name || '(unnamed)',
      webhookUrl: app.webhook_event_url || app.webhook_url || null,
    });
  }
  for (const conn of credentialConns) {
    index.set(conn.id, {
      type: 'credential_connection',
      id: conn.id,
      name: conn.connection_name || conn.name || '(unnamed)',
      webhookUrl: conn.webhook_event_url || null,
    });
  }
  for (const conn of sipConns) {
    index.set(conn.id, {
      type: 'sip_connection',
      id: conn.id,
      name: conn.connection_name || conn.name || '(unnamed)',
      webhookUrl: conn.webhook_event_url || null,
    });
  }
  return index;
}

async function lookupPhoneNumber(e164) {
  const response = await axios.get('https://api.telnyx.com/v2/phone_numbers', {
    headers: {
      Authorization: `Bearer ${TELNYX_API_KEY}`,
      Accept: 'application/json',
    },
    params: { 'filter[phone_number]': e164 },
    timeout: 15000,
  });
  return response.data?.data?.[0] ?? null;
}

async function main() {
  if (!TELNYX_API_KEY) {
    console.error('FAIL: TELNYX_API_KEY is not set');
    process.exit(1);
  }

  const numbers = (process.argv.slice(2).length ? process.argv.slice(2) : DEFAULT_NUMBERS)
    .map((n) => normalizePhoneNumber(n))
    .filter(Boolean);

  const expectedCallControlId = process.env.TELNYX_CALL_CONTROL_APP_ID?.trim() || null;
  const expectedCredentialId = process.env.TELNYX_CREDENTIAL_CONNECTION_ID?.trim() || null;
  const expectedTexmlId = process.env.TELNYX_CONNECTION_ID?.trim() || null;
  const apiPublic = process.env.API_PUBLIC_URL?.trim()?.replace(/\/$/, '') || null;

  console.log('=== VSP-PHONE Telnyx DID Routing Audit ===\n');
  console.log('VSP expected IDs (from .env):');
  console.log('  Call Control app:', expectedCallControlId || '(not configured)');
  console.log('  Credential connection (WebRTC):', expectedCredentialId || '(not configured)');
  console.log('  TeXML connection (legacy):', expectedTexmlId || '(not configured)');
  console.log('  Call Control webhook:', apiPublic ? `${apiPublic}/webhook/call-control` : '(API_PUBLIC_URL not set)');
  console.log('  TeXML webhook:', apiPublic ? `${apiPublic}/webhook` : '(API_PUBLIC_URL not set)');
  console.log('');

  const [callControlApps, texmlApps, credentialConns, sipConns] = await Promise.all([
    telnyxList('/call_control_applications').catch(() => []),
    telnyxList('/texml_applications').catch(() => []),
    telnyxList('/credential_connections').catch(() => []),
    telnyxList('/connections').catch(() => []),
  ]);

  const connIndex = buildConnectionIndex({
    callControlApps,
    texmlApps,
    credentialConns,
    sipConns,
  });

  console.log('Telnyx applications in account:');
  for (const app of callControlApps) {
    console.log(`  [Call Control] ${app.application_name} id=${app.id}`);
    console.log(`    webhook=${app.webhook_event_url || 'none'}`);
  }
  for (const app of texmlApps) {
    console.log(`  [TeXML] ${app.application_name || app.name} id=${app.id}`);
    console.log(`    webhook=${app.webhook_event_url || app.webhook_url || 'none'}`);
  }
  console.log('');

  const results = [];
  for (const number of numbers) {
    const phone = await lookupPhoneNumber(number);
    if (!phone) {
      results.push({ number, error: 'NOT_FOUND_IN_TELNYX' });
      continue;
    }

    const connectionId = phone.connection_id || null;
    const routing = connectionId ? connIndex.get(connectionId) : null;

    results.push({
      number,
      telnyxId: phone.id,
      connectionId,
      routingType: routing?.type || (connectionId ? 'unknown' : 'unassigned'),
      routingName: routing?.name || null,
      webhookUrl: routing?.webhookUrl || null,
      status: phone.status,
      expectedCallControl: connectionId === expectedCallControlId,
      onTexml: routing?.type === 'texml',
      onCallControl: routing?.type === 'call_control',
      onCredential: routing?.type === 'credential_connection',
      matchesEnvTexml: connectionId === expectedTexmlId,
    });
  }

  console.log('DID assignment results:\n');
  for (const row of results) {
    console.log(`Number: ${row.number}`);
    if (row.error) {
      console.log(`  ERROR: ${row.error}`);
      console.log('');
      continue;
    }
    console.log(`  Telnyx phone_number id: ${row.telnyxId}`);
    console.log(`  connection_id: ${row.connectionId || '(none)'}`);
    console.log(`  Resolved type: ${row.routingType}${row.routingName ? ` — "${row.routingName}"` : ''}`);
    console.log(`  Webhook URL: ${row.webhookUrl || '(none)'}`);
    console.log(`  On VSP Call Control app (${expectedCallControlId}): ${row.expectedCallControl ? 'YES' : 'NO'}`);
    if (row.onTexml) console.log('  >>> ON TeXML — inbound hits /webhook (TeXML), NOT Call Control bridge path');
    if (row.onCallControl) console.log('  >>> ON Call Control — inbound hits /webhook/call-control (correct for WebRTC bridge)');
    if (row.onCredential) console.log('  >>> ON Credential Connection — wrong for inbound PSTN DIDs');
    if (row.matchesEnvTexml) console.log('  >>> Matches TELNYX_CONNECTION_ID (TeXML legacy app)');
    console.log('');
  }

  console.log('=== Summary ===');
  console.log(`On Call Control (VSP app): ${results.filter((r) => r.expectedCallControl).length}/${results.length}`);
  console.log(`On TeXML: ${results.filter((r) => r.onTexml).length}/${results.length}`);
  console.log(`On Credential/SIP: ${results.filter((r) => r.onCredential || r.routingType === 'sip_connection').length}/${results.length}`);
  console.log(`Not found: ${results.filter((r) => r.error).length}/${results.length}`);

  const misassigned = results.filter((r) => !r.error && !r.expectedCallControl);
  if (misassigned.length) {
    console.log('\nACTION REQUIRED: Reassign these DIDs to Call Control app in Telnyx Portal');
    console.log('  Mission Control → Numbers → select number → Connection → VSP-Voice-App (Call Control)');
    console.log('Or run on server after git pull:');
    console.log('  docker compose exec api node scripts/audit-telnyx-did-routing.js');
    console.log('  docker compose restart api   # triggers syncPhoneNumbersToCallControlApp on startup');
  }
}

main().catch((err) => {
  console.error(err.response?.data || err.message || err);
  process.exit(1);
});
