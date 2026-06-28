#!/usr/bin/env node
/**
 * Phase 3B Sprint 2 validation — mobile-rn production readiness (React Native).
 * npm run validate:phase3b-sprint2
 */
require('dotenv').config();

const fs = require('fs');
const path = require('path');
const { getPrisma } = require('../db');

const ROOT = path.join(__dirname, '..');
const RN = path.join(ROOT, 'mobile-rn');
const PRODUCTION_ANDROID_PACKAGE = 'com.vspphone.mobile';
const PRODUCTION_IOS_BUNDLE = 'com.vspphone.mobile';

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

function read(relPath) {
  return fs.readFileSync(path.join(ROOT, relPath), 'utf8');
}

function exists(relPath) {
  return fs.existsSync(path.join(ROOT, relPath));
}

function testMobileRnProject() {
  console.log('\n=== React Native mobile-rn ===');

  if (!exists('mobile-rn/package.json')) {
    fail('mobile-rn project present');
    return;
  }
  pass('mobile-rn project present');

  if (exists('mobile')) {
    fail('Deprecated Flutter mobile/ folder removed');
  } else {
    pass('Deprecated Flutter mobile/ folder removed');
  }

  const appConfig = read('mobile-rn/app.config.ts');
  if (appConfig.includes(`package: '${PRODUCTION_ANDROID_PACKAGE}'`)) {
    pass('Production Android package', PRODUCTION_ANDROID_PACKAGE);
  } else fail('Production Android package');

  if (appConfig.includes(`bundleIdentifier: '${PRODUCTION_IOS_BUNDLE}'`)) {
    pass('Production iOS bundle identifier', PRODUCTION_IOS_BUNDLE);
  } else fail('Production iOS bundle identifier');

  if (appConfig.includes('UIBackgroundModes') && appConfig.includes('voip')) {
    pass('iOS VoIP background mode configured');
  } else fail('iOS VoIP background mode');

  if (exists('mobile-rn/plugins/withTelnyxVoice.js')) {
    pass('Telnyx native voice plugin present');
  } else fail('Telnyx native voice plugin missing');

  const pkg = read('mobile-rn/package.json');
  if (pkg.includes('@telnyx/react-voice-commons-sdk')) {
    pass('Telnyx React Native voice SDK dependency');
  } else fail('Telnyx React Native voice SDK dependency');

  if (pkg.includes('@react-native-firebase/messaging')) {
    pass('Firebase messaging dependency');
  } else fail('Firebase messaging dependency');
}

function testMobileRnTelephonyFeatures() {
  console.log('\n=== mobile-rn telephony features ===');

  const dial = read('mobile-rn/src/calling/dialNormalization.ts');
  if (dial.includes('isExtensionDialInput')) {
    pass('Extension dial normalization');
  } else fail('Extension dial normalization');

  const provision = read('mobile-rn/src/auth/provisionService.ts');
  if (provision.includes('/api/mobile/provision')) {
    pass('QR provisioning redeem API wired');
  } else fail('QR provisioning redeem API');

  if (exists('mobile-rn/src/voicemail/voicemailService.ts')) {
    pass('Voicemail service module');
  } else fail('Voicemail service module');

  if (exists('mobile-rn/src/calling/telnyxVoip.ts')) {
    pass('Telnyx VoIP integration module');
  } else fail('Telnyx VoIP integration module');

  const sip = read('mobile-rn/src/sip/service.ts');
  if (sip.includes('fetchSoftphoneToken') || sip.includes('fetchSoftphoneConfig')) {
    pass('Employee SIP token path in sip service');
  } else fail('Employee SIP token path');
}

function testBackendMultiDevice() {
  console.log('\n=== Backend multi-device APIs ===');

  if (exists('prisma/migrations/20260621200000_phase3b_sprint2_user_devices/migration.sql')) {
    pass('UserDevice migration present');
  } else fail('UserDevice migration missing');

  const schema = read('prisma/schema.prisma');
  if (schema.includes('model UserDevice')) {
    pass('Prisma UserDevice model');
  } else fail('Prisma UserDevice model');

  const lib = read('lib/userDevices.js');
  if (lib.includes('registerUserDevice') && lib.includes('removeUserDevice')) {
    pass('userDevices.js register/remove helpers');
  } else fail('userDevices.js helpers');

  const portal = read('routes/portal.js');
  if (portal.includes("router.post('/softphone/push-token'") && portal.includes('deviceId')) {
    pass('Push token API requires deviceId');
  } else fail('Push token API deviceId requirement');

  if (portal.includes("router.get('/softphone/devices'") && portal.includes("router.delete('/softphone/devices/:deviceId'")) {
    pass('Device list/delete API routes');
  } else fail('Device list/delete API routes');

  if (portal.includes("router.post('/mobile/provision'")) {
    pass('Mobile QR provisioning redeem route');
  } else fail('Mobile QR provisioning redeem route');
}

async function testDatabaseUserDevices(prisma) {
  console.log('\n=== Database UserDevice table ===');

  if (!prisma) {
    warn('UserDevice table check skipped', 'Database unavailable');
    return;
  }

  try {
    await prisma.userDevice.count();
    pass('UserDevice table reachable');
  } catch (error) {
    fail('UserDevice table reachable', error.message);
  }
}

async function main() {
  console.log('Phase 3B Sprint 2 — mobile-rn production readiness validation\n');

  testMobileRnProject();
  testMobileRnTelephonyFeatures();
  testBackendMultiDevice();

  let prisma = null;
  try {
    prisma = await getPrisma();
  } catch (error) {
    warn('Database connection', error.message);
  }

  await testDatabaseUserDevices(prisma);
  if (prisma) await prisma.$disconnect().catch(() => {});

  const failed = results.filter((r) => r.ok === false).length;
  const warned = results.filter((r) => r.ok === null).length;
  const passed = results.filter((r) => r.ok === true).length;

  console.log('\n=== Summary ===');
  console.log(`Passed: ${passed}  Warnings: ${warned}  Failed: ${failed}`);

  if (failed > 0) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
