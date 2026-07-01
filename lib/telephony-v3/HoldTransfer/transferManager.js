const crypto = require('crypto');
const sessionManager = require('../Sessions/sessionManager');
const legManager = require('../Sessions/legManager');
const eventBus = require('../Events/domainEventBus');
const { DOMAIN_EVENTS } = require('../Events/domainEvents');
const featureFlags = require('../FeatureFlags/featureFlagService');
const { resolveSessionTransition } = require('../StateMachine/sessionTransitions');
const { v3Logger } = require('../Utils/v3Logger');
const { metrics } = require('../Utils/metrics');
const { getPrisma } = require('../internal/prisma');
const {
  evaluateTransferPolicy,
  recordTransferAttempt,
  clearTransferAttempts,
  isTransferTimedOut,
  POLICY_ACTION,
} = require('./transferPolicy');
const { buildTransferCommands } = require('./transferCommandBuilder');
const { TRANSFER_TYPE, TRANSFER_ACTION } = require('./holdTransferConstants');

/** @type {Map<string, { type: string, consultCallControlId?: string|null, startedAt: number }>} */
const activeTransfers = new Map();
/** @type {Set<string>} */
const handledRequests = new Set();

function resetTransferManagerForTests() {
  activeTransfers.clear();
  handledRequests.clear();
}

async function persistTransferSnapshot(sessionId, patch, version) {
  const prisma = await getPrisma();
  const row = await prisma.v3CallSession.findUnique({
    where: { id: sessionId },
    select: { routeSnapshot: true },
  });
  const snapshot = {
    ...(row?.routeSnapshot && typeof row.routeSnapshot === 'object' ? row.routeSnapshot : {}),
    holdTransfer: {
      ...(row?.routeSnapshot?.holdTransfer || {}),
      ...patch,
    },
  };
  await prisma.v3CallSession.updateMany({
    where: { id: sessionId, version },
    data: { routeSnapshot: snapshot, version: { increment: 1 }, updatedAt: new Date() },
  });
}

async function publishTransferEvent(base, eventType, payload) {
  await eventBus.publish({
    eventId: crypto.randomUUID(),
    eventType,
    occurredAt: new Date().toISOString(),
    sessionId: base.sessionId,
    tenantId: base.tenantId ?? null,
    correlationId: base.correlationId ?? null,
    callControlId: base.callControlId ?? null,
    payload,
  });
}

async function applyTransferSessionFsm(session, trigger, eventId) {
  const toState = resolveSessionTransition(session.state, trigger);
  if (!toState) {
    throw new Error(`invalid_session_transition:${session.state}:${trigger}`);
  }
  const updatedSession = await sessionManager.persistSessionTransition(
    session.id,
    session.version,
    { state: toState },
    { fromState: session.state, toState, triggerEvent: trigger, eventId },
    session.tenantId,
  );
  return { toState, updatedSession };
}

/**
 * @param {{
 *   sessionId: string,
 *   tenantId: string,
 *   target: string,
 *   legId?: string,
 *   callControlId?: string,
 *   requestId?: string,
 *   traceId?: string,
 * }} input
 */
async function blindTransfer(input) {
  return executeTransfer({
    ...input,
    transferType: TRANSFER_TYPE.BLIND,
    action: TRANSFER_ACTION.START,
  });
}

/**
 * @param {{
 *   sessionId: string,
 *   tenantId: string,
 *   target: string,
 *   legId?: string,
 *   callControlId?: string,
 *   connectionId?: string,
 *   requestId?: string,
 *   traceId?: string,
 * }} input
 */
async function startAttendedTransfer(input) {
  return executeTransfer({
    ...input,
    transferType: TRANSFER_TYPE.ATTENDED,
    action: TRANSFER_ACTION.START,
  });
}

/**
 * @param {{
 *   sessionId: string,
 *   tenantId: string,
 *   consultCallControlId: string,
 *   requestId?: string,
 *   traceId?: string,
 * }} input
 */
async function completeAttendedTransfer(input) {
  return executeTransfer({
    ...input,
    transferType: TRANSFER_TYPE.ATTENDED,
    action: TRANSFER_ACTION.COMPLETE,
    target: null,
  });
}

