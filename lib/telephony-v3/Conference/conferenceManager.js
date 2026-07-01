const crypto = require('crypto');
const sessionManager = require('../Sessions/sessionManager');
const { DOMAIN_EVENTS } = require('../Events/domainEvents');
const featureFlags = require('../FeatureFlags/featureFlagService');
const { v3Logger } = require('../Utils/v3Logger');
const { metrics } = require('../Utils/metrics');
const { getPrisma } = require('../internal/prisma');
const { evaluateConferencePolicy, POLICY_ACTION } = require('./conferencePolicy');
const { buildConferenceCommands } = require('./conferenceCommandBuilder');
const {
  CONFERENCE_ACTION,
  CONFERENCE_STATUS,
  PARTICIPANT_ROLE,
} = require('./conferenceConstants');
const {
  generateConferenceId,
  conferenceNameFromId,
  getConferenceFromSnapshot,
  buildInitialConferenceState,
  addParticipantToState,
  registerActiveConference,
  unregisterActiveConference,
  isConferenceActive,
  isConferenceTimedOut,
  getParticipants,
} = require('./conferenceState');
const participantManager = require('./conferenceParticipantManager');

/** @type {Set<string>} */
const handledRequests = new Set();

function resetConferenceManagerForTests() {
  handledRequests.clear();
  require('./conferenceState').resetConferenceStateForTests();
  participantManager.resetConferenceParticipantManagerForTests();
}

async function loadSessionWithConference(sessionId, tenantId) {
  const session = await sessionManager.loadSession(sessionId, tenantId);
  const prisma = await getPrisma();
  const row = await prisma.v3CallSession.findUnique({
    where: { id: sessionId },
    select: { routeSnapshot: true },
  });
  const conference = getConferenceFromSnapshot(row?.routeSnapshot);
  return { session, conference, routeSnapshot: row?.routeSnapshot };
}

