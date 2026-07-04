const crypto = require('crypto');
const sessionManager = require('../Sessions/sessionManager');
const eventBus = require('../Events/domainEventBus');
const { DOMAIN_EVENTS } = require('../Events/domainEvents');
const featureFlags = require('../FeatureFlags/featureFlagService');
const { v3Logger } = require('../Utils/v3Logger');
const { metrics } = require('../Utils/metrics');
const { getPrisma } = require('../internal/prisma');
const { evaluateConferencePolicy, POLICY_ACTION } = require('./conferencePolicy');
const { buildConferenceCommands } = require('./conferenceCommandBuilder');
const { CONFERENCE_ACTION, PARTICIPANT_ROLE, CONFERENCE_STATUS } = require('./conferenceConstants');
const {
  getConferenceFromSnapshot,
  findParticipant,
  findHost,
  addParticipantToState,
  markParticipantLeft,
  setParticipantMuted,
} = require('./conferenceState');

/** @type {Set<string>} */
const handledRequests = new Set();

function resetConferenceParticipantManagerForTests() {
  handledRequests.clear();
}

/**
 * @param {string} sessionId
 * @param {Record<string, unknown>} patch
 * @param {number} version
 */
async function persistConferenceSnapshot(sessionId, conferencePatch, version) {
  const prisma = await getPrisma();
  const row = await prisma.v3CallSession.findUnique({
    where: { id: sessionId },
    select: { routeSnapshot: true },
  });
  const existing = getConferenceFromSnapshot(row?.routeSnapshot);
  const snapshot = {
    ...(row?.routeSnapshot && typeof row.routeSnapshot === 'object' ? row.routeSnapshot : {}),
    conference: {
      ...(existing || {}),
      ...conferencePatch,
    },
  };
  await prisma.v3CallSession.updateMany({
    where: { id: sessionId, version },
    data: { routeSnapshot: snapshot, version: { increment: 1 }, updatedAt: new Date() },
  });
  return snapshot.conference;
}

async function publishConferenceEvent(base, eventType, payload) {
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

async function loadConferenceContext(sessionId, tenantId) {
  const session = await sessionManager.loadSession(sessionId, tenantId);
  const row = await (async () => {
    const prisma = await getPrisma();
    return prisma.v3CallSession.findUnique({
      where: { id: sessionId },
      select: { routeSnapshot: true },
    });
  })();
  const conference = getConferenceFromSnapshot(row?.routeSnapshot);
  return { session, conference };
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
 *   legId?: string,
 *   callControlId: string,
 *   role?: string,
 *   requestId?: string,
 *   traceId?: string,
 * }} input
 */
