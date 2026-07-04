const crypto = require('crypto');
const sessionManager = require('../Sessions/sessionManager');
const eventBus = require('../Events/domainEventBus');
const { DOMAIN_EVENTS } = require('../Events/domainEvents');
const featureFlags = require('../FeatureFlags/featureFlagService');
const { v3Logger } = require('../Utils/v3Logger');
const { metrics } = require('../Utils/metrics');
const { getPrisma } = require('../internal/prisma');
const {
  evaluateRecordingPolicy,
  recordRecordingRetry,
  clearRecordingRetries,
  POLICY_ACTION,
} = require('./recordingPolicy');
const { buildRecordingCommands } = require('./recordingCommandBuilder');
const { RECORDING_MODE, RECORDING_ACTION, RECORDING_ELIGIBLE_LEG_STATES } = require('./recordingConstants');

/** @type {Set<string>} */
const activeRecordings = new Set();
/** @type {Set<string>} */
const handledRequests = new Set();

function resetRecordingManagerForTests() {
  activeRecordings.clear();
  handledRequests.clear();
}

/**
 * @param {string} sessionId
 * @param {Record<string, unknown>} patch
 * @param {number} version
 */
async function persistRecordingSnapshot(sessionId, patch, version) {
  const prisma = await getPrisma();
  const row = await prisma.v3CallSession.findUnique({
    where: { id: sessionId },
    select: { routeSnapshot: true },
  });
  const snapshot = {
    ...(row?.routeSnapshot && typeof row.routeSnapshot === 'object' ? row.routeSnapshot : {}),
    recording: {
      ...(row?.routeSnapshot?.recording || {}),
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
async function publishRecordingEvent(base, eventType, payload) {
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
 * @param {import('../types').V3LegRecord|undefined} legInput
 */
function resolveRecordingLeg(session, legInput) {
  if (legInput) return legInput;
  return session.legs?.find((l) => RECORDING_ELIGIBLE_LEG_STATES.has(l.state))
    || session.legs?.find((l) => l.callControlId === session.primaryCallControlId)
    || session.legs?.[0];
}

/**
 * @param {{
 *   sessionId: string,
 *   tenantId: string,
 *   legId?: string,
 *   callControlId?: string,
 *   requestId?: string,
 *   traceId?: string,
 *   mode?: string,
 * }} input
 */
async function startRecording(input) {
  const startedMs = Date.now();
  const mode = input.mode || RECORDING_MODE.MANUAL;
  const requestKey = `${input.sessionId}:recording:start:${input.requestId || 'default'}`;
  if (handledRequests.has(requestKey)) {
    return { skipped: true, reason: 'duplicate_request' };
  }
  handledRequests.add(requestKey);

  const session = await sessionManager.loadSession(input.sessionId, input.tenantId);
  const leg = resolveRecordingLeg(
    session,
    session.legs?.find((l) => l.id === input.legId)
      || session.legs?.find((l) => l.callControlId === input.callControlId),
  );

  if (!leg) {
    metrics.recordingFailed({ reason: 'leg_not_found', mode });
    await publishRecordingEvent(
      { sessionId: input.sessionId, tenantId: input.tenantId, correlationId: session.correlationId },
      DOMAIN_EVENTS.RECORDING_FAILED,
      { traceId: input.traceId, error: 'leg_not_found', mode },
    );
    return { ok: false, error: 'leg_not_found' };
  }

  const flags = await featureFlags.getTenantFlags(input.tenantId);
  if (!flags.recordingEnabled) {
    return { skipped: true, reason: 'recording_disabled' };
  }

  const callControlId = input.callControlId || leg.callControlId;
  const eventBase = {
    sessionId: session.id,
    tenantId: session.tenantId,
    correlationId: session.correlationId,
    callControlId,
  };

  await publishRecordingEvent(eventBase, DOMAIN_EVENTS.RECORDING_STARTED, {
    traceId: input.traceId || requestKey,
    legId: leg.id,
    mode,
    sessionState: session.state,
    legState: leg.state,
  });

  try {
    if (activeRecordings.has(session.id)) {
      return { skipped: true, reason: 'recording_in_progress' };
    }

    const policy = await evaluateRecordingPolicy({
      tenantId: input.tenantId,
      sessionId: session.id,
      sessionState: session.state,
      legState: leg.state,
      direction: session.direction || leg.direction,
      mode,
      recordingEnabled: flags.recordingEnabled,
      observeOnly: flags.observeOnly,
    });

    const commands = buildRecordingCommands({
      callControlId,
      legId: leg.id,
      policy,
      mode,
      action: RECORDING_ACTION.START,
    });

    if (policy.effectiveAction === POLICY_ACTION.DENY) {
      await publishRecordingEvent(eventBase, DOMAIN_EVENTS.RECORDING_FAILED, {
        traceId: input.traceId,
        policy,
        mode,
      });
      metrics.recordingFailed({ reason: policy.reason || 'deny', mode });
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

    await persistRecordingSnapshot(session.id, {
      recordingActive: true,
      mode,
      startedAt: new Date().toISOString(),
      legId: leg.id,
      callControlId,
      retentionDays: policy.retentionDays ?? 90,
    }, session.version);

    activeRecordings.add(session.id);

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
    metrics.recordingTotal({ result: 'started', mode });
    metrics.observeRecordingDuration(durationMs, { action: 'start', mode });

    await publishRecordingEvent(eventBase, DOMAIN_EVENTS.RECORDING_COMPLETED, {
      traceId: input.traceId,
      mode,
      durationMs,
      commandsEnqueued: !flags.observeOnly,
      retentionDays: policy.retentionDays,
    });

    v3Logger.info('recording.started', {
      sessionId: session.id,
      tenantId: session.tenantId,
      legId: leg.id,
      mode,
      durationMs,
    });

    return { ok: true, policy, mode };
  } catch (error) {
    recordRecordingRetry(session.id);
    metrics.recordingFailed({ reason: 'error', mode });
    await publishRecordingEvent(eventBase, DOMAIN_EVENTS.RECORDING_FAILED, {
      traceId: input.traceId,
      error: error.message,
      mode,
      retryCount: (await evaluateRecordingPolicy({
        tenantId: input.tenantId,
        sessionId: session.id,
        sessionState: session.state,
        legState: leg.state,
        recordingEnabled: flags.recordingEnabled,
        mode,
      })).retryCount,
    });
    v3Logger.error('recording.failed', { sessionId: input.sessionId, error: error.message });
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
async function startAutomaticRecording(input) {
  return startRecording({ ...input, mode: RECORDING_MODE.AUTOMATIC });
}

/**
 * @param {{
 *   sessionId: string,
 *   tenantId: string,
 *   legId?: string,
 *   callControlId?: string,
 *   requestId?: string,
 *   traceId?: string,
 *   recordingUrl?: string|null,
 *   recordingSid?: string|null,
 *   durationSeconds?: number|null,
 * }} input
 */
async function stopRecording(input) {
  const startedMs = Date.now();
  const requestKey = `${input.sessionId}:recording:stop:${input.requestId || 'default'}`;
  if (handledRequests.has(requestKey)) {
    return { skipped: true, reason: 'duplicate_request' };
  }
  handledRequests.add(requestKey);

  const session = await sessionManager.loadSession(input.sessionId, input.tenantId);
  const leg = resolveRecordingLeg(
    session,
    session.legs?.find((l) => l.id === input.legId)
      || session.legs?.find((l) => l.callControlId === input.callControlId),
  );

  if (!leg) {
    return { ok: false, error: 'leg_not_found' };
  }

  const flags = await featureFlags.getTenantFlags(input.tenantId);
  if (!flags.recordingEnabled) {
    return { skipped: true, reason: 'recording_disabled' };
  }

  const callControlId = input.callControlId || leg.callControlId;
  const eventBase = {
    sessionId: session.id,
    tenantId: session.tenantId,
    correlationId: session.correlationId,
    callControlId,
  };

  try {
    const policy = await evaluateRecordingPolicy({
      tenantId: input.tenantId,
      sessionId: session.id,
      sessionState: session.state,
      legState: leg.state,
      direction: session.direction || leg.direction,
      mode: RECORDING_MODE.MANUAL,
      recordingEnabled: flags.recordingEnabled,
      observeOnly: flags.observeOnly,
      action: RECORDING_ACTION.STOP,
    });

    const commands = buildRecordingCommands({
      callControlId,
      legId: leg.id,
      policy,
      action: RECORDING_ACTION.STOP,
    });

    if (policy.effectiveAction === POLICY_ACTION.DENY) {
      metrics.recordingFailed({ reason: policy.reason || 'deny', mode: 'stop' });
      return { ok: false, policy };
    }

    await persistRecordingSnapshot(session.id, {
      recordingActive: false,
      stoppedAt: new Date().toISOString(),
      recordingUrl: input.recordingUrl ?? null,
      recordingSid: input.recordingSid ?? null,
      durationSeconds: input.durationSeconds ?? null,
    }, session.version);

    activeRecordings.delete(session.id);
    clearRecordingRetries(session.id);

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
    metrics.recordingTotal({ result: 'stopped', mode: 'stop' });
    metrics.observeRecordingDuration(durationMs, { action: 'stop' });

    await publishRecordingEvent(eventBase, DOMAIN_EVENTS.RECORDING_STOPPED, {
      traceId: input.traceId,
      durationMs,
      recordingUrl: input.recordingUrl ?? null,
      recordingSid: input.recordingSid ?? null,
      commandsEnqueued: !flags.observeOnly,
    });

    v3Logger.info('recording.stopped', {
      sessionId: session.id,
      tenantId: session.tenantId,
      durationMs,
    });

    return { ok: true, policy };
  } catch (error) {
    metrics.recordingFailed({ reason: 'error', mode: 'stop' });
    await publishRecordingEvent(eventBase, DOMAIN_EVENTS.RECORDING_FAILED, {
      traceId: input.traceId,
      error: error.message,
    });
    return { ok: false, error: error.message };
  }
}

/**
 * Retry recording after failure (within policy limits).
 *
 * @param {Parameters<typeof startRecording>[0]} input
 */
async function retryRecording(input) {
  recordRecordingRetry(input.sessionId);
  return startRecording({ ...input, requestId: `${input.requestId || 'retry'}-${Date.now()}` });
}

module.exports = {
  startRecording,
  startAutomaticRecording,
  stopRecording,
  retryRecording,
  resetRecordingManagerForTests,
  isRecordingActive: (sessionId) => activeRecordings.has(sessionId),
};
