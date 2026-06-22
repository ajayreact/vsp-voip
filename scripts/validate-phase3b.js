#!/usr/bin/env node
/**
 * Phase 3B inbound calling validation — npm run validate:phase3b
 */
require('dotenv').config();

const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { normalizeRingStrategy } = require('../lib/ringGroup');
const { resolveRingTargets, requiresCallControlRouting } = require('../lib/inboundRouting');
const {
  isSimultaneousStrategy,
  getOutboundLegs,
  markOutboundLeg,
  markOutboundLegByIndex,
  anyOutboundLegAnswered,
  allOutboundLegsSettled,
  hasConnectedLeg,
  findOutboundLeg,
} = require('../lib/inboundCallControl');
const { getCallControlSetupStatus, getCallControlApplicationId } = require('../lib/telnyxCallControlSetup');
const { getCredentialConnectionId } = require('../lib/telnyxConfig');
const { loadPlatformSettings } = require('../lib/platformSettings');
const {
  claimConnectedLeg,
  claimAnswerSideEffects,
  getClaimedWinner,
  __resetMemoryClaimStateForTests,
} = require('../lib/callControlSessionStore');
const { getPrisma } = require('../db');

const PRODUCTION_ANDROID_PACKAGE = 'com.vspvoip.mobile';
const PRODUCTION_IOS_BUNDLE = 'com.vspvoip.mobile';
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

async function testSimultaneousRingHelpers() {
  console.log('\n=== Simultaneous ring logic ===');

  const session = { ringStrategy: 'simultaneous' };
  if (isSimultaneousStrategy(session)) pass('isSimultaneousStrategy detects simultaneous');
  else fail('isSimultaneousStrategy detects simultaneous');

  if (!isSimultaneousStrategy({ ringStrategy: 'sequential' })) {
    pass('isSimultaneousStrategy ignores sequential');
  } else fail('isSimultaneousStrategy ignores sequential');

  if (normalizeRingStrategy('simultaneous') === 'simultaneous') {
    pass('normalizeRingStrategy simultaneous');
  } else fail('normalizeRingStrategy simultaneous');

  session.outboundLegs = [
    { callControlId: 'leg-a', targetIndex: 0, status: 'ringing' },
    { callControlId: 'leg-b', targetIndex: 1, status: 'ringing' },
    { callControlId: null, targetIndex: 2, status: 'failed' },
  ];
  session.connectedLeg = 'leg-a';
  markOutboundLeg(session, 'leg-a', 'answered');
  if (hasConnectedLeg(session)) pass('hasConnectedLeg when winner selected');
  else fail('hasConnectedLeg when winner selected');

  if (findOutboundLeg(session, 'leg-b')?.callControlId === 'leg-b') {
    pass('findOutboundLeg resolves leg by callControlId');
  } else fail('findOutboundLeg resolves leg by callControlId');

  markOutboundLeg(session, 'leg-b', 'cancelled');
  if (allOutboundLegsSettled(session)) pass('allOutboundLegsSettled includes failed legs');
  else fail('allOutboundLegsSettled includes failed legs');

  markOutboundLegByIndex(session, 99, 'failed');
  if (getOutboundLegs(session).some((leg) => leg.targetIndex === 99)) {
    pass('markOutboundLegByIndex tracks dial failures');
  } else fail('markOutboundLegByIndex tracks dial failures');

  const legacy = { outboundLegCallControlId: 'legacy-leg', ringIndex: 0 };
  const legs = getOutboundLegs(legacy);
  if (legs.length === 1 && legs[0].callControlId === 'legacy-leg') {
    pass('getOutboundLegs legacy single-leg compat');
  } else fail('getOutboundLegs legacy single-leg compat');
}