async function joinParticipant(input) {
  const requestKey = `${input.sessionId}:conf:join:${input.requestId || 'default'}`;
  if (handledRequests.has(requestKey)) {
    return { skipped: true, reason: 'duplicate_request' };
  }
  handledRequests.add(requestKey);

  const flags = await featureFlags.getTenantFlags(input.tenantId);
  if (!flags.conferenceEnabled) {
    return { skipped: true, reason: 'conference_disabled' };
  }

  const { session, conference } = await loadConferenceContext(input.sessionId, input.tenantId);
  if (!conference) {
    return { ok: false, error: 'conference_not_found' };
  }

  const leg = session.legs?.find((l) => l.id === input.legId)
    || session.legs?.find((l) => l.callControlId === input.callControlId)
    || session.legs?.[0];

  const eventBase = {
    sessionId: session.id,
    tenantId: session.tenantId,
    correlationId: session.correlationId,
    callControlId: input.callControlId,
  };

  try {
    const policy = await evaluateConferencePolicy({
      tenantId: input.tenantId,
      sessionId: session.id,
      action: CONFERENCE_ACTION.JOIN,
      conferenceEnabled: flags.conferenceEnabled,
      observeOnly: flags.observeOnly,
      conference,
      participantCallControlId: input.callControlId,
    });

    const commands = buildConferenceCommands({
      action: CONFERENCE_ACTION.JOIN,
      policy,
      callControlId: conference.hostCallControlId,
      participantCallControlId: input.callControlId,
      conferenceId: conference.conferenceId,
      conferenceName: conference.conferenceName,
      legId: leg?.id,
    });

    if (policy.effectiveAction === POLICY_ACTION.DENY) {
      metrics.conferenceFailed({ reason: policy.reason || 'deny', action: 'join' });
      await publishConferenceEvent(eventBase, DOMAIN_EVENTS.CONFERENCE_FAILED, { policy, traceId: input.traceId });
      return { ok: false, policy };
    }

    const updatedConference = addParticipantToState(conference, {
      legId: leg?.id,
      callControlId: input.callControlId,
      role: input.role || PARTICIPANT_ROLE.PARTICIPANT,
      muted: false,
    });

    await persistConferenceSnapshot(session.id, updatedConference, session.version);
    metrics.conferenceParticipants({ action: 'join' });

    await enqueueCommands(commands, session, leg, input.callControlId, flags.observeOnly);

    await publishConferenceEvent(eventBase, DOMAIN_EVENTS.CONFERENCE_PARTICIPANT_JOINED, {
      traceId: input.traceId,
      callControlId: input.callControlId,
      role: input.role || PARTICIPANT_ROLE.PARTICIPANT,
      commandsEnqueued: !flags.observeOnly,
    });

    v3Logger.info('conference.participant_joined', {
      sessionId: session.id,
      callControlId: input.callControlId,
    });

    return { ok: true, policy };
  } catch (error) {
    metrics.conferenceFailed({ reason: 'error', action: 'join' });
    await publishConferenceEvent(eventBase, DOMAIN_EVENTS.CONFERENCE_FAILED, { error: error.message });
    return { ok: false, error: error.message };
  }
}

/**
 * @param {{
 *   sessionId: string,
 *   tenantId: string,
 *   callControlId: string,
 *   requestId?: string,
 *   traceId?: string,
 *   isHost?: boolean,
 * }} input
 */
async function leaveParticipant(input) {
  const requestKey = `${input.sessionId}:conf:leave:${input.requestId || 'default'}`;
  if (handledRequests.has(requestKey)) {
    return { skipped: true, reason: 'duplicate_request' };
  }
  handledRequests.add(requestKey);

  const flags = await featureFlags.getTenantFlags(input.tenantId);
  if (!flags.conferenceEnabled) {
    return { skipped: true, reason: 'conference_disabled' };
  }

  const { session, conference } = await loadConferenceContext(input.sessionId, input.tenantId);
  if (!conference) {
    return { ok: false, error: 'conference_not_found' };
  }

  const participant = findParticipant(conference, input.callControlId);
  const host = findHost(conference);
  const isHost = input.isHost || host?.callControlId === input.callControlId;

  const leg = session.legs?.find((l) => l.callControlId === input.callControlId) || session.legs?.[0];
  const eventBase = {
    sessionId: session.id,
    tenantId: session.tenantId,
    correlationId: session.correlationId,
    callControlId: input.callControlId,
  };

  try {
    const policy = await evaluateConferencePolicy({
      tenantId: input.tenantId,
      sessionId: session.id,
      action: CONFERENCE_ACTION.LEAVE,
      conferenceEnabled: flags.conferenceEnabled,
      observeOnly: flags.observeOnly,
      conference,
      isHost,
    });

    const commands = buildConferenceCommands({
      action: CONFERENCE_ACTION.LEAVE,
      policy,
      callControlId: conference.hostCallControlId,
      participantCallControlId: input.callControlId,
      conferenceId: conference.conferenceId,
    });

    if (policy.effectiveAction === POLICY_ACTION.DENY) {
      return { ok: false, policy };
    }

    let updatedConference = markParticipantLeft(conference, input.callControlId);
    await persistConferenceSnapshot(session.id, updatedConference, session.version);
    metrics.conferenceParticipants({ action: 'leave' });

    await enqueueCommands(commands, session, leg, input.callControlId, flags.observeOnly);

    await publishConferenceEvent(eventBase, DOMAIN_EVENTS.CONFERENCE_PARTICIPANT_LEFT, {
      traceId: input.traceId,
      callControlId: input.callControlId,
      isHost,
      commandsEnqueued: !flags.observeOnly,
    });

    return { ok: true, isHost, policy };
  } catch (error) {
    metrics.conferenceFailed({ reason: 'error', action: 'leave' });
    return { ok: false, error: error.message };
  }
}

