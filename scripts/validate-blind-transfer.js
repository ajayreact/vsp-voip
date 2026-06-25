#!/usr/bin/env node
/**
 * Sprint 2 — Blind transfer integration tests (mocked Telnyx).
 *
 * npm run validate:blind-transfer
 */
require('dotenv').config();

const {
  saveSession,
  getSession,
  indexActiveAgentCall,
  __resetMemoryClaimStateForTests,
} = require('../lib/callControlSessionStore');
const {
  initiateBlindTransfer,
  handleTransferCallControlEvent,
  encodeTransferClientState,
  getTransferSession,
  TRANSFER_STAGES,
  __resetMemoryTransferStateForTests,
} = require('../lib/callTransferControl');
const telnyxCallControl = require('../lib/telnyxCallControl');

const AGENT_SIP = 'agent-transfer-test';
const CALLER_LEG = 'pstn-caller-transfer-test';
const AGENT_LEG = 'webrtc-agent-transfer-test';
const TRANSFER_DEST_LEG = 'transfer-dest-leg-1';
const CALL_SESSION_ID = 'session-blind-transfer-test';

const results = [];
let transferCallInvocations = [];

function pass(name, detail = '') {
  results.push({ ok: true, name, detail });
  console.log(`✅ ${name}${detail ? ` — ${detail}` : ''}`);
}

function fail(name, detail = '') {
  results.push({ ok: false, name, detail });
  console.log(`❌ ${name}${detail ? ` — ${detail}` : ''}`);
}

function assert(condition, name, detail = '') {
  if (condition) pass(name, detail);
  else fail(name, detail);
}

function mockPrisma() {
  const callLogWrites = [];
  return {
    prisma: {
      callLog: {
        upsert: async (args) => {
          callLogWrites.push(args);
          return args.create || args.update;
        },
      },
      extension: {
        findFirst: async () => null,
      },
    },
    callLogWrites,
  };
}

async function seedBridgedSession() {
  const session = {
    callControlId: CALLER_LEG,
    callSessionId: CALL_SESSION_ID,
    from: '+15551234567',
    to: '+15559876543',
    tenantId: 'tenant-transfer-test',
    stage: 'bridged',
    activeBridge: true,
    connectedAt: new Date().toISOString(),
    winnerLeg: AGENT_LEG,
    connectedLeg: AGENT_LEG,
    outboundLegCallControlId: AGENT_LEG,
    ringTargets: [{
      type: 'app',
      user: { telnyxSipUsername: AGENT_SIP, name: 'Agent Test' },
    }],
    activeTarget: {
      type: 'app',
      user: { telnyxSipUsername: AGENT_SIP, name: 'Agent Test' },
    },
  };

  await saveSession(CALLER_LEG, session);
  await indexActiveAgentCall(AGENT_SIP, {
    inboundCallControlId: CALLER_LEG,
    agentLegId: AGENT_LEG,
    callSessionId: CALL_SESSION_ID,
    tenantId: session.tenantId,
    callerLegId: CALLER_LEG,
  });

  return session;
}

async function testTransferUsesCallerLeg() {
  const { prisma } = mockPrisma();
  await seedBridgedSession();

  transferCallInvocations = [];
  const originalTransferCall = telnyxCallControl.transferCall;
  telnyxCallControl.transferCall = async (callControlId, opts) => {
    transferCallInvocations.push({ callControlId, opts });
    return { result: 'ok' };
  };

  try {
    const result = await initiateBlindTransfer(prisma, {
      tenantId: 'tenant-transfer-test',
      agentUserId: 'user-agent-1',
      agentSipUsername: AGENT_SIP,
      destination: '+15551112222',
      destinationType: 'pstn',
      platform: {},
    });

    assert(result.transferId, 'initiateBlindTransfer returns transferId');
    assert(result.stage === TRANSFER_STAGES.TRANSFERRING, 'initiateBlindTransfer stage transferring');
    assert(transferCallInvocations.length === 1, 'transferCall invoked once');
    assert(
      transferCallInvocations[0].callControlId === CALLER_LEG,
      'transferCall uses PSTN caller leg',
      `got ${transferCallInvocations[0].callControlId}`,
    );
    assert(
      transferCallInvocations[0].callControlId !== AGENT_LEG,
      'transferCall never uses agent WebRTC leg',
    );

    const transferSession = await getTransferSession(result.transferId);
    assert(Boolean(transferSession?.target?.dialTo), 'transfer session stores dial target');
  } finally {
    telnyxCallControl.transferCall = originalTransferCall;
  }
}

