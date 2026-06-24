#!/usr/bin/env node
/**
 * Test 11 — Rapid Accept Stress Test
 *
 * Simulates:
 *   1. PSTN inbound ringing to WebRTC agent
 *   2. Agent Accept within 500ms (markAgentWebRtcAccepted)
 *   3. Stale call.dial.ended + call.hangup arrive BEFORE bridge webhooks (2–4s delay)
 *   4. Delayed call.dial.answered + call.bridged
 *
 * Pass criteria:
 *   - WEBRTC_ACCEPTED → CALL_DIAL_ANSWERED → CALL_BRIDGED (in order, before unblocked VM)
 *   - VM_ROUTE_ATTEMPT during grace is blocked
 *   - No voicemail prompt (speakCall not invoked for VM)
 *   - Session reaches bridged; call log is NOT missed
 *
 * npm run validate:rapid-accept-stress
 */
require('dotenv').config();

const {
  saveSession,
  getSession,
  indexOutboundLeg,
  indexPendingAgentRing,
  __resetMemoryClaimStateForTests,
} = require('../lib/callControlSessionStore');
const {
  handleInboundCallControlEvent,
  markAgentWebRtcAccepted,
  BRIDGE_GRACE_PERIOD_MS,
} = require('../lib/inboundCallControl');
const { invalidatePlatformSettingsCache } = require('../lib/platformSettings');

const WEBHOOK_DELAY_MS = Number(process.env.RAPID_ACCEPT_WEBHOOK_DELAY_MS) || 3000;
const AGENT_SIP = 'agent-stress-test';
const INBOUND_ID = 'inbound-test-11';
const AGENT_LEG = 'leg-agent-stress-1';
const CALL_SESSION_ID = 'session-test-11-stress';

const results = [];
const bridgeEvents = [];
let voicemailSpeakInvoked = false;

function pass(name, detail = '') {
  results.push({ ok: true, name, detail });
  console.log(`✅ ${name}${detail ? ` — ${detail}` : ''}`);
}