/**
 * @param {{
 *   sessionId: string,
 *   tenantId: string,
 *   callControlId: string,
 *   requestId?: string,
 *   traceId?: string,
 * }} input
 */
async function removeParticipant(input) {
  const requestKey = `${input.sessionId}:conf:remove:${input.requestId || 'default'}`;
  if (handledRequests.has(requestKey)) {
    return { skipped: true, reason: 'duplicate_request' };
  }
  handledRequests.add(requestKey);

  const flags = await featureFlags.getTenantFlags(input.tenantId);
  if (!flags.conferenceEnabled) {
    return { skipped: true, reason: 'conference_disabled' };
  }

  const { session, conference } = await loadConferenceContext(input.sessionId, input.tenantId);
  if (!conference) {
    return { ok: false, error: 'conference_not_found' };
  }

  const leg = session.legs?.find((l) => l.callControlId === input.callControlId) || session.legs?.[0];
  const eventBase = {
    sessionId: session.id,
    tenantId: session.tenantId,
    correlationId: session.correlationId,
    callControlId: input.callControlId,
  };

  try {
    const policy = await evaluateConferencePolicy({
      tenantId: input.tenantId,
      sessionId: session.id,
      action: CONFERENCE_ACTION.REMOVE,
      conferenceEnabled: flags.conferenceEnabled,
      observeOnly: flags.observeOnly,
      conference,
    });

    const commands = buildConferenceCommands({
      action: CONFERENCE_ACTION.REMOVE,
      policy,
      callControlId: conference.hostCallControlId,
      participantCallControlId: input.callControlId,
      conferenceId: conference.conferenceId,
    });

    if (policy.effectiveAction === POLICY_ACTION.DENY) {
      return { ok: false, policy };
    }

    const updatedConference = markParticipantLeft(conference, input.callControlId, { removed: true });
    await persistConferenceSnapshot(session.id, updatedConference, session.version);
    metrics.conferenceParticipants({ action: 'remove' });

    await enqueueCommands(commands, session, leg, input.callControlId, flags.observeOnly);

    await publishConferenceEvent(eventBase, DOMAIN_EVENTS.CONFERENCE_PARTICIPANT_LEFT, {
      traceId: input.traceId,
      callControlId: input.callControlId,
      removed: true,
    });

    return { ok: true, policy };
  } catch (error) {
    metrics.conferenceFailed({ reason: 'error', action: 'remove' });
    return { ok: false, error: error.message };
  }
}

/**
 * @param {{
 *   sessionId: string,
 *   tenantId: string,
 *   callControlId: string,
 *   requestId?: string,
 *   traceId?: string,
 * }} input
 */