async function testAtomicClaimHelpers() {
  console.log('\n=== Atomic claim helpers (RC-1 / RC-2) ===');
  __resetMemoryClaimStateForTests();

  const won = await claimConnectedLeg('audit-inbound', 'audit-leg-1');
  if (won.claimed) pass('claimConnectedLeg grants first winner');
  else fail('claimConnectedLeg grants first winner');

  const lost = await claimConnectedLeg('audit-inbound', 'audit-leg-2');
  if (!lost.claimed && lost.lostRace) pass('claimConnectedLeg rejects second winner');
  else fail('claimConnectedLeg rejects second winner');

  const fx = await claimAnswerSideEffects('audit-inbound', 'audit-leg-1');
  const fx2 = await claimAnswerSideEffects('audit-inbound', 'audit-leg-1');
  if (fx.claimed && !fx2.claimed) pass('claimAnswerSideEffects is idempotent');
  else fail('claimAnswerSideEffects is idempotent');

  const winner = await getClaimedWinner('audit-inbound');
  if (winner === 'audit-leg-1') pass('getClaimedWinner persisted');
  else fail('getClaimedWinner persisted', winner);
}

async function testEnvironment() {
  console.log('\n=== Environment ===');

  const apiPublic = process.env.API_PUBLIC_URL?.trim();
  if (apiPublic && /^https:\/\//i.test(apiPublic)) {
    pass('API_PUBLIC_URL set (HTTPS)', apiPublic);
  } else if (apiPublic) {
    warn('API_PUBLIC_URL not HTTPS', apiPublic);
  } else {
    fail('API_PUBLIC_URL missing', 'Telnyx cannot deliver Call Control webhooks');
  }

  const telnyxKey = process.env.TELNYX_API_KEY?.trim();
  if (telnyxKey) pass('TELNYX_API_KEY configured');
  else fail('TELNYX_API_KEY missing');

  const callControlAppId = process.env.TELNYX_CALL_CONTROL_APP_ID?.trim();
  if (callControlAppId) pass('TELNYX_CALL_CONTROL_APP_ID configured', callControlAppId);
  else warn('TELNYX_CALL_CONTROL_APP_ID missing', 'Set in .env or Admin → Platform settings');

  const credentialConn = process.env.TELNYX_CREDENTIAL_CONNECTION_ID?.trim();
  if (credentialConn) pass('TELNYX_CREDENTIAL_CONNECTION_ID configured', credentialConn);
  else warn('TELNYX_CREDENTIAL_CONNECTION_ID missing', 'Required for WebRTC / mobile push login');
}

async function testWebhookReachability() {
  console.log('\n=== Webhook reachability ===');

  const base = process.env.API_PUBLIC_URL?.trim()?.replace(/\/$/, '');
  if (!base) {
    warn('Webhook reachability skipped', 'API_PUBLIC_URL not set');
    return;
  }

  const urls = [
    `${base}/webhook/call-control`,
    `${base}/health`,
  ];

  for (const url of urls) {
    try {
      const response = await axios.post(url, {}, {
        validateStatus: () => true,
        timeout: 12000,
      });
      if (response.status < 500) {
        pass(`Webhook endpoint reachable`, `${url} → ${response.status}`);
      } else {
        fail(`Webhook endpoint reachable`, `${url} → ${response.status}`);
      }
    } catch (error) {
      fail(`Webhook endpoint reachable`, `${url} — ${error.message}`);
    }
  }
}

async function testCallControlSetup(prisma) {
  console.log('\n=== Call Control setup ===');

  const platform = await loadPlatformSettings(prisma);
  const setup = await getCallControlSetupStatus(prisma);
  const applicationId = getCallControlApplicationId(platform) || setup.applicationId;

  if (applicationId) pass('Call Control application ID resolved', applicationId);
  else fail('Call Control application ID resolved');

  if (setup.webhooksReachable) pass('Call Control webhooksReachable flag');
  else fail('Call Control webhooksReachable flag', setup.message);

  if (setup.applicationWebhookConfigured) {
    pass('Call Control webhook URL matches API_PUBLIC_URL', setup.callControlWebhookUrl);
  } else {
    warn('Call Control webhook URL mismatch', setup.message);
  }
}

