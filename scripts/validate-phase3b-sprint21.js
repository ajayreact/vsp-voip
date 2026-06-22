#!/usr/bin/env node
/**
 * Phase 3B Sprint 2.1 — Telnyx P0 production fixes validation
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

function testIosAudioReliability() {
  console.log('\n=== P0 iOS audio reliability ===');
  const appDelegate = read('mobile/ios/Runner/AppDelegate.swift');

  if (appDelegate.includes('CallkitIncomingAppDelegate')) {
    pass('AppDelegate implements CallkitIncomingAppDelegate');
  } else fail('AppDelegate implements CallkitIncomingAppDelegate');

  if (appDelegate.includes('useManualAudio = true') && appDelegate.includes('isAudioEnabled = false')) {
    pass('RTCAudioSession manual audio at launch');
  } else fail('RTCAudioSession manual audio at launch');

  if (appDelegate.includes('audioSessionDidActivate') && appDelegate.includes('audioSessionDidDeactivate')) {
    pass('CallKit audio session activate/deactivate delegates');
  } else fail('CallKit audio session delegates');

  if (appDelegate.includes('import WebRTC')) {
    pass('WebRTC framework imported');
  } else fail('WebRTC framework imported');

  if (appDelegate.includes('completion: completion') || appDelegate.includes('completion:completion')) {
    pass('VoIP push completion passed to CallKit show');
  } else fail('VoIP push completion callback');

  const native = read('mobile/lib/core/push/native_incoming_call_ui.dart');
  if (native.includes('startOutboundCallKit')) {
    pass('iOS outbound CallKit startCall helper');
  } else fail('iOS outbound CallKit startCall helper');
}

function testAndroidFcmReliability() {
  console.log('\n=== P0 Android FCM reliability ===');
  const manifest = read('mobile/android/app/src/main/AndroidManifest.xml');
  const gradle = read('mobile/android/app/build.gradle.kts');
  const telnyxNotif = read('mobile/lib/core/push/telnyx_android_notifications.dart');
  const bootstrap = read('mobile/lib/core/push/push_bootstrap.dart');

  if (telnyxNotif.includes("channelId = 'telnyx_call_channel'") && telnyxNotif.includes('Importance.max')) {
    pass('telnyx_call_channel with max importance');
  } else fail('telnyx_call_channel configuration');

  if (manifest.includes('com.google.firebase.messaging.default_notification_channel_id') &&
      manifest.includes('telnyx_call_channel')) {
    pass('Manifest default FCM notification channel');
  } else fail('Manifest default FCM notification channel');

  if (gradle.includes('isCoreLibraryDesugaringEnabled = true') && gradle.includes('desugar_jdk_libs')) {
    pass('Core library desugaring enabled');
  } else fail('Core library desugaring');

  if (telnyxNotif.includes('Permission.notification')) {
    pass('Android 13+ notification permission request');
  } else fail('Android 13+ notification permission request');

  if (bootstrap.includes('TelnyxAndroidNotifications.initialize')) {
    pass('Bootstrap initializes Telnyx Android notifications');
  } else fail('Bootstrap initializes Telnyx Android notifications');
}

function testBackgroundCallHandling() {
  console.log('\n=== P0 background call handling ===');
  const lifecycle = read('mobile/lib/core/push/app_lifecycle_bridge.dart');
  const coordinator = read('mobile/lib/core/push/push_call_coordinator.dart');
  const controller = read('mobile/lib/features/softphone/providers/softphone_controller.dart');
  const native = read('mobile/lib/core/push/native_incoming_call_ui.dart');

  if (lifecycle.includes('AppLifecycleState.paused') && lifecycle.includes('notifyAppBackground')) {
    pass('Lifecycle bridge notifies background');
  } else fail('Lifecycle bridge background detection');

  if (coordinator.includes('suppressBackgroundDisconnect') && coordinator.includes('beginIncomingCallUi')) {
    pass('Incoming UI suppresses background disconnect');
  } else fail('Incoming UI suppress guard');

  if (controller.includes('disconnectSocketForBackground') && controller.includes('PushCallAction.appBackground')) {
    pass('Softphone disconnects socket on background');
  } else fail('Softphone background disconnect');

  if (controller.includes('_socketDisconnectedForBackground')) {
    pass('Background disconnect allows foreground reconnect');
  } else fail('Foreground reconnect after background flag');

  if (native.includes('beginIncomingCallUi')) {
    pass('Native incoming UI uses suppress guard');
  } else fail('Native incoming UI suppress guard');
}

function main() {
  console.log('Phase 3B Sprint 2.1 — Telnyx P0 fixes validation\n');
  testIosAudioReliability();
  testAndroidFcmReliability();
  testBackgroundCallHandling();

  const failed = results.filter((r) => r.ok === false).length;
  const passed = results.filter((r) => r.ok === true).length;

  console.log('\n=== Summary ===');
  console.log(`Passed: ${passed}  Failed: ${failed}`);

  if (failed > 0) process.exit(1);
}

main();
