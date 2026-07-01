const crypto = require('crypto');
const sessionManager = require('../Sessions/sessionManager');
const eventBus = require('../Events/domainEventBus');
const { DOMAIN_EVENTS } = require('../Events/domainEvents');
const featureFlags = require('../FeatureFlags/featureFlagService');
const { v3Logger } = require('../Utils/v3Logger');
const { metrics } = require('../Utils/metrics');
const { getPrisma } = require('../internal/prisma');
const {
  evaluateVoicemailPolicy,
  markVoicemailStarted,
  isVoicemailTimedOut,
  clearVoicemailTimer,
  POLICY_ACTION,
} = require('./voicemailPolicy');
const { buildVoicemailCommands } = require('./voicemailCommandBuilder');
const { VOICEMAIL_ACTION, VOICEMAIL_REASON } = require('./voicemailConstants');

/** @type {Set<string>} */
const activeVoicemails = new Set();
/** @type {Set<string>} */
const handledRequests = new Set();

function resetVoicemailManagerForTests() {
  activeVoicemails.clear();
  handledRequests.clear();
}

/**
 * @param {string} sessionId
 * @param {Record<string, unknown>} patch
 * @param {number} version
 */
async function persistVoicemailSnapshot(sessionId, patch, version) {
  const prisma = await getPrisma();
  const row = await prisma.v3CallSession.findUnique({
    where: { id: sessionId },
    select: { routeSnapshot: true },
  });
  const snapshot = {
    ...(row?.routeSnapshot && typeof row.routeSnapshot === 'object' ? row.routeSnapshot : {}),
    voicemail: {
      ...(row?.routeSnapshot?.voicemail || {}),
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
async function publishVoicemailEvent(base, eventType, payload) {
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
 * @param {{
 *   sessionId: string,
 *   tenantId: string,
 *   reason: string,
 *   legId?: string,
 *   callControlId?: string,
 *   extensionId?: string|null,
 *   mailboxId?: string|null,
 *   greetingUrl?: string|null,
 *   greetingText?: string|null,
 *   requestId?: string,
 *   traceId?: string,
 * }} input
 */
async function startVoicemail(input) {
  const startedMs = Date.now();
  const reason = input.reason || VOICEMAIL_REASON.POLICY;
  const requestKey = `${input.sessionId}:voicemail:start:${input.requestId || 'default'}`;
  if (handledRequests.has(requestKey)) {
    return { skipped: true, reason: 'duplicate_request' };
  }
  handledRequests.add(requestKey);

  const session = await sessionManager.loadSession(input.sessionId, input.tenantId);
  const leg = session.legs?.find((l) => l.id === input.legId)
    || session.legs?.find((l) => l.callControlId === input.callControlId)
    || session.legs?.find((l) => l.callControlId === session.primaryCallControlId)
    || session.legs?.[0];

  if (!leg) {
    metrics.voicemailFailed({ reason: 'leg_not_found', vm_reason: reason });
    await publishVoicemailEvent(
      { sessionId: input.sessionId, tenantId: input.tenantId, correlationId: session.correlationId },
      DOMAIN_EVENTS.VOICEMAIL_FAILED,
      { traceId: input.traceId, error: 'leg_not_found', vmReason: reason },
    );
    return { ok: false, error: 'leg_not_found' };
  }

  const flags = await featureFlags.getTenantFlags(input.tenantId);
  if (!flags.voicemailEnabled) {
    return { skipped: true, reason: 'voicemail_disabled' };
  }

  const callControlId = input.callControlId || leg.callControlId;
  const eventBase = {
    sessionId: session.id,
    tenantId: session.tenantId,
    correlationId: session.correlationId,
    callControlId,
  };

  if (activeVoicemails.has(session.id)) {
    return { skipped: true, reason: 'voicemail_in_progress' };
  }

  await publishVoicemailEvent(eventBase, DOMAIN_EVENTS.VOICEMAIL_STARTED, {
    traceId: input.traceId || requestKey,
    vmReason: reason,
    legId: leg.id,
    extensionId: input.extensionId ?? null,
    mailboxId: input.mailboxId ?? input.extensionId ?? null,
  });

  try {
    if (isVoicemailTimedOut(session.id)) {
      throw new Error('voicemail_timeout');
    }

    const policy = await evaluateVoicemailPolicy({
      tenantId: input.tenantId,
      sessionId: session.id,
      reason,
      voicemailEnabled: flags.voicemailEnabled,
      observeOnly: flags.observeOnly,
      extensionId: input.extensionId,
      mailboxId: input.mailboxId,
      greetingUrl: input.greetingUrl,
    });

    const commands = buildVoicemailCommands({
      callControlId,
      policy,
      action: VOICEMAIL_ACTION.START,
      greetingText: input.greetingText,
    });

    if (policy.effectiveAction === POLICY_ACTION.DENY) {
      await publishVoicemailEvent(eventBase, DOMAIN_EVENTS.VOICEMAIL_FAILED, {
        traceId: input.traceId,
        policy,
        vmReason: reason,
      });
      metrics.voicemailFailed({ reason: policy.reason || 'deny', vm_reason: reason });
      return { ok: false, policy };
    }

    markVoicemailStarted(session.id);
    activeVoicemails.add(session.id);

    await persistVoicemailSnapshot(session.id, {
      voicemailActive: true,
      reason,
      startedAt: new Date().toISOString(),
      legId: leg.id,
      callControlId,
      mailboxId: policy.mailboxId ?? input.mailboxId ?? input.extensionId ?? null,
      greetingUrl: policy.greetingUrl ?? null,
      maxLength: policy.maxLength,
    }, session.version);

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
    metrics.voicemailTotal({ result: 'started', vm_reason: reason });
    metrics.observeVoicemailDuration(durationMs, { action: 'start', vm_reason: reason });

    v3Logger.info('voicemail.started', {
      sessionId: session.id,
      tenantId: session.tenantId,
      vmReason: reason,
      durationMs,
    });

    return { ok: true, policy, vmReason: reason };
  } catch (error) {
    metrics.voicemailFailed({ reason: 'error', vm_reason: reason });
    await publishVoicemailEvent(eventBase, DOMAIN_EVENTS.VOICEMAIL_FAILED, {
      traceId: input.traceId,
      error: error.message,
      vmReason: reason,
    });
    v3Logger.error('voicemail.failed', { sessionId: input.sessionId, error: error.message });
    return { ok: false, error: error.message };
  }
}

/**
 * @param {{
 *   sessionId: string,
 *   tenantId: string,
 *   legId?: string,
 *   callControlId?: string,
 *   recordingUrl?: string|null,
 *   recordingSid?: string|null,
 *   durationSeconds?: number|null,
 *   requestId?: string,
 *   traceId?: string,
 * }} input
 */
async function saveVoicemail(input) {
  const startedMs = Date.now();
  const requestKey = `${input.sessionId}:voicemail:save:${input.requestId || 'default'}`;
  if (handledRequests.has(requestKey)) {
    return { skipped: true, reason: 'duplicate_request' };
  }
  handledRequests.add(requestKey);

  const session = await sessionManager.loadSession(input.sessionId, input.tenantId);
  const callControlId = input.callControlId || session.primaryCallControlId;
  const eventBase = {
    sessionId: session.id,
    tenantId: session.tenantId,
    correlationId: session.correlationId,
    callControlId,
  };

  try {
    await persistVoicemailSnapshot(session.id, {
      voicemailActive: false,
      savedAt: new Date().toISOString(),
      recordingUrl: input.recordingUrl ?? null,
      recordingSid: input.recordingSid ?? null,
      durationSeconds: input.durationSeconds ?? null,
    }, session.version);

    activeVoicemails.delete(session.id);
    clearVoicemailTimer(session.id);

    const durationMs = Date.now() - startedMs;
    metrics.voicemailTotal({ result: 'saved' });
    metrics.observeVoicemailDuration(durationMs, { action: 'save' });

    await publishVoicemailEvent(eventBase, DOMAIN_EVENTS.VOICEMAIL_SAVED, {
      traceId: input.traceId,
      recordingUrl: input.recordingUrl ?? null,
      recordingSid: input.recordingSid ?? null,
      durationSeconds: input.durationSeconds ?? null,
    });

    await publishVoicemailEvent(eventBase, DOMAIN_EVENTS.VOICEMAIL_COMPLETED, {
      traceId: input.traceId,
      durationMs,
    });

    v3Logger.info('voicemail.saved', {
      sessionId: session.id,
      tenantId: session.tenantId,
      durationMs,
    });

    return { ok: true };
  } catch (error) {
    metrics.voicemailFailed({ reason: 'error' });
    await publishVoicemailEvent(eventBase, DOMAIN_EVENTS.VOICEMAIL_FAILED, {
      traceId: input.traceId,
      error: error.message,
    });
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
async function stopVoicemail(input) {
  const startedMs = Date.now();
  const requestKey = `${input.sessionId}:voicemail:stop:${input.requestId || 'default'}`;
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
  if (!flags.voicemailEnabled) {
    return { skipped: true, reason: 'voicemail_disabled' };
  }

  const callControlId = input.callControlId || leg.callControlId;
  const eventBase = {
    sessionId: session.id,
    tenantId: session.tenantId,
    correlationId: session.correlationId,
    callControlId,
  };

  try {
    const policy = await evaluateVoicemailPolicy({
      tenantId: input.tenantId,
      sessionId: session.id,
      reason: VOICEMAIL_REASON.POLICY,
      voicemailEnabled: flags.voicemailEnabled,
      observeOnly: flags.observeOnly,
    });

    const commands = buildVoicemailCommands({
      callControlId,
      policy,
      action: VOICEMAIL_ACTION.STOP,
    });

    activeVoicemailCleanup(session.id);

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

    await persistVoicemailSnapshot(session.id, {
      voicemailActive: false,
      stoppedAt: new Date().toISOString(),
    }, session.version);

    metrics.voicemailTotal({ result: 'stopped' });
    metrics.observeVoicemailDuration(Date.now() - startedMs, { action: 'stop' });

    await publishVoicemailEvent(eventBase, DOMAIN_EVENTS.VOICEMAIL_COMPLETED, {
      traceId: input.traceId,
      stopped: true,
    });

    return { ok: true };
  } catch (error) {
    metrics.voicemailFailed({ reason: 'error' });
    await publishVoicemailEvent(eventBase, DOMAIN_EVENTS.VOICEMAIL_FAILED, {
      traceId: input.traceId,
      error: error.message,
    });
    return { ok: false, error: error.message };
  }
}

function activeVoicemailCleanup(sessionId) {
  activeVoicemails.delete(sessionId);
  clearVoicemailTimer(sessionId);
}

/** Convenience wrappers for routing-directed voicemail. */
async function startNoAnswerVoicemail(input) {
  return startVoicemail({ ...input, reason: VOICEMAIL_REASON.NO_ANSWER });
}

async function startBusyVoicemail(input) {
  return startVoicemail({ ...input, reason: VOICEMAIL_REASON.BUSY });
}

async function startDndVoicemail(input) {
  return startVoicemail({ ...input, reason: VOICEMAIL_REASON.DND });
}

module.exports = {
  startVoicemail,
  startNoAnswerVoicemail,
  startBusyVoicemail,
  startDndVoicemail,
  saveVoicemail,
  stopVoicemail,
  resetVoicemailManagerForTests,
  isVoicemailActive: (sessionId) => activeVoicemails.has(sessionId),
  VOICEMAIL_REASON,
};