async function testNumberCallControlAssignment(prisma) {
  console.log('\n=== Purchased number Call Control assignment ===');

  if (!process.env.TELNYX_API_KEY?.trim()) {
    warn('Number assignment check skipped', 'TELNYX_API_KEY not set');
    return;
  }

  const platform = await loadPlatformSettings(prisma);
  const applicationId = getCallControlApplicationId(platform);
  if (!applicationId) {
    warn('Number assignment check skipped', 'No Call Control app ID');
    return;
  }

  const numbers = await prisma.phoneNumber.findMany({
    where: { isActive: { not: false } },
    select: { number: true, tenantId: true },
    take: 50,
  });

  if (!numbers.length) {
    warn('No active phone numbers in database');
    return;
  }

  let onCallControl = 0;
  let needsAppRouting = 0;
  let misassigned = 0;

  for (const row of numbers) {
    try {
      const response = await axios.get('https://api.telnyx.com/v2/phone_numbers', {
        headers: {
          Authorization: `Bearer ${process.env.TELNYX_API_KEY.trim()}`,
          Accept: 'application/json',
        },
        params: { 'filter[phone_number]': row.number },
        timeout: 15000,
      });
      const telnyxPhone = response.data?.data?.[0];
      if (!telnyxPhone) {
        warn(`Telnyx number lookup`, `${row.number} not found in Telnyx account`);
        continue;
      }

      const greeting = row.tenantId
        ? await prisma.greeting.findUnique({ where: { tenantId: row.tenantId } })
        : null;
      const phoneRecord = await prisma.phoneNumber.findUnique({
        where: { number: row.number },
        select: { routingType: true, assignedUserId: true },
      });

      const appRouting = requiresCallControlRouting(greeting || {}, phoneRecord);
      if (appRouting) needsAppRouting += 1;

      if (telnyxPhone.connection_id === applicationId) {
        onCallControl += 1;
      } else if (appRouting) {
        misassigned += 1;
        fail(`App-routing number on wrong connection`, `${row.number} → ${telnyxPhone.connection_id || 'none'}`);
      }
    } catch (error) {
      warn(`Telnyx lookup ${row.number}`, error.message);
    }
  }

  pass('Active numbers checked', `${numbers.length} in DB`);
  if (misassigned === 0) {
    pass('App-routing numbers on Call Control', `${onCallControl} on app, ${needsAppRouting} need app routing`);
  }
}

async function testRingTargetResolution(prisma) {
  console.log('\n=== Ring target resolution ===');

  const platform = await loadPlatformSettings(prisma);
  const credentialConnectionId = getCredentialConnectionId(platform);

  const tenantsWithGreeting = await prisma.greeting.findMany({
    where: { ringGroupEnabled: true },
    take: 5,
    include: { tenant: true },
  });

  if (!tenantsWithGreeting.length) {
    warn('Ring target resolution', 'No ring groups configured — create one in Admin to test');
    return;
  }

  for (const greeting of tenantsWithGreeting) {
    const phone = await prisma.phoneNumber.findFirst({
      where: { tenantId: greeting.tenantId, isActive: { not: false } },
    });
    const resolved = await resolveRingTargets(
      prisma,
      greeting.tenantId,
      greeting,
      phone,
      credentialConnectionId,
    );
    if (resolved.targets.length) {
      pass(
        `Ring targets for tenant ${greeting.tenant?.name || greeting.tenantId}`,
        `${resolved.targets.length} target(s), strategy=${resolved.strategy}`,
      );
    } else {
      warn(
        `Ring targets for tenant ${greeting.tenant?.name || greeting.tenantId}`,
        'Ring group enabled but no dial targets resolved',
      );
    }
  }
}