async function muteParticipant(input) {
  const requestKey = `${input.sessionId}:conf:mute:${input.requestId || 'default'}`;
  if (handledRequests.has(requestKey)) {
    return { skipped: true, reason: 'duplicate_request' };
  }
  handledRequests.add(requestKey);

  const flags = await featureFlags.getTenantFlags(input.tenantId);
  if (!flags.conferenceEnabled) {
    return { skipped: true, reason: 'conference_disabled' };
  }

  const { session, conference } = await loadConferenceContext(input.sessionId, input.tenantId);
  if (!conference || !findParticipant(conference, input.callControlId)) {
    return { ok: false, error: 'participant_not_found' };
  }

  const leg = session.legs?.find((l) => l.callControlId === input.callControlId) || session.legs?.[0];
  const eventBase = {
    sessionId: session.id,
    tenantId: session.tenantId,
    correlationId: session.correlationId,
    callControlId: input.callControlId,
  };

  try {
    const policy = await evaluateConferencePolicy({
      tenantId: input.tenantId,
      sessionId: session.id,
      action: CONFERENCE_ACTION.MUTE,
      conferenceEnabled: flags.conferenceEnabled,
      observeOnly: flags.observeOnly,
      conference,
    });

    const commands = buildConferenceCommands({
      action: CONFERENCE_ACTION.MUTE,
      policy,
      callControlId: conference.hostCallControlId,
      participantCallControlId: input.callControlId,
      conferenceId: conference.conferenceId,
    });

    if (policy.effectiveAction === POLICY_ACTION.DENY) {
      return { ok: false, policy };
    }

    const updatedConference = setParticipantMuted(conference, input.callControlId, true);
    await persistConferenceSnapshot(session.id, updatedConference, session.version);

    await enqueueCommands(commands, session, leg, input.callControlId, flags.observeOnly);

    await publishConferenceEvent(eventBase, DOMAIN_EVENTS.CONFERENCE_PARTICIPANT_MUTED, {
      traceId: input.traceId,
      callControlId: input.callControlId,
    });

    return { ok: true, policy };
  } catch (error) {
    return { ok: false, error: error.message };
  }
}

/**
 * @param {{
 *   sessionId: string,
 *   tenantId: string,
 *   callControlId: string,
 *   requestId?: string,
 *   traceId?: string,
 * }} input
 */
async function unmuteParticipant(input) {
  const requestKey = `${input.sessionId}:conf:unmute:${input.requestId || 'default'}`;
  if (handledRequests.has(requestKey)) {
    return { skipped: true, reason: 'duplicate_request' };
  }
  handledRequests.add(requestKey);

  const flags = await featureFlags.getTenantFlags(input.tenantId);
  if (!flags.conferenceEnabled) {
    return { skipped: true, reason: 'conference_disabled' };
  }

  const { session, conference } = await loadConferenceContext(input.sessionId, input.tenantId);
  if (!conference || !findParticipant(conference, input.callControlId)) {
    return { ok: false, error: 'participant_not_found' };
  }

  const leg = session.legs?.find((l) => l.callControlId === input.callControlId) || session.legs?.[0];
  const eventBase = {
    sessionId: session.id,
    tenantId: session.tenantId,
    correlationId: session.correlationId,
    callControlId: input.callControlId,
  };

  try {
    const policy = await evaluateConferencePolicy({
      tenantId: input.tenantId,
      sessionId: session.id,
      action: CONFERENCE_ACTION.UNMUTE,
      conferenceEnabled: flags.conferenceEnabled,
      observeOnly: flags.observeOnly,
      conference,
    });

    const commands = buildConferenceCommands({
      action: CONFERENCE_ACTION.UNMUTE,
      policy,
      callControlId: conference.hostCallControlId,
      participantCallControlId: input.callControlId,
      conferenceId: conference.conferenceId,
    });

    if (policy.effectiveAction === POLICY_ACTION.DENY) {
      return { ok: false, policy };
    }

    const updatedConference = setParticipantMuted(conference, input.callControlId, false);
    await persistConferenceSnapshot(session.id, updatedConference, session.version);

    await enqueueCommands(commands, session, leg, input.callControlId, flags.observeOnly);

    await publishConferenceEvent(eventBase, DOMAIN_EVENTS.CONFERENCE_PARTICIPANT_UNMUTED, {
      traceId: input.traceId,
      callControlId: input.callControlId,
    });

    return { ok: true, policy };
  } catch (error) {
    return { ok: false, error: error.message };
  }
}

module.exports = {
  joinParticipant,
  leaveParticipant,
  removeParticipant,
  muteParticipant,
  unmuteParticipant,
  persistConferenceSnapshot,
  publishConferenceEvent,
  resetConferenceParticipantManagerForTests,
};