async function testSuccessfulTransferWebhooks() {
  const { prisma, callLogWrites } = mockPrisma();
  await seedBridgedSession();

  const originalTransferCall = telnyxCallControl.transferCall;
  telnyxCallControl.transferCall = async () => ({ result: 'ok' });
  const initiated = await initiateBlindTransfer(prisma, {
    tenantId: 'tenant-transfer-test',
    agentUserId: 'user-agent-1',
    agentSipUsername: AGENT_SIP,
    destination: '+15553334444',
    destinationType: 'pstn',
    platform: {},
  });

  const clientState = encodeTransferClientState({ transferId: initiated.transferId, stage: 'blind' });

  const initiatedHandled = await handleTransferCallControlEvent(prisma, 'call.initiated', {
    call_control_id: TRANSFER_DEST_LEG,
    call_session_id: CALL_SESSION_ID,
    direction: 'outgoing',
  });
  assert(initiatedHandled, 'call.initiated handled via call_session_id without client_state');

  const answeredHandled = await handleTransferCallControlEvent(prisma, 'call.answered', {
    call_control_id: TRANSFER_DEST_LEG,
    client_state: clientState,
  });
  assert(answeredHandled, 'call.answered handled for transfer destination leg');

  const bridgedHandled = await handleTransferCallControlEvent(prisma, 'call.bridged', {
    call_control_id: TRANSFER_DEST_LEG,
    client_state: clientState,
  });
  assert(bridgedHandled, 'call.bridged handled for transfer destination leg');

  const afterBridge = await getTransferSession(initiated.transferId);
  assert(afterBridge?.stage === TRANSFER_STAGES.COMPLETED, 'transfer completes after bridge');

  const agentHangupHandled = await handleTransferCallControlEvent(prisma, 'call.hangup', {
    call_control_id: AGENT_LEG,
  });
  assert(agentHangupHandled, 'agent leg hangup handled after successful transfer');

  const inboundAfter = await getSession(CALLER_LEG);
  assert(!inboundAfter, 'inbound session cleaned up after transfer success');

  const missed = callLogWrites.some((write) => write.update?.callType === 'missed'
    || write.create?.callType === 'missed');
  assert(!missed, 'no missed call logged on successful transfer');
  assert(callLogWrites.length > 0, 'call log updated on successful transfer');

  telnyxCallControl.transferCall = originalTransferCall;
}

async function testFailedTransferTargetUnavailable() {
  const { prisma } = mockPrisma();
  await seedBridgedSession();

  const originalTransferCall = telnyxCallControl.transferCall;
  telnyxCallControl.transferCall = async () => ({ result: 'ok' });
  const initiated = await initiateBlindTransfer(prisma, {
    tenantId: 'tenant-transfer-test',
    agentUserId: 'user-agent-1',
    agentSipUsername: AGENT_SIP,
    destination: '+15557778888',
    destinationType: 'pstn',
    platform: {},
  });

  const clientState = encodeTransferClientState({ transferId: initiated.transferId, stage: 'blind' });

  await handleTransferCallControlEvent(prisma, 'call.initiated', {
    call_control_id: TRANSFER_DEST_LEG,
    direction: 'outgoing',
    client_state: clientState,
  });

  const destHangupHandled = await handleTransferCallControlEvent(prisma, 'call.hangup', {
    call_control_id: TRANSFER_DEST_LEG,
    client_state: clientState,
  });
  assert(destHangupHandled, 'destination hangup handled as transfer failure');

  const failedSession = await getTransferSession(initiated.transferId);
  assert(failedSession?.stage === TRANSFER_STAGES.FAILED, 'transfer session marked failed');

  const inboundStill = await getSession(CALLER_LEG);
  assert(inboundStill?.stage === 'bridged', 'caller remains bridged to agent after transfer failure');

  telnyxCallControl.transferCall = originalTransferCall;
}

async function testNoActiveCallRejected() {
  const { prisma } = mockPrisma();
  try {
    await initiateBlindTransfer(prisma, {
      tenantId: 'tenant-transfer-test',
      agentUserId: 'user-agent-1',
      agentSipUsername: 'unknown-agent',
      destination: '102',
      destinationType: 'extension',
      platform: {},
    });
    fail('initiateBlindTransfer rejects missing active call');
  } catch (error) {
    assert(error.status === 409, 'missing active call returns 409', error.message);
  }
}

async function main() {
  __resetMemoryClaimStateForTests();
  __resetMemoryTransferStateForTests();

  await testTransferUsesCallerLeg();
  __resetMemoryClaimStateForTests();
  __resetMemoryTransferStateForTests();

  await testSuccessfulTransferWebhooks();
  __resetMemoryClaimStateForTests();
  __resetMemoryTransferStateForTests();

  await testFailedTransferTargetUnavailable();
  __resetMemoryClaimStateForTests();
  __resetMemoryTransferStateForTests();

  await testNoActiveCallRejected();

  const failed = results.filter((r) => !r.ok);
  console.log('');
  console.log(`Results: ${results.length - failed.length}/${results.length} passed`);
  if (failed.length) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