function fail(name, detail = '') {
  results.push({ ok: false, name, detail });
  console.log(`❌ ${name}${detail ? ` — ${detail}` : ''}`);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function captureBridgeLogs() {
  const originalLog = console.log;
  console.log = (...args) => {
    const first = args[0];
    if (typeof first === 'string' && first.startsWith('[CALL CONTROL]')) {
      const label = first.replace('[CALL CONTROL] ', '').trim();
      const meta = args[1] && typeof args[1] === 'object' ? args[1] : {};
      bridgeEvents.push({
        at: Date.now(),
        label: label.split(' ')[0],
        fullLabel: label,
        meta,
      });
    }
    originalLog.apply(console, args);
  };
  return () => {
    console.log = originalLog;
  };
}

function mockPrisma(callLogWrites) {
  return {
    callLog: {
      upsert: async (args) => {
        callLogWrites.push({
          status: args.create?.status || args.update?.status,
          callType: args.create?.callType || args.update?.callType,
          when: Date.now(),
        });
        return { id: 'mock-log' };
      },
    },
    greeting: {
      findUnique: async () => ({ voicemailEnabled: true, callRecordingEnabled: false }),
    },
    platformSettings: {
      findUnique: async () => null,
    },
  };
}

function webhook(eventType, payload) {
  return {
    data: {
      event_type: eventType,
      payload,
    },
  };
}

async function runStressTest() {
  console.log('\n=== Test 11 — Rapid Accept Stress Test ===');
  console.log(`Bridge grace period: ${BRIDGE_GRACE_PERIOD_MS}ms`);
  console.log(`Artificial webhook delay: ${WEBHOOK_DELAY_MS}ms\n`);

  __resetMemoryClaimStateForTests();
  invalidatePlatformSettingsCache();
  bridgeEvents.length = 0;
  voicemailSpeakInvoked = false;

  const callLogWrites = [];
  const prisma = mockPrisma(callLogWrites);
  const restoreLog = captureBridgeLogs();

  // Patch speakCall before inbound handlers run voicemail (best-effort; VM blocked flag is primary signal)
  const tcc = require('../lib/telnyxCallControl');
  const originalSpeak = tcc.speakCall;
  tcc.speakCall = async (callControlId, text) => {
    if (String(text || '').toLowerCase().includes('message')
      || String(text || '').toLowerCase().includes('missed your call')) {
      voicemailSpeakInvoked = true;
    }
    return null;
  };

  const t0 = Date.now();

  await saveSession(INBOUND_ID, {
    callControlId: INBOUND_ID,
    callSessionId: CALL_SESSION_ID,
    tenantId: 'tenant-stress',
    tenant: { name: 'Stress Test Co' },
    greeting: { voicemailEnabled: true, callRecordingEnabled: false },
    from: '+15551234567',
    to: '+15559876543',
    ringStrategy: 'simultaneous',
    stage: 'ringing',
    ringTargets: [{
      type: 'app',
      user: { id: 'user-1', telnyxSipUsername: AGENT_SIP },
      label: 'Agent',
    }],
    outboundLegs: [{
      callControlId: AGENT_LEG,
      targetIndex: 0,
      targetType: 'app',
      status: 'ringing',
    }],
    outboundLegCallControlId: AGENT_LEG,
    callControlApplicationId: 'app-id-mock',
  });

  await indexOutboundLeg(INBOUND_ID, AGENT_LEG);
  await indexPendingAgentRing(INBOUND_ID, AGENT_SIP, '+15551234567');

  // Agent clicks Accept within 500ms
  await sleep(100);
  const acceptResult = await markAgentWebRtcAccepted(AGENT_SIP);
  const acceptLatency = Date.now() - t0;
  if (!acceptResult.ok) {
    fail('markAgentWebRtcAccepted', acceptResult.reason || 'unknown');
    restoreLog();
    return;
  }
  if (acceptLatency > 500) {
    fail('Accept simulated within 500ms', `actual=${acceptLatency}ms`);
  } else {
    pass('Accept simulated within 500ms', `${acceptLatency}ms`);
  }

  // Stale leg termination webhooks arrive BEFORE bridge confirmation (race window)
  await handleInboundCallControlEvent(prisma, webhook('call.dial.ended', {
    call_control_id: AGENT_LEG,
    link_to: INBOUND_ID,
    dial_call_status: 'no-answer',
    call_session_id: CALL_SESSION_ID,
  }));

  await handleInboundCallControlEvent(prisma, webhook('call.hangup', {
    call_control_id: AGENT_LEG,
    link_to: INBOUND_ID,
    call_session_id: CALL_SESSION_ID,
  }));

  // Inbound PSTN hangup during connecting must not tear down the session (bridge grace).
  await handleInboundCallControlEvent(prisma, webhook('call.hangup', {
    call_control_id: INBOUND_ID,
    call_session_id: CALL_SESSION_ID,
  }));

  const preDelaySession = await getSession(INBOUND_ID);
  if (!preDelaySession) {
    fail('Session survives stale hangup during grace', 'session deleted');
  } else if (preDelaySession.stage !== 'connecting') {
    fail('Session stage during grace', `expected connecting, got ${preDelaySession.stage}`);
  } else {
    pass('Session remains connecting during webhook delay window', `stage=${preDelaySession.stage}`);
  }

  // Artificial 2–4s Telnyx bridge webhook delay
  await sleep(WEBHOOK_DELAY_MS);

  await handleInboundCallControlEvent(prisma, webhook('call.dial.answered', {
    call_control_id: AGENT_LEG,
    link_to: INBOUND_ID,
    call_session_id: CALL_SESSION_ID,
  }));

  await handleInboundCallControlEvent(prisma, webhook('call.bridged', {
    call_control_id: AGENT_LEG,
    link_to: INBOUND_ID,
    call_session_id: CALL_SESSION_ID,
  }));

  // Telnyx also emits call.bridged for the inbound PSTN leg — must not hang up the agent leg.
  await handleInboundCallControlEvent(prisma, webhook('call.bridged', {
    call_control_id: INBOUND_ID,
    call_session_id: CALL_SESSION_ID,
  }));

  restoreLog();
  tcc.speakCall = originalSpeak;

  const finalSession = await getSession(INBOUND_ID);

  // --- Event ordering analysis ---
  const labels = bridgeEvents.map((e) => e.label);
  const firstIndex = (label) => labels.indexOf(label);

  const idxWebrtc = firstIndex('WEBRTC_ACCEPTED');
  const idxDialAnswered = labels.findIndex((l) => l === 'CALL_DIAL_ANSWERED');
  const idxBridged = labels.findIndex((l) => l === 'CALL_BRIDGED');
  const vmAttempts = bridgeEvents.filter((e) => e.label === 'VM_ROUTE_ATTEMPT');
  const unblockedVm = vmAttempts.filter((e) => e.meta?.blocked === false);
  const blockedVm = vmAttempts.filter((e) => e.meta?.blocked === true);
  const ignoredDialEnded = bridgeEvents.some(
    (e) => e.label === 'CALL_DIAL_ENDED' && e.meta?.ignored === true,
  );
  const ignoredHangups = bridgeEvents.filter(
    (e) => e.label === 'CALL_HANGUP' && e.meta?.ignored === true,
  );
  const ignoredInboundHangupDuringGrace = ignoredHangups.some(
    (e) => e.meta?.isInboundLeg === true,
  );

  console.log('\n--- Bridge event timeline ---');
  for (const e of bridgeEvents) {
    const blocked = e.meta?.blocked != null ? ` blocked=${e.meta.blocked}` : '';
    console.log(`  ${e.label}${blocked}`);
  }
  console.log('');

  if (idxWebrtc >= 0) pass('WEBRTC_ACCEPTED logged');
  else fail('WEBRTC_ACCEPTED logged');

  if (idxDialAnswered >= 0) pass('CALL_DIAL_ANSWERED logged');
  else fail('CALL_DIAL_ANSWERED logged');

  if (idxBridged >= 0) pass('CALL_BRIDGED logged');
  else fail('CALL_BRIDGED logged');

  if (idxWebrtc >= 0 && idxDialAnswered > idxWebrtc) {
    pass('WEBRTC_ACCEPTED before CALL_DIAL_ANSWERED');
  } else {
    fail('WEBRTC_ACCEPTED before CALL_DIAL_ANSWERED', `webrtc=${idxWebrtc}, answered=${idxDialAnswered}`);
  }

  if (idxDialAnswered >= 0 && idxBridged > idxDialAnswered) {
    pass('CALL_DIAL_ANSWERED before CALL_BRIDGED');
  } else {
    fail('CALL_DIAL_ANSWERED before CALL_BRIDGED', `answered=${idxDialAnswered}, bridged=${idxBridged}`);
  }

  const firstUnblockedVmIdx = bridgeEvents.findIndex(
    (e) => e.label === 'VM_ROUTE_ATTEMPT' && e.meta?.blocked === false,
  );
  if (firstUnblockedVmIdx === -1) {
    pass('No unblocked VM_ROUTE_ATTEMPT during stress window');
  } else if (idxBridged >= 0 && firstUnblockedVmIdx > idxBridged) {
    pass('Unblocked VM_ROUTE_ATTEMPT only after CALL_BRIDGED (if any)');
  } else {
    fail(
      'VM_ROUTE_ATTEMPT (unblocked) must not precede CALL_BRIDGED',
      `unblockedVmIdx=${firstUnblockedVmIdx}, bridgedIdx=${idxBridged}`,
    );
  }

  if (blockedVm.length > 0) {
    pass('VM_ROUTE_ATTEMPT blocked during grace', `count=${blockedVm.length}`);
  } else if (ignoredDialEnded && ignoredHangups.length > 0 && unblockedVm.length === 0) {
    pass(
      'Voicemail routing suppressed during grace (stale leg events ignored)',
      `CALL_DIAL_ENDED + ${ignoredHangups.length} CALL_HANGUP ignored before bridge`,
    );
  } else {
    fail('Voicemail routing suppressed during grace', 'no blocked VM or ignored stale events');
  }

  if (ignoredInboundHangupDuringGrace) {
    pass('Inbound PSTN hangup ignored during connecting grace');
  } else {
    fail('Inbound PSTN hangup ignored during connecting grace');
  }

  const bridgedLogs = bridgeEvents.filter((e) => e.label === 'CALL_BRIDGED');
  const prematureBridged = bridgedLogs.some((e) => e.meta?.stage === 'connecting');
  if (prematureBridged) {
    fail('CALL_BRIDGED logged only after bridged state', 'found CALL_BRIDGED with stage=connecting');
  } else if (bridgedLogs.length > 0) {
    pass('CALL_BRIDGED logged with stage=bridged', `count=${bridgedLogs.length}`);
  } else {
    fail('CALL_BRIDGED logged with stage=bridged');
  }

  if (!voicemailSpeakInvoked) pass('No voicemail speak prompt invoked');
  else fail('No voicemail speak prompt invoked');

  if (finalSession?.stage === 'bridged') {
    pass('Session reached bridged state', `winner=${finalSession.winnerLeg || finalSession.connectedLeg}`);
  } else {
    fail('Session reached bridged state', `stage=${finalSession?.stage || 'deleted'}`);
  }

  const missedWrite = callLogWrites.find((w) => w.callType === 'missed');
  const completedWrite = callLogWrites.find(
    (w) => w.callType === 'answered' || w.status === 'completed',
  );
  if (!missedWrite) pass('Call log never classified as missed');
  else fail('Call log never classified as missed', JSON.stringify(missedWrite));

  if (completedWrite || finalSession?.stage === 'bridged') {
    pass(
      'Call completed successfully (bridged session)',
      completedWrite
        ? `callType=${completedWrite.callType}`
        : `stage=${finalSession?.stage}`,
    );
  } else {
    fail('Call completed successfully', JSON.stringify(callLogWrites));
  }

  const failed = results.filter((r) => r.ok === false).length;
  const passed = results.filter((r) => r.ok === true).length;

  console.log(`\n=== Test 11 Summary ===`);
  console.log(`Passed: ${passed}  Failed: ${failed}`);

  if (failed > 0) process.exit(1);
}

runStressTest().catch((error) => {
  console.error('Test 11 crashed:', error);
  process.exit(1);
});
