const crypto = require('crypto');
const sessionManager = require('../Sessions/sessionManager');
const legManager = require('../Sessions/legManager');
const eventBus = require('../Events/domainEventBus');
const { DOMAIN_EVENTS } = require('../Events/domainEvents');
const featureFlags = require('../FeatureFlags/featureFlagService');
const { resolveSessionTransition } = require('../StateMachine/sessionTransitions');
const { resolveLegTransition } = require('../StateMachine/legTransitions');
const { v3Logger } = require('../Utils/v3Logger');
const { metrics } = require('../Utils/metrics');
const { getPrisma } = require('../internal/prisma');
const { evaluateHoldPolicy, isHoldEligibleState, isResumeEligibleState, POLICY_ACTION } = require('./holdPolicy');
const { buildHoldCommands, buildResumeCommands } = require('./holdCommandBuilder');
const { HOLD_ACTION } = require('./holdTransferConstants');

/** @type {Set<string>} */
const activeHolds = new Set();
/** @type {Set<string>} */
const handledRequests = new Set();

function resetHoldManagerForTests() {
  activeHolds.clear();
  handledRequests.clear();
}

/**
 * @param {string} sessionId
 * @param {Record<string, unknown>} patch
 * @param {number} version
 */
async function persistHoldSnapshot(sessionId, patch, version) {
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

/**
 * @param {import('../types').V3DomainEvent} base
 * @param {string} eventType
 * @param {Record<string, unknown>} payload
 */
async function publishHoldEvent(base, eventType, payload) {
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

/**
 * @param {import('../types').V3SessionRecord} session
 * @param {import('../types').V3LegRecord} leg
 * @param {string} sessionTrigger
 * @param {string} legTrigger
 * @param {string} eventId
 */
async function applyHoldFsm(session, leg, sessionTrigger, legTrigger, eventId) {
  const sessionTo = resolveSessionTransition(session.state, sessionTrigger);
  const legTo = resolveLegTransition(leg.state, legTrigger);

  if (!sessionTo) {
    throw new Error(`invalid_session_transition:${session.state}:${sessionTrigger}`);
  }
  if (!legTo) {
    throw new Error(`invalid_leg_transition:${leg.state}:${legTrigger}`);
  }

  const updatedSession = await sessionManager.persistSessionTransition(
    session.id,
    session.version,
    { state: sessionTo },
    { fromState: session.state, toState: sessionTo, triggerEvent: sessionTrigger, eventId },
    session.tenantId,
  );

  await legManager.persistLegTransition(
    leg.id,
    leg.version,
    { state: legTo },
    { fromState: leg.state, toState: legTo, triggerEvent: legTrigger, eventId },
  );

  return { sessionState: sessionTo, legState: legTo, updatedSession };
}

/**
 * @param {{
 *   sessionId: string,
 *   tenantId: string,
 *   legId?: string,
 *   callControlId?: string,
 *   requestId?: string,
 *   traceId?: string,
 * }} input
 */
async function startHold(input) {
  const startedMs = Date.now();
  const requestKey = `${input.sessionId}:hold:${input.requestId || 'default'}`;
  if (handledRequests.has(requestKey)) {
    return { skipped: true, reason: 'duplicate_request' };
  }
  handledRequests.add(requestKey);

  const session = await sessionManager.loadSession(input.sessionId, input.tenantId);
  const leg = session.legs?.find((l) => l.id === input.legId)
    || session.legs?.find((l) => l.callControlId === input.callControlId)
    || session.legs?.find((l) => l.callControlId === session.primaryCallControlId);

  if (!leg) {
    await publishHoldEvent(
      { sessionId: input.sessionId, tenantId: input.tenantId, correlationId: session.correlationId },
      DOMAIN_EVENTS.HOLD_FAILED,
      { traceId: input.traceId, error: 'leg_not_found' },
    );
    metrics.holdFailed({ reason: 'leg_not_found' });
    return { ok: false, error: 'leg_not_found' };
  }

  const flags = await featureFlags.getTenantFlags(input.tenantId);
  if (!flags.holdEnabled) {
    return { skipped: true, reason: 'hold_disabled' };
  }

  const callControlId = input.callControlId || leg.callControlId;
  const eventBase = {
    sessionId: session.id,
    tenantId: session.tenantId,
    correlationId: session.correlationId,
    callControlId,
  };

  await publishHoldEvent(eventBase, DOMAIN_EVENTS.HOLD_STARTED, {
    traceId: input.traceId || requestKey,
    legId: leg.id,
    sessionState: session.state,
  });

  try {
    if (!isHoldEligibleState(session.state)) {
      throw new Error(`hold_not_allowed_in_${session.state}`);
    }
    if (activeHolds.has(session.id)) {
      return { skipped: true, reason: 'already_on_hold' };
    }

    const policy = evaluateHoldPolicy({
      tenantId: input.tenantId,
      sessionState: session.state,
      holdEnabled: flags.holdEnabled,
      observeOnly: flags.observeOnly,
      action: HOLD_ACTION.START,
    });

    const commands = buildHoldCommands({ callControlId, legId: leg.id, policy });

    if (policy.effectiveAction === POLICY_ACTION.DENY) {
      await publishHoldEvent(eventBase, DOMAIN_EVENTS.HOLD_FAILED, {
        traceId: input.traceId,
        policy,
      });
      metrics.holdFailed({ reason: policy.reason || 'deny' });
      if (!flags.observeOnly && commands.length) {
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
      return { ok: false, policy };
    }

    const fsm = await applyHoldFsm(session, leg, 'hold.started', 'hold.started', requestKey);
    await persistHoldSnapshot(session.id, {
      holdActive: true,
      heldAt: new Date().toISOString(),
      legId: leg.id,
      callControlId,
    }, fsm.updatedSession.version);

    activeHolds.add(session.id);

    if (!flags.observeOnly && commands.length) {
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
    metrics.holdTotal({ result: 'started' });
    metrics.observeHoldDuration(durationMs, { action: 'start' });

    await publishHoldEvent(eventBase, DOMAIN_EVENTS.HOLD_COMPLETED, {
      traceId: input.traceId,
      fsm,
      durationMs,
      commandsEnqueued: !flags.observeOnly,
    });

    v3Logger.info('hold.completed', {
      sessionId: session.id,
      tenantId: session.tenantId,
      legId: leg.id,
      durationMs,
    });

    return { ok: true, fsm, policy };
  } catch (error) {
    metrics.holdFailed({ reason: 'error' });
    await publishHoldEvent(eventBase, DOMAIN_EVENTS.HOLD_FAILED, {
      traceId: input.traceId,
      error: error.message,
    });
    v3Logger.error('hold.failed', { sessionId: input.sessionId, error: error.message });
    return { ok: false, error: error.message };
  }
}

/**
 * @param {{
 *   sessionId: string,
 *   tenantId: string,
 *   legId?: string,
 *   callControlId?: string,
 *   requestId?: string,
 *   traceId?: string,
 * }} input
 */
async function resumeHold(input) {
  const startedMs = Date.now();
  const requestKey = `${input.sessionId}:resume:${input.requestId || 'default'}`;
  if (handledRequests.has(requestKey)) {
    return { skipped: true, reason: 'duplicate_request' };
  }
  handledRequests.add(requestKey);

  const session = await sessionManager.loadSession(input.sessionId, input.tenantId);
  const leg = session.legs?.find((l) => l.id === input.legId)
    || session.legs?.find((l) => l.callControlId === input.callControlId)
    || session.legs?.[0];

  if (!leg) {
    return { ok: false, error: 'leg_not_found' };
  }

  const flags = await featureFlags.getTenantFlags(input.tenantId);
  if (!flags.holdEnabled) {
    return { skipped: true, reason: 'hold_disabled' };
  }

  const callControlId = input.callControlId || leg.callControlId;
  const eventBase = {
    sessionId: session.id,
    tenantId: session.tenantId,
    correlationId: session.correlationId,
    callControlId,
  };

  try {
    if (!isResumeEligibleState(session.state)) {
      throw new Error(`resume_not_allowed_in_${session.state}`);
    }

    const policy = evaluateHoldPolicy({
      tenantId: input.tenantId,
      sessionState: session.state,
      holdEnabled: flags.holdEnabled,
      observeOnly: flags.observeOnly,
      action: HOLD_ACTION.RESUME,
    });

    const commands = buildResumeCommands({ callControlId, legId: leg.id, policy });

    if (policy.effectiveAction === POLICY_ACTION.DENY) {
      metrics.holdFailed({ reason: policy.reason || 'deny' });
      return { ok: false, policy };
    }

    const fsm = await applyHoldFsm(session, leg, 'hold.ended', 'hold.ended', requestKey);
    await persistHoldSnapshot(session.id, { holdActive: false, resumedAt: new Date().toISOString() }, fsm.updatedSession.version);
    activeHolds.delete(session.id);

    if (!flags.observeOnly && commands.length) {
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

    metrics.holdTotal({ result: 'resumed' });
    metrics.observeHoldDuration(Date.now() - startedMs, { action: 'resume' });

    await publishHoldEvent(eventBase, DOMAIN_EVENTS.HOLD_RESUMED, {
      traceId: input.traceId,
      fsm,
      commandsEnqueued: !flags.observeOnly,
    });

    return { ok: true, fsm, policy };
  } catch (error) {
    metrics.holdFailed({ reason: 'error' });
    await publishHoldEvent(eventBase, DOMAIN_EVENTS.HOLD_FAILED, {
      traceId: input.traceId,
      error: error.message,
    });
    return { ok: false, error: error.message };
  }
}

module.exports = {
  startHold,
  resumeHold,
  forceReleaseHold: async (input) => {
    activeHolds.delete(input.sessionId);
    return { ok: true, released: true };
  },
  resetHoldManagerForTests,
  isOnHold: (sessionId) => activeHolds.has(sessionId),
};
