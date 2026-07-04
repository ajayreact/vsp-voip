#!/usr/bin/env node
/**
 * Phase 3B Sprint 2.1 — mobile-rn Telnyx P0 production fixes validation
 */
require('dotenv').config();

const fs = require('fs');
const path = require('path');

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

function exists(rel) {
  return fs.existsSync(path.join(ROOT, rel));
}

function testMobileRnNativeVoice() {
  console.log('\n=== mobile-rn native voice / push ===');

  if (!exists('mobile-rn/plugins/withTelnyxVoice.js')) {
    fail('withTelnyxVoice config plugin');
    return;
  }
  pass('withTelnyxVoice config plugin');

  const plugin = read('mobile-rn/plugins/withTelnyxVoice.js');
  if (plugin.includes('Telnyx') || plugin.includes('telnyx')) {
    pass('Telnyx native plugin references Telnyx SDK');
  } else fail('Telnyx native plugin content');

  if (exists('mobile-rn/plugins/ios/VoicePnBridge.m')) {
    pass('iOS VoIP push bridge present');
  } else fail('iOS VoIP push bridge missing');

  const appConfig = read('mobile-rn/app.config.ts');
  if (appConfig.includes('remote-notification') && appConfig.includes('voip')) {
    pass('iOS background modes for VoIP + push');
  } else fail('iOS background modes');

  const firebaseMerger = read('mobile-rn/plugins/withFirebaseNotificationMerger.js');
  if (firebaseMerger.includes('Firebase') || firebaseMerger.includes('firebase')) {
    pass('Firebase notification merger plugin');
  } else fail('Firebase notification merger plugin');
}

function testMobileRnCallHandling() {
  console.log('\n=== mobile-rn call handling ===');

  const controller = read('mobile-rn/src/calling/callingController.ts');
  if (controller.includes('Telnyx') || controller.includes('telnyx')) {
    pass('Calling controller uses Telnyx integration');
  } else fail('Calling controller Telnyx integration');

  const voip = read('mobile-rn/src/calling/telnyxVoip.ts');
  if (voip.includes('createTelnyxVoipClient') || voip.includes('TelnyxVoipClient')) {
    pass('Telnyx VoIP client factory');
  } else fail('Telnyx VoIP helpers');

  if (exists('mobile-rn/src/notifications/nativeBridge.ts')) {
    pass('Native notification bridge module');
  } else fail('Native notification bridge');

  const nativeBridge = read('mobile-rn/src/notifications/nativeBridge.ts');
  if (nativeBridge.includes('push') || nativeBridge.includes('Push') || nativeBridge.includes('notification')) {
    pass('Push notification bridge wired');
  } else fail('Push notification bridge content');
}

function testDeprecatedFlutterRemoved() {
  console.log('\n=== Deprecated Flutter cleanup ===');

  if (exists('mobile/pubspec.yaml')) {
    fail('Flutter mobile/ still present');
  } else {
    pass('Flutter mobile/ removed');
  }

  if (exists('scripts/build-mobile-android.ps1') || exists('scripts/build-mobile-ios.sh')) {
    fail('Flutter build scripts still present');
  } else {
    pass('Flutter build scripts removed');
  }
}

function main() {
  console.log('Phase 3B Sprint 2.1 — mobile-rn P0 fixes validation\n');
  testMobileRnNativeVoice();
  testMobileRnCallHandling();
  testDeprecatedFlutterRemoved();

  const failed = results.filter((r) => r.ok === false).length;
  const passed = results.filter((r) => r.ok === true).length;

  console.log('\n=== Summary ===');
  console.log(`Passed: ${passed}  Failed: ${failed}`);

  if (failed > 0) process.exit(1);
}

main();