/**
 * @param {{
 *   sessionId: string,
 *   tenantId: string,
 *   consultCallControlId?: string,
 *   requestId?: string,
 *   traceId?: string,
 * }} input
 */
async function cancelTransfer(input) {
  return executeTransfer({
    ...input,
    transferType: TRANSFER_TYPE.ATTENDED,
    action: TRANSFER_ACTION.CANCEL,
    target: null,
  });
}

/**
 * @param {{
 *   sessionId: string,
 *   tenantId: string,
 *   consultCallControlId?: string,
 *   reason?: string,
 *   requestId?: string,
 *   traceId?: string,
 * }} input
 */
async function failTransfer(input) {
  return executeTransfer({
    ...input,
    transferType: TRANSFER_TYPE.ATTENDED,
    action: TRANSFER_ACTION.FAIL,
    target: null,
  });
}

/**
 * @param {object} input
 */
async function executeTransfer(input) {
  const startedMs = Date.now();
  const requestKey = `${input.sessionId}:transfer:${input.action}:${input.requestId || 'default'}`;
  if (handledRequests.has(requestKey)) {
    return { skipped: true, reason: 'duplicate_request' };
  }
  handledRequests.add(requestKey);

  const session = await sessionManager.loadSession(input.sessionId, input.tenantId);
  const leg = session.legs?.find((l) => l.id === input.legId)
    || session.legs?.find((l) => l.callControlId === input.callControlId)
    || session.legs?.find((l) => l.callControlId === session.primaryCallControlId);

  if (!leg && input.action === TRANSFER_ACTION.START) {
    metrics.transferFailed({ transfer_type: input.transferType, reason: 'leg_not_found' });
    return { ok: false, error: 'leg_not_found' };
  }

  const flags = await featureFlags.getTenantFlags(input.tenantId);
  if (!flags.transferEnabled) {
    return { skipped: true, reason: 'transfer_disabled' };
  }

  const callControlId = input.callControlId || leg?.callControlId || session.primaryCallControlId;
  const eventBase = {
    sessionId: session.id,
    tenantId: session.tenantId,
    correlationId: session.correlationId,
    callControlId,
  };

  if (input.action === TRANSFER_ACTION.START) {
    if (activeTransfers.has(session.id)) {
      return { skipped: true, reason: 'transfer_in_progress' };
    }
    await publishTransferEvent(eventBase, DOMAIN_EVENTS.TRANSFER_STARTED, {
      traceId: input.traceId,
      transferType: input.transferType,
      target: input.target,
    });
  }

  try {
    if (input.action === TRANSFER_ACTION.START && isTransferTimedOut(session.id)) {
      throw new Error('transfer_timeout');
    }

    const policy = await evaluateTransferPolicy({
      tenantId: input.tenantId,
      sessionId: session.id,
      sessionState: session.state,
      transferType: input.transferType,
      transferEnabled: flags.transferEnabled,
      observeOnly: flags.observeOnly,
      target: input.target,
    });

    const active = activeTransfers.get(session.id);
    const commands = buildTransferCommands({
      transferType: input.transferType,
      action: input.action,
      policy,
      originCallControlId: callControlId,
      target: input.target,
      consultCallControlId: input.consultCallControlId || active?.consultCallControlId,
      connectionId: input.connectionId || leg?.connectionId,
    });

    if (policy.effectiveAction === POLICY_ACTION.DENY) {
      await publishTransferEvent(eventBase, DOMAIN_EVENTS.TRANSFER_FAILED, {
        traceId: input.traceId,
        policy,
      });
      metrics.transferFailed({ transfer_type: input.transferType, reason: policy.reason || 'deny' });
      return { ok: false, policy };
    }

    let sessionState = session.state;
    let updatedSession = session;

    if (input.action === TRANSFER_ACTION.START) {
      recordTransferAttempt(session.id);
      const fsmResult = await applyTransferSessionFsm(session, 'transfer.started', requestKey);
      sessionState = fsmResult.toState;
      updatedSession = fsmResult.updatedSession;
      activeTransfers.set(session.id, {
        type: input.transferType,
        consultCallControlId: input.consultCallControlId || null,
        startedAt: Date.now(),
      });
      if (input.transferType === TRANSFER_TYPE.ATTENDED) {
        const timerService = require('../Timer/timerService');
        const timeoutSec = policy.transferTimeoutSec ?? 30;
        await timerService.scheduleTimer(session.id, 'transfer-timeout', timeoutSec).catch(() => {});
      }
      await persistTransferSnapshot(session.id, {
        transferActive: true,
        transferType: input.transferType,
        target: input.target,
        startedAt: new Date().toISOString(),
      }, updatedSession.version);

      if (input.transferType === TRANSFER_TYPE.ATTENDED) {
        await publishTransferEvent(eventBase, DOMAIN_EVENTS.TRANSFER_RINGING, {
          traceId: input.traceId,
          target: input.target,
        });
      }
    } else if (input.action === TRANSFER_ACTION.COMPLETE) {
      const fresh = await sessionManager.loadSession(session.id, session.tenantId);
      const fsmResult = await applyTransferSessionFsm(fresh, 'transfer.completed', requestKey);
      sessionState = fsmResult.toState;
      activeTransfers.delete(session.id);
      clearTransferAttempts(session.id);
    } else if (input.action === TRANSFER_ACTION.CANCEL) {
      const fresh = await sessionManager.loadSession(session.id, session.tenantId);
      const fsmResult = await applyTransferSessionFsm(fresh, 'transfer.cancelled', requestKey);
      sessionState = fsmResult.toState;
      activeTransfers.delete(session.id);
    } else if (input.action === TRANSFER_ACTION.FAIL) {
      const fresh = await sessionManager.loadSession(session.id, session.tenantId);
      const fsmResult = await applyTransferSessionFsm(fresh, 'transfer.cancelled', requestKey);
      sessionState = fsmResult.toState;
      activeTransfers.delete(session.id);
      await publishTransferEvent(eventBase, DOMAIN_EVENTS.TRANSFER_FAILED, {
        traceId: input.traceId,
        reason: input.reason || 'transfer_failed',
      });
      metrics.transferFailed({ transfer_type: input.transferType, reason: input.reason || 'failed' });
    }

    if (!flags.observeOnly && commands.length && leg) {
      const commandBus = require('../Commands/commandBus');
      await commandBus.enqueueIntents(commands, {
        sessionId: session.id,
        legId: leg.id,
        tenantId: session.tenantId,
        correlationId: session.correlationId,
        targetCallControlId: callControlId,
        sequenceStart: 0,
      });
    }

    const durationMs = Date.now() - startedMs;
    metrics.transferTotal({ transfer_type: input.transferType, action: input.action });
    metrics.observeTransferDuration(durationMs, { transfer_type: input.transferType });

    if (input.action === TRANSFER_ACTION.COMPLETE || input.action === TRANSFER_ACTION.START && input.transferType === TRANSFER_TYPE.BLIND) {
      await publishTransferEvent(eventBase, DOMAIN_EVENTS.TRANSFER_COMPLETED, {
        traceId: input.traceId,
        transferType: input.transferType,
        durationMs,
        commandsEnqueued: !flags.observeOnly,
      });
    }

    if (input.action === TRANSFER_ACTION.CANCEL) {
      await publishTransferEvent(eventBase, DOMAIN_EVENTS.TRANSFER_CANCELLED, {
        traceId: input.traceId,
        durationMs,
      });
    }

    v3Logger.info('transfer.action', {
      sessionId: session.id,
      tenantId: session.tenantId,
      transferType: input.transferType,
      action: input.action,
      durationMs,
    });

    return { ok: true, sessionState, policy };
  } catch (error) {
    metrics.transferFailed({ transfer_type: input.transferType || 'UNKNOWN', reason: 'error' });
    await publishTransferEvent(eventBase, DOMAIN_EVENTS.TRANSFER_FAILED, {
      traceId: input.traceId,
      error: error.message,
    });
    v3Logger.error('transfer.failed', { sessionId: input.sessionId, error: error.message });
    return { ok: false, error: error.message };
  }
}

module.exports = {
  blindTransfer,
  startAttendedTransfer,
  completeAttendedTransfer,
  cancelTransfer,
  failTransfer,
  forceCancelTransfer: async (input) => {
    activeTransfers.delete(input.sessionId);
    require('./transferPolicy').clearTransferAttempts(input.sessionId);
    return { ok: true, cancelled: true };
  },
  resetTransferManagerForTests,
  isTransferActive: (sessionId) => activeTransfers.has(sessionId),
};