async function testPushConfiguration(prisma) {
  console.log('\n=== Push configuration ===');

  if (!prisma) {
    warn('Push DB checks skipped', 'Database unavailable');
  } else {
    const platform = await loadPlatformSettings(prisma);
    const credentialConnectionId = getCredentialConnectionId(platform);
    if (credentialConnectionId) {
      pass('WebRTC credential connection ID', credentialConnectionId);
    } else {
      fail('WebRTC credential connection ID missing');
    }

    const usersWithPush = await prisma.user.count({
      where: { pushDeviceToken: { not: null } },
    });
    if (usersWithPush > 0) {
      pass('Users with registered push tokens', String(usersWithPush));
    } else {
      warn('No push tokens in database', 'Log in on mobile with Firebase/iOS configured');
    }
  }

  const googleServicesPath = path.join(__dirname, '..', 'mobile', 'android', 'app', 'google-services.json');
  if (fs.existsSync(googleServicesPath)) {
    pass('google-services.json present');
    try {
      const json = JSON.parse(fs.readFileSync(googleServicesPath, 'utf8'));
      const packageName = json?.client?.[0]?.client_info?.android_client_info?.package_name;
      if (packageName === PRODUCTION_ANDROID_PACKAGE) {
        pass('FCM package matches production applicationId', packageName);
      } else {
        fail('FCM package matches production applicationId', `got ${packageName}, expected ${PRODUCTION_ANDROID_PACKAGE}`);
      }
    } catch (error) {
      fail('google-services.json parse', error.message);
    }
  } else {
    fail('google-services.json missing', 'Required for Android background push');
  }

  const entitlementsPath = path.join(__dirname, '..', 'mobile', 'ios', 'Runner', 'Runner.entitlements');
  if (fs.existsSync(entitlementsPath)) {
    pass('iOS Runner.entitlements present');
  } else {
    fail('iOS Runner.entitlements missing');
  }
}

async function testMobileProductionSetup() {
  console.log('\n=== Mobile production setup ===');

  const gradlePath = path.join(__dirname, '..', 'mobile', 'android', 'app', 'build.gradle.kts');
  const gradle = fs.readFileSync(gradlePath, 'utf8');
  if (gradle.includes(`applicationId = "${PRODUCTION_ANDROID_PACKAGE}"`)) {
    pass('Android applicationId', PRODUCTION_ANDROID_PACKAGE);
  } else fail('Android applicationId', `Expected ${PRODUCTION_ANDROID_PACKAGE}`);

  if (gradle.includes('signingConfigs') && gradle.includes('key.properties')) {
    pass('Android release signing config reads key.properties');
  } else fail('Android release signing config');

  const pbxprojPath = path.join(__dirname, '..', 'mobile', 'ios', 'Runner.xcodeproj', 'project.pbxproj');
  const pbx = fs.readFileSync(pbxprojPath, 'utf8');
  if (pbx.includes(`PRODUCT_BUNDLE_IDENTIFIER = ${PRODUCTION_IOS_BUNDLE};`)) {
    pass('iOS bundle identifier', PRODUCTION_IOS_BUNDLE);
  } else fail('iOS bundle identifier');

  if (
    pbx.includes('CODE_SIGN_ENTITLEMENTS = Runner/Runner.entitlements')
    || pbx.includes('RunnerDebug.entitlements')
    || pbx.includes('RunnerRelease.entitlements')
  ) {
    pass('iOS CODE_SIGN_ENTITLEMENTS configured');
  } else fail('iOS CODE_SIGN_ENTITLEMENTS configured');

  const keyProps = path.join(__dirname, '..', 'mobile', 'android', 'key.properties');
  if (fs.existsSync(keyProps)) {
    pass('Android key.properties present for release builds');
  } else {
    warn('Android key.properties not present', 'Copy key.properties.example before Play Store release');
  }
}

async function main() {
  console.log('Phase 3B — Inbound calling validation\n');

  await testSimultaneousRingHelpers();
  await testAtomicClaimHelpers();
  await testEnvironment();
  await testMobileProductionSetup();

  let prisma = null;
  try {
    prisma = await getPrisma();
  } catch (error) {
    warn('Database connection', error.message);
  }

  await testPushConfiguration(prisma);

  if (prisma) {
    try {
      await testCallControlSetup(prisma);
      await testRingTargetResolution(prisma);
      await testNumberCallControlAssignment(prisma);
    } finally {
      await prisma.$disconnect().catch(() => {});
    }
  }

  await testWebhookReachability();

  const failed = results.filter((r) => r.ok === false).length;
  const warned = results.filter((r) => r.ok === null).length;
  const passed = results.filter((r) => r.ok === true).length;

  console.log('\n=== Summary ===');
  console.log(`Passed: ${passed}  Warnings: ${warned}  Failed: ${failed}`);

  if (failed > 0) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