async function enqueueCommands(commands, session, leg, callControlId, observeOnly) {
  if (observeOnly || !commands.length || !leg) return;
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

/**
 * @param {{
 *   sessionId: string,
 *   tenantId: string,
 *   hostLegId?: string,
 *   hostCallControlId?: string,
 *   requestId?: string,
 *   traceId?: string,
 * }} input
 */
async function createConference(input) {
  const startedMs = Date.now();
  const requestKey = `${input.sessionId}:conf:create:${input.requestId || 'default'}`;
  if (handledRequests.has(requestKey)) {
    return { skipped: true, reason: 'duplicate_request' };
  }
  handledRequests.add(requestKey);

  const flags = await featureFlags.getTenantFlags(input.tenantId);
  if (!flags.conferenceEnabled) {
    return { skipped: true, reason: 'conference_disabled' };
  }

  const session = await sessionManager.loadSession(input.sessionId, input.tenantId);
  const leg = session.legs?.find((l) => l.id === input.hostLegId)
    || session.legs?.find((l) => l.callControlId === input.hostCallControlId)
    || session.legs?.find((l) => l.callControlId === session.primaryCallControlId)
    || session.legs?.[0];

  if (!leg) {
    metrics.conferenceFailed({ reason: 'leg_not_found', action: 'create' });
    return { ok: false, error: 'leg_not_found' };
  }

  if (isConferenceActive(session.id)) {
    return { skipped: true, reason: 'conference_in_progress' };
  }

  const hostCallControlId = input.hostCallControlId || leg.callControlId;
  const conferenceId = generateConferenceId();
  const conferenceName = conferenceNameFromId(conferenceId);
  const eventBase = {
    sessionId: session.id,
    tenantId: session.tenantId,
    correlationId: session.correlationId,
    callControlId: hostCallControlId,
  };

  await participantManager.publishConferenceEvent(eventBase, DOMAIN_EVENTS.CONFERENCE_CREATED, {
    traceId: input.traceId || requestKey,
    conferenceId,
    hostCallControlId,
  });

  try {
    const policy = await evaluateConferencePolicy({
      tenantId: input.tenantId,
      sessionId: session.id,
      action: CONFERENCE_ACTION.CREATE,
      conferenceEnabled: flags.conferenceEnabled,
      observeOnly: flags.observeOnly,
    });

    const commands = buildConferenceCommands({
      action: CONFERENCE_ACTION.CREATE,
      policy,
      callControlId: hostCallControlId,
      conferenceId,
      conferenceName,
      legId: leg.id,
    });

    if (policy.effectiveAction === POLICY_ACTION.DENY) {
      metrics.conferenceFailed({ reason: policy.reason || 'deny', action: 'create' });
      await participantManager.publishConferenceEvent(eventBase, DOMAIN_EVENTS.CONFERENCE_FAILED, {
        policy,
        traceId: input.traceId,
      });
      return { ok: false, policy };
    }

    let conference = buildInitialConferenceState({
      conferenceId,
      conferenceName,
      hostCallControlId,
      hostLegId: leg.id,
      maxParticipants: policy.maxParticipants,
    });

    conference = addParticipantToState(conference, {
      legId: leg.id,
      callControlId: hostCallControlId,
      role: PARTICIPANT_ROLE.HOST,
      muted: false,
    });
    conference.startedAt = new Date().toISOString();

    await participantManager.persistConferenceSnapshot(session.id, conference, session.version);
    registerActiveConference(session.id, conferenceId);

    const timerService = require('../Timer/timerService');
    const cleanupSec = policy.conferenceTimeoutSec ?? 3600;
    await timerService.scheduleTimer(session.id, 'conference-cleanup', cleanupSec).catch(() => {});

    await enqueueCommands(commands, session, leg, hostCallControlId, flags.observeOnly);

    const durationMs = Date.now() - startedMs;
    metrics.conferenceTotal({ result: 'created', action: 'create' });
    metrics.observeConferenceDuration(durationMs, { action: 'create' });

    await participantManager.publishConferenceEvent(eventBase, DOMAIN_EVENTS.CONFERENCE_STARTED, {
      traceId: input.traceId,
      conferenceId,
      durationMs,
      commandsEnqueued: !flags.observeOnly,
    });

    v3Logger.info('conference.created', {
      sessionId: session.id,
      tenantId: session.tenantId,
      conferenceId,
      durationMs,
    });

    return { ok: true, conferenceId, policy };
  } catch (error) {
    metrics.conferenceFailed({ reason: 'error', action: 'create' });
    await participantManager.publishConferenceEvent(eventBase, DOMAIN_EVENTS.CONFERENCE_FAILED, {
      error: error.message,
      traceId: input.traceId,
    });
    return { ok: false, error: error.message };
  }
}

/**
 * @param {{
 *   sessionId: string,
 *   tenantId: string,
 *   primaryCallControlId: string,
 *   secondaryCallControlId: string,
 *   requestId?: string,
 *   traceId?: string,
 * }} input
 */
async function mergeCalls(input) {
  const requestKey = `${input.sessionId}:conf:merge:${input.requestId || 'default'}`;
  if (handledRequests.has(requestKey)) {
    return { skipped: true, reason: 'duplicate_request' };
  }
  handledRequests.add(requestKey);

  const flags = await featureFlags.getTenantFlags(input.tenantId);
  if (!flags.conferenceEnabled) {
    return { skipped: true, reason: 'conference_disabled' };
  }

  const { session, conference } = await loadSessionWithConference(input.sessionId, input.tenantId);
  const leg = session.legs?.find((l) => l.callControlId === input.primaryCallControlId) || session.legs?.[0];

  if (!leg) {
    return { ok: false, error: 'leg_not_found' };
  }

  let conferenceId = conference?.conferenceId;
  let conferenceName = conference?.conferenceName;

  if (!conferenceId) {
    const created = await createConference({
      sessionId: input.sessionId,
      tenantId: input.tenantId,
      hostCallControlId: input.primaryCallControlId,
      requestId: `${input.requestId || 'merge'}-create`,
    });
    if (!created.ok && !created.conferenceId) {
      return created;
    }
    conferenceId = created.conferenceId;
    conferenceName = conferenceNameFromId(conferenceId);
  }

  const eventBase = {
    sessionId: session.id,
    tenantId: session.tenantId,
    correlationId: session.correlationId,
    callControlId: input.primaryCallControlId,
  };

  try {
    const policy = await evaluateConferencePolicy({
      tenantId: input.tenantId,
      sessionId: session.id,
      action: CONFERENCE_ACTION.MERGE,
      conferenceEnabled: flags.conferenceEnabled,
      observeOnly: flags.observeOnly,
      conference: conference || { conferenceId, participants: [] },
    });

    const commands = buildConferenceCommands({
      action: CONFERENCE_ACTION.MERGE,
      policy,
      callControlId: input.primaryCallControlId,
      otherCallControlId: input.secondaryCallControlId,
      conferenceId,
      conferenceName,
    });

    if (policy.effectiveAction === POLICY_ACTION.DENY) {
      return { ok: false, policy };
    }

    await enqueueCommands(commands, session, leg, input.primaryCallControlId, flags.observeOnly);

    await participantManager.joinParticipant({
      sessionId: input.sessionId,
      tenantId: input.tenantId,
      callControlId: input.secondaryCallControlId,
      requestId: `${input.requestId || 'merge'}-join`,
    });

    metrics.conferenceTotal({ result: 'merged', action: 'merge' });

    await participantManager.publishConferenceEvent(eventBase, DOMAIN_EVENTS.CONFERENCE_STARTED, {
      traceId: input.traceId,
      merged: true,
      conferenceId,
    });

    return { ok: true, conferenceId, policy };
  } catch (error) {
    metrics.conferenceFailed({ reason: 'error', action: 'merge' });
    return { ok: false, error: error.message };
  }
}

/**
 * @param {{
 *   sessionId: string,
 *   tenantId: string,
 *   hostCallControlId?: string,
 *   destroyOnHostLeave?: boolean,
 *   requestId?: string,
 *   traceId?: string,
 * }} input
 */
async function hostLeave(input) {
  const { session, conference } = await loadSessionWithConference(input.sessionId, input.tenantId);
  if (!conference) {
    return { ok: false, error: 'conference_not_found' };
  }

  const hostCc = input.hostCallControlId || conference.hostCallControlId;
  const leaveResult = await participantManager.leaveParticipant({
    sessionId: input.sessionId,
    tenantId: input.tenantId,
    callControlId: hostCc,
    requestId: input.requestId,
    traceId: input.traceId,
    isHost: true,
  });

  if (input.destroyOnHostLeave !== false) {
    await destroyConference({
      sessionId: input.sessionId,
      tenantId: input.tenantId,
      requestId: `${input.requestId || 'host-leave'}-destroy`,
      traceId: input.traceId,
    });
  }

  return leaveResult;
}

/**
 * @param {{
 *   sessionId: string,
 *   tenantId: string,
 *   requestId?: string,
 *   traceId?: string,
 * }} input
 */
async function destroyConference(input) {
  const requestKey = `${input.sessionId}:conf:destroy:${input.requestId || 'default'}`;
  if (handledRequests.has(requestKey)) {
    return { skipped: true, reason: 'duplicate_request' };
  }
  handledRequests.add(requestKey);

  const flags = await featureFlags.getTenantFlags(input.tenantId);
  if (!flags.conferenceEnabled) {
    return { skipped: true, reason: 'conference_disabled' };
  }

  const { session, conference } = await loadSessionWithConference(input.sessionId, input.tenantId);
  if (!conference) {
    return { ok: false, error: 'conference_not_found' };
  }

  const leg = session.legs?.find((l) => l.callControlId === conference.hostCallControlId) || session.legs?.[0];
  const eventBase = {
    sessionId: session.id,
    tenantId: session.tenantId,
    correlationId: session.correlationId,
    callControlId: conference.hostCallControlId,
  };

  try {
    const policy = await evaluateConferencePolicy({
      tenantId: input.tenantId,
      sessionId: session.id,
      action: CONFERENCE_ACTION.DESTROY,
      conferenceEnabled: flags.conferenceEnabled,
      observeOnly: flags.observeOnly,
      conference,
    });

    const commands = buildConferenceCommands({
      action: CONFERENCE_ACTION.DESTROY,
      policy,
      callControlId: conference.hostCallControlId,
      conferenceId: conference.conferenceId,
      conferenceName: conference.conferenceName,
    });

    if (policy.effectiveAction === POLICY_ACTION.DENY) {
      return { ok: false, policy };
    }

    await enqueueCommands(commands, session, leg, conference.hostCallControlId, flags.observeOnly);

    await participantManager.persistConferenceSnapshot(session.id, {
      ...conference,
      status: CONFERENCE_STATUS.COMPLETED,
      endedAt: new Date().toISOString(),
      recordingActive: false,
    }, session.version);

    unregisterActiveConference(session.id);
    metrics.conferenceTotal({ result: 'destroyed', action: 'destroy' });

    await participantManager.publishConferenceEvent(eventBase, DOMAIN_EVENTS.CONFERENCE_COMPLETED, {
      traceId: input.traceId,
      conferenceId: conference.conferenceId,
    });

    return { ok: true, policy };
  } catch (error) {
    metrics.conferenceFailed({ reason: 'error', action: 'destroy' });
    return { ok: false, error: error.message };
  }
}

/**
 * @param {{
 *   sessionId: string,
 *   tenantId: string,
 *   requestId?: string,
 *   traceId?: string,
 * }} input
 */
async function startConferenceRecording(input) {
  const requestKey = `${input.sessionId}:conf:rec-start:${input.requestId || 'default'}`;
  if (handledRequests.has(requestKey)) {
    return { skipped: true, reason: 'duplicate_request' };
  }
  handledRequests.add(requestKey);

  const flags = await featureFlags.getTenantFlags(input.tenantId);
  if (!flags.conferenceEnabled) {
    return { skipped: true, reason: 'conference_disabled' };
  }

  const { session, conference } = await loadSessionWithConference(input.sessionId, input.tenantId);
  if (!conference) {
    return { ok: false, error: 'conference_not_found' };
  }

  const leg = session.legs?.find((l) => l.callControlId === conference.hostCallControlId) || session.legs?.[0];
  const eventBase = {
    sessionId: session.id,
    tenantId: session.tenantId,
    correlationId: session.correlationId,
    callControlId: conference.hostCallControlId,
  };

  try {
    const policy = await evaluateConferencePolicy({
      tenantId: input.tenantId,
      sessionId: session.id,
      action: CONFERENCE_ACTION.START_RECORDING,
      conferenceEnabled: flags.conferenceEnabled,
      observeOnly: flags.observeOnly,
      conference,
    });

    const commands = buildConferenceCommands({
      action: CONFERENCE_ACTION.START_RECORDING,
      policy,
      callControlId: conference.hostCallControlId,
      conferenceId: conference.conferenceId,
    });

    if (policy.effectiveAction === POLICY_ACTION.DENY) {
      return { ok: false, policy };
    }

    await participantManager.persistConferenceSnapshot(session.id, {
      ...conference,
      recordingActive: true,
      recordingStartedAt: new Date().toISOString(),
    }, session.version);

    await enqueueCommands(commands, session, leg, conference.hostCallControlId, flags.observeOnly);
    metrics.conferenceRecordingTotal({ result: 'started' });

    await participantManager.publishConferenceEvent(eventBase, DOMAIN_EVENTS.CONFERENCE_RECORDING_STARTED, {
      traceId: input.traceId,
      conferenceId: conference.conferenceId,
    });

    return { ok: true, policy };
  } catch (error) {
    metrics.conferenceFailed({ reason: 'error', action: 'recording_start' });
    return { ok: false, error: error.message };
  }
}

/**
 * @param {{
 *   sessionId: string,
 *   tenantId: string,
 *   requestId?: string,
 *   traceId?: string,
 * }} input
 */
async function stopConferenceRecording(input) {
  const requestKey = `${input.sessionId}:conf:rec-stop:${input.requestId || 'default'}`;
  if (handledRequests.has(requestKey)) {
    return { skipped: true, reason: 'duplicate_request' };
  }
  handledRequests.add(requestKey);

  const flags = await featureFlags.getTenantFlags(input.tenantId);
  if (!flags.conferenceEnabled) {
    return { skipped: true, reason: 'conference_disabled' };
  }

  const { session, conference } = await loadSessionWithConference(input.sessionId, input.tenantId);
  if (!conference) {
    return { ok: false, error: 'conference_not_found' };
  }

  const leg = session.legs?.find((l) => l.callControlId === conference.hostCallControlId) || session.legs?.[0];
  const eventBase = {
    sessionId: session.id,
    tenantId: session.tenantId,
    correlationId: session.correlationId,
    callControlId: conference.hostCallControlId,
  };

  try {
    const policy = await evaluateConferencePolicy({
      tenantId: input.tenantId,
      sessionId: session.id,
      action: CONFERENCE_ACTION.STOP_RECORDING,
      conferenceEnabled: flags.conferenceEnabled,
      observeOnly: flags.observeOnly,
      conference,
    });

    const commands = buildConferenceCommands({
      action: CONFERENCE_ACTION.STOP_RECORDING,
      policy,
      callControlId: conference.hostCallControlId,
      conferenceId: conference.conferenceId,
    });

    if (policy.effectiveAction === POLICY_ACTION.DENY) {
      return { ok: false, policy };
    }

    await participantManager.persistConferenceSnapshot(session.id, {
      ...conference,
      recordingActive: false,
      recordingStoppedAt: new Date().toISOString(),
    }, session.version);

    await enqueueCommands(commands, session, leg, conference.hostCallControlId, flags.observeOnly);
    metrics.conferenceRecordingTotal({ result: 'stopped' });

    await participantManager.publishConferenceEvent(eventBase, DOMAIN_EVENTS.CONFERENCE_RECORDING_STOPPED, {
      traceId: input.traceId,
      conferenceId: conference.conferenceId,
    });

    return { ok: true, policy };
  } catch (error) {
    return { ok: false, error: error.message };
  }
}

/**
 * Automatic cleanup on timeout or empty conference.
 *
 * @param {{
 *   sessionId: string,
 *   tenantId: string,
 *   requestId?: string,
 *   traceId?: string,
 *   conferenceTimeoutSec?: number,
 * }} input
 */
async function cleanupConference(input) {
  const flags = await featureFlags.getTenantFlags(input.tenantId);
  const timeoutSec = input.conferenceTimeoutSec ?? 3600;

  if (isConferenceTimedOut(input.sessionId, timeoutSec)) {
    v3Logger.info('conference.timeout', { sessionId: input.sessionId, timeoutSec });
    return destroyConference({
      sessionId: input.sessionId,
      tenantId: input.tenantId,
      requestId: input.requestId || 'cleanup-timeout',
      traceId: input.traceId,
    });
  }

  const { session, conference } = await loadSessionWithConference(input.sessionId, input.tenantId);
  if (!conference) {
    return { skipped: true, reason: 'no_conference' };
  }

  const activeParticipants = getParticipants(conference).filter((p) => !p.leftAt);
  if (activeParticipants.length === 0) {
    return destroyConference({
      sessionId: input.sessionId,
      tenantId: input.tenantId,
      requestId: input.requestId || 'cleanup-empty',
      traceId: input.traceId,
    });
  }

  if (flags.observeOnly) {
    return { ok: true, reason: 'observe_only_no_cleanup_commands' };
  }

  const policy = await evaluateConferencePolicy({
    tenantId: input.tenantId,
    sessionId: session.id,
    action: CONFERENCE_ACTION.CLEANUP,
    conferenceEnabled: flags.conferenceEnabled,
    observeOnly: flags.observeOnly,
    conference,
  });

  const commands = buildConferenceCommands({
    action: CONFERENCE_ACTION.CLEANUP,
    policy,
    callControlId: conference.hostCallControlId,
    conferenceId: conference.conferenceId,
    conferenceName: conference.conferenceName,
  });

  const leg = session.legs?.[0];
  await enqueueCommands(commands, session, leg, conference.hostCallControlId, flags.observeOnly);

  return { ok: true, cleaned: true };
}

module.exports = {
  createConference,
  mergeCalls,
  hostLeave,
  destroyConference,
  startConferenceRecording,
  stopConferenceRecording,
  cleanupConference,
  resetConferenceManagerForTests,
  isConferenceActive: (sessionId) => isConferenceActive(sessionId),
  joinParticipant: participantManager.joinParticipant,
  leaveParticipant: participantManager.leaveParticipant,
  removeParticipant: participantManager.removeParticipant,
  muteParticipant: participantManager.muteParticipant,
  unmuteParticipant: participantManager.unmuteParticipant,
};
