#!/usr/bin/env node
/**
 * Production runtime proof for inbound routing on +13099880196
 * Usage: node scripts/runtime-inbound-proof.js
 */
const API = process.env.API_URL || 'https://api.vspphone.com';
const EMAIL = process.env.EMAIL || 'admin@asuitech.com';
const PASSWORD = process.env.PASSWORD || 'Admin@123';
const TARGET = '+13099880196';

async function json(method, path, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${API}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text.slice(0, 500) };
  }
  return { status: res.status, data };
}

async function main() {
  console.log('=== VSP Production Runtime Inbound Proof ===');
  console.log(`API: ${API}`);
  console.log(`Time: ${new Date().toISOString()}\n`);

  // 1. Health
  const health = await json('GET', '/health');
  console.log('--- /health ---');
  console.log(JSON.stringify(health, null, 2));

  const ready = await json('GET', '/ready');
  console.log('\n--- /ready ---');
  console.log(JSON.stringify(ready, null, 2));

  // 2. Login
  const login = await json('POST', '/api/auth/login', { email: EMAIL, password: PASSWORD });
  console.log('\n--- POST /api/auth/login ---');
  if (login.status !== 200) {
    console.log(JSON.stringify(login, null, 2));
    process.exit(1);
  }
  const token = login.data.accessToken || login.data.token;
  if (!token) {
    console.log('login response keys:', Object.keys(login.data));
    process.exit(1);
  }
  const user = login.data.user || {};
  console.log('user.id:', user.id);
  console.log('user.email:', user.email);
  console.log('user.tenantId:', user.tenantId);

  // 3. Softphone config (includes telnyxSipUsername)
  const config = await json('GET', '/api/softphone/config', null, token);
  console.log('\n--- GET /api/softphone/config ---');
  if (config.status === 200) {
    console.log('telnyxSipUsername:', config.data?.telnyxSipUsername || config.data?.user?.telnyxSipUsername);
    console.log('credentialConnectionId:', config.data?.credentialConnectionId);
  } else {
    console.log(JSON.stringify(config, null, 2));
  }

  // 4. Full diagnostics
  const diag = await json('GET', '/api/softphone/diagnostics', null, token);
  console.log('\n--- GET /api/softphone/diagnostics ---');
  if (diag.status !== 200) {
    console.log(JSON.stringify(diag, null, 2));
    process.exit(1);
  }

  const inbound = diag.data.inboundRouting || {};
  const numberRow = (inbound.numberTargets || []).find((n) => n.number === TARGET);

  console.log('\n=== TRACE: inbound call to', TARGET, '===');
  if (!numberRow) {
    console.log('ERROR: DID not found in numberTargets');
    console.log('Available numbers:', (inbound.numberTargets || []).map((n) => n.number));
  } else {
    console.log('phoneRecord (from diagnostics):');
    console.log(JSON.stringify({
      number: numberRow.number,
      routingType: numberRow.routingType,
      extensionId: numberRow.extensionNumber ? '(ext ' + numberRow.extensionNumber + ')' : null,
      extensionUserId: numberRow.extensionUserId,
      assignedUserId: numberRow.assignedUserId,
      effectiveUserId: numberRow.effectiveUserId,
    }, null, 2));
    console.log('\nroutingType:', numberRow.routingType);
    console.log('assignedUserId:', numberRow.assignedUserId);
    console.log('effectiveUserId:', numberRow.effectiveUserId);
    console.log('user.telnyxSipUsername (logged-in user):', inbound.sipUsername);
    console.log('webrtcDialUri:', inbound.webrtcDialUri);
    console.log('\nappTargets:', JSON.stringify(numberRow.appTargets, null, 2));
    console.log('\nfinalTargets:', JSON.stringify(numberRow.finalTargets, null, 2));
    console.log('\ntargetCount:', numberRow.targetCount, 'appTargetCount:', numberRow.appTargetCount);
    console.log('userTargeted:', numberRow.userTargeted);
    console.log('userHasSipUsername:', numberRow.userHasSipUsername);

    if (numberRow.targetCount === 0) {
      console.log('\n>>> REASON finalTargets empty: resolveRingTargets returned 0 targets on production DB');
      console.log('>>> Would log: "Routing to voicemail: no ring targets configured"');
    } else {
      const dial = numberRow.appTargets?.[0]?.dial || numberRow.finalTargets?.[0]?.dial;
      console.log('\n>>> finalTargets NOT empty — Telnyx would dial:');
      console.log('    Call Control dial app:', dial);
      console.log('    SIP URI:', dial?.replace(/^sip:/, '') || inbound.webrtcDialUri);
    }
  }

  console.log('\n--- inboundRouting summary ---');
  console.log('inboundReady:', inbound.ready);
  console.log('callControlReady:', inbound.callControlReady);
  console.log('hasRoutingPath:', inbound.hasRoutingPath);
  console.log('sipProvisioned:', inbound.sipProvisioned);
  console.log('message:', inbound.message);

  console.log('\n--- callControlApplication ---');
  console.log(JSON.stringify(diag.data.callControlApplication, null, 2));

  console.log('\n--- push ---');
  console.log(JSON.stringify(diag.data.push, null, 2));

  // 5. Web bundle API URL check
  console.log('\n--- Production web softphone bundle ---');
  try {
    const webRes = await fetch('https://app.vspphone.com/login');
    const html = await webRes.text();
    const scripts = [...html.matchAll(/src="(\/_next\/static\/[^"]+\.js)"/g)].map((m) => m[1]);
    let foundLocalhost = false;
    let foundProd = false;
    for (const script of scripts.slice(0, 8)) {
      const js = await fetch(`https://app.vspphone.com${script}`).then((r) => r.text());
      if (js.includes('localhost:3000')) foundLocalhost = true;
      if (js.includes('api.vspphone.com')) foundProd = true;
    }
    console.log('login page scripts scanned:', scripts.length);
    console.log('any chunk contains localhost:3000:', foundLocalhost);
    console.log('any chunk contains api.vspphone.com:', foundProd);
  } catch (e) {
    console.log('web check failed:', e.message);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
