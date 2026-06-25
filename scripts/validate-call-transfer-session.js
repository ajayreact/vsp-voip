#!/usr/bin/env node
/**
 * Sprint 1 — Call transfer session foundation (unit tests).
 *
 * Verifies TransferSession creation, Redis/memory save-load, and state transitions.
 * Does not invoke Telnyx APIs or modify production call flows.
 *
 * npm run validate:call-transfer-session
 */
require('dotenv').config();

const {
  TRANSFER_STAGES,
  createTransferSession,
  getTransferSession,
  saveTransferSession,
  deleteTransferSession,
  transitionTransferStage,
  canTransitionTransferStage,
  isTerminalTransferStage,
  __resetMemoryTransferStateForTests,
} = require('../lib/callTransferControl');
const { transferCall, bridgeCalls } = require('../lib/telnyxCallControl');

const results = [];

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

async function expectRejection(fn, name, { status } = {}) {
  try {
    await fn();
    fail(name, 'expected rejection');
  } catch (error) {
    if (status != null && error.status !== status) {
      fail(name, `expected status ${status}, got ${error.status}`);
      return;
    }
    pass(name, error.message);
  }
}

function baseSessionParams() {
  return {
    tenantId: 'tenant-test-1',
    agentUserId: 'agent-user-1',
    callerLegId: 'pstn-leg-inbound-1',
    agentLegId: 'webrtc-leg-agent-1',
    inboundSessionId: 'pstn-leg-inbound-1',
    callSessionId: 'call-session-1',
    target: { type: 'extension', value: '1002' },
    webrtcCallId: 'webrtc-call-uuid-1',
  };
}

async function testCreateTransferSession() {
  const session = createTransferSession(baseSessionParams());
  assert(session.transferId, 'createTransferSession assigns transferId');
  assert(session.stage === TRANSFER_STAGES.IDLE, 'createTransferSession defaults to idle');
  assert(session.mode === 'blind', 'createTransferSession defaults mode to blind');
  assert(session.target.value === '1002', 'createTransferSession preserves target');
}

async function testCreateValidation() {
  await expectRejection(
    () => createTransferSession({ ...baseSessionParams(), tenantId: '' }),
    'createTransferSession rejects missing tenantId',
    { status: 400 },
  );
  await expectRejection(
    () => createTransferSession({ ...baseSessionParams(), target: { type: 'ext' } }),
    'createTransferSession rejects incomplete target',
    { status: 400 },
  );
}

async function testSaveLoadRoundtrip() {
  const session = createTransferSession(baseSessionParams());
  await saveTransferSession(session);
  const loaded = await getTransferSession(session.transferId);
  assert(Boolean(loaded), 'saveTransferSession persists session');
  assert(loaded?.transferId === session.transferId, 'getTransferSession loads transferId');
  assert(loaded?.stage === TRANSFER_STAGES.IDLE, 'getTransferSession loads stage');
  await deleteTransferSession(session.transferId);
  const cleared = await getTransferSession(session.transferId);
  assert(!cleared, 'deleteTransferSession removes session');
}

async function testStateTransitionsHappyPath() {
  const session = createTransferSession(baseSessionParams());
  await saveTransferSession(session);

  const transferring = await transitionTransferStage(
    session.transferId,
    TRANSFER_STAGES.TRANSFERRING,
  );
  assert(transferring.stage === TRANSFER_STAGES.TRANSFERRING, 'idle → transferring');

  const completed = await transitionTransferStage(
    session.transferId,
    TRANSFER_STAGES.COMPLETED,
  );
  assert(completed.stage === TRANSFER_STAGES.COMPLETED, 'transferring → completed');
  assert(isTerminalTransferStage(completed.stage), 'completed is terminal');

  await deleteTransferSession(session.transferId);
}

async function testStateTransitionsFailureAndCancel() {
  const failSession = createTransferSession(baseSessionParams());
  await saveTransferSession(failSession);
  await transitionTransferStage(failSession.transferId, TRANSFER_STAGES.TRANSFERRING);
  const failed = await transitionTransferStage(
    failSession.transferId,
    TRANSFER_STAGES.FAILED,
    { failureReason: 'telnyx_timeout' },
  );
  assert(failed.stage === TRANSFER_STAGES.FAILED, 'transferring → failed');
  assert(failed.failureReason === 'telnyx_timeout', 'failed stores failureReason');
  await deleteTransferSession(failSession.transferId);

  const cancelSession = createTransferSession(baseSessionParams());
  await saveTransferSession(cancelSession);
  await transitionTransferStage(cancelSession.transferId, TRANSFER_STAGES.TRANSFERRING);
  const cancelled = await transitionTransferStage(
    cancelSession.transferId,
    TRANSFER_STAGES.CANCELLED,
  );
  assert(cancelled.stage === TRANSFER_STAGES.CANCELLED, 'transferring → cancelled');
  await deleteTransferSession(cancelSession.transferId);

  const idleCancel = createTransferSession(baseSessionParams());
  await saveTransferSession(idleCancel);
  const idleCancelled = await transitionTransferStage(
    idleCancel.transferId,
    TRANSFER_STAGES.CANCELLED,
  );
  assert(idleCancelled.stage === TRANSFER_STAGES.CANCELLED, 'idle → cancelled');
  await deleteTransferSession(idleCancel.transferId);
}

async function testInvalidTransitions() {
  const session = createTransferSession(baseSessionParams());
  await saveTransferSession(session);

  await expectRejection(
    () => transitionTransferStage(session.transferId, TRANSFER_STAGES.COMPLETED),
    'idle → completed is rejected',
    { status: 409 },
  );

  await transitionTransferStage(session.transferId, TRANSFER_STAGES.TRANSFERRING);
  await transitionTransferStage(session.transferId, TRANSFER_STAGES.COMPLETED);

  await expectRejection(
    () => transitionTransferStage(session.transferId, TRANSFER_STAGES.TRANSFERRING),
    'completed → transferring is rejected',
    { status: 409 },
  );

  assert(
    !canTransitionTransferStage(TRANSFER_STAGES.COMPLETED, TRANSFER_STAGES.IDLE),
    'canTransitionTransferStage blocks terminal exit',
  );

  await deleteTransferSession(session.transferId);
}

async function testTelnyxWrapperValidation() {
  assert(typeof transferCall === 'function', 'transferCall is exported');
  assert(typeof bridgeCalls === 'function', 'bridgeCalls is exported');

  await expectRejection(
    () => transferCall('leg-1', {}),
    'transferCall requires to',
    { status: 400 },
  );
  await expectRejection(
    () => bridgeCalls('leg-1', {}),
    'bridgeCalls requires otherCallControlId',
    { status: 400 },
  );
}

async function main() {
  __resetMemoryTransferStateForTests();

  await testCreateTransferSession();
  await testCreateValidation();
  await testSaveLoadRoundtrip();
  await testStateTransitionsHappyPath();
  await testStateTransitionsFailureAndCancel();
  await testInvalidTransitions();
  await testTelnyxWrapperValidation();

  const failed = results.filter((r) => !r.ok);
  console.log('');
  console.log(`Results: ${results.length - failed.length}/${results.length} passed`);
  if (failed.length) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
