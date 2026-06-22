#!/usr/bin/env node
/**
 * Phase 3B Sprint 2 validation — npm run validate:phase3b-sprint2
 */
require('dotenv').config();

const fs = require('fs');
const path = require('path');
const { getPrisma } = require('../db');

const ROOT = path.join(__dirname, '..');
const MOBILE = path.join(ROOT, 'mobile');
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

function read(relPath) {
  return fs.readFileSync(path.join(ROOT, relPath), 'utf8');
}

function exists(relPath) {
  return fs.existsSync(path.join(ROOT, relPath));
}

function testPriority1AndroidPlayFcm() {
  console.log('\n=== P1 Android / Play / FCM ===');

  const gradle = read('mobile/android/app/build.gradle.kts');
  if (gradle.includes(`applicationId = "${PRODUCTION_ANDROID_PACKAGE}"`)) {
    pass('Production Android applicationId', PRODUCTION_ANDROID_PACKAGE);
  } else fail('Production Android applicationId');

  if (gradle.includes('signingConfigs') && gradle.includes('key.properties')) {
    pass('Release signing reads key.properties');
  } else fail('Release signing config');

  if (exists('mobile/android/app/proguard-rules.pro')) {
    pass('ProGuard rules file present');
  } else fail('ProGuard rules file missing');

  const pubspec = read('mobile/pubspec.yaml');
  if (/version:\s*1\.0\.0/.test(pubspec)) {
    pass('Mobile version bumped for beta', pubspec.match(/version:\s*.+/)?.[0]);
  } else warn('Mobile version not at 1.0.0 beta');

  const gsPath = path.join(MOBILE, 'android', 'app', 'google-services.json');
  if (fs.existsSync(gsPath)) {
    try {
      const json = JSON.parse(fs.readFileSync(gsPath, 'utf8'));
      const packageName = json?.client?.[0]?.client_info?.android_client_info?.package_name;
      if (packageName === PRODUCTION_ANDROID_PACKAGE) {
        pass('FCM google-services.json package', packageName);
      } else {
        fail('FCM package mismatch', `got ${packageName}`);
      }
    } catch (error) {
      fail('google-services.json parse', error.message);
    }
  } else {
    fail('google-services.json missing');
  }

  if (exists('mobile/android/key.properties')) {
    pass('Android key.properties present');
  } else {
    warn('Android key.properties missing', 'Copy key.properties.example before Play upload');
  }

  const controller = read('mobile/lib/core/push/push_bootstrap.dart');
  if (controller.includes('onTokenRefresh')) {
    pass('FCM onTokenRefresh handler wired');
  } else fail('FCM onTokenRefresh handler missing');
}

function testPriority2IosPushKitCallKit() {
  console.log('\n=== P2 iOS PushKit / CallKit / App Store ===');

  const pbx = read('mobile/ios/Runner.xcodeproj/project.pbxproj');
  if (pbx.includes(`PRODUCT_BUNDLE_IDENTIFIER = ${PRODUCTION_IOS_BUNDLE};`)) {
    pass('iOS bundle identifier', PRODUCTION_IOS_BUNDLE);
  } else fail('iOS bundle identifier');

  if (pbx.includes('RunnerDebug.entitlements') && pbx.includes('RunnerRelease.entitlements')) {
    pass('Debug/Release entitlements split configured');
  } else fail('Debug/Release entitlements split');

  const debugEnt = read('mobile/ios/Runner/RunnerDebug.entitlements');
  const releaseEnt = read('mobile/ios/Runner/RunnerRelease.entitlements');

  if (debugEnt.includes('<string>development</string>')) {
    pass('Debug aps-environment = development');
  } else fail('Debug aps-environment');

  if (releaseEnt.includes('<string>production</string>')) {
    pass('Release aps-environment = production');
  } else fail('Release aps-environment');

  if (releaseEnt.includes('pushkit.unrestricted-voip')) {
    pass('PushKit unrestricted VoIP entitlement');
  } else fail('PushKit unrestricted VoIP entitlement');

  const callKitUi = read('mobile/lib/core/push/native_incoming_call_ui.dart');
  if (callKitUi.includes('FlutterCallkitIncoming') && callKitUi.includes('showCallkitIncoming')) {
    pass('CallKit incoming UI integration');
  } else fail('CallKit incoming UI integration');

  if (exists('mobile/ios/Runner/Info.plist')) {
    pass('iOS Info.plist present');
  } else fail('iOS Info.plist missing');
}

function testPriority3MultiDevice() {
  console.log('\n=== P3 Multi-device push tokens ===');

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

  if (exists('mobile/lib/core/device/device_install_service.dart')) {
    pass('Mobile device install service');
  } else fail('Mobile device install service');

  const api = read('mobile/lib/features/softphone/data/softphone_api.dart');
  if (api.includes('deviceId') && api.includes('unregisterDevice')) {
    pass('Mobile softphone API sends deviceId + unregister');
  } else fail('Mobile softphone API multi-device');

  const controller = read('mobile/lib/features/softphone/providers/softphone_controller.dart');
  if (controller.includes('_scheduleTokenRefresh') && controller.includes('_refreshLoginToken')) {
    pass('Telnyx login token refresh before expiry');
  } else fail('Telnyx login token refresh');
}

function testPriority4AudioRouting() {
  console.log('\n=== P4 Bluetooth / audio routing ===');

  if (exists('mobile/lib/core/audio/audio_route_service.dart')) {
    pass('Audio route service');
  } else fail('Audio route service');

  const audio = read('mobile/lib/core/audio/audio_route_service.dart');
  if (audio.includes('bluetooth') && audio.includes('hasHeadsetConnected')) {
    pass('Bluetooth/headset detection helpers');
  } else fail('Bluetooth/headset detection');

  if (exists('mobile/lib/shared/widgets/audio_route_picker.dart')) {
    pass('Audio route picker UI');
  } else fail('Audio route picker UI');
}

function testPriority5VoicemailNotifications() {
  console.log('\n=== P5 Voicemail + missed call notifications ===');

  if (exists('mobile/lib/features/voicemail/presentation/voicemail_screen.dart')) {
    pass('Mobile voicemail inbox screen');
  } else fail('Mobile voicemail inbox screen');

  const vm = read('mobile/lib/features/voicemail/presentation/voicemail_screen.dart');
  if (vm.includes('just_audio') || vm.includes('AudioPlayer')) {
    pass('Voicemail playback via just_audio');
  } else fail('Voicemail playback');

  if (exists('mobile/lib/core/notifications/missed_call_notifier.dart')) {
    pass('Missed call local notifier');
  } else fail('Missed call local notifier');

  const pubspec = read('mobile/pubspec.yaml');
  if (pubspec.includes('flutter_local_notifications')) {
    pass('flutter_local_notifications dependency');
  } else fail('flutter_local_notifications dependency');
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
  console.log('Phase 3B Sprint 2 — Mobile production readiness validation\n');

  testPriority1AndroidPlayFcm();
  testPriority2IosPushKitCallKit();
  testPriority3MultiDevice();
  testPriority4AudioRouting();
  testPriority5VoicemailNotifications();

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
