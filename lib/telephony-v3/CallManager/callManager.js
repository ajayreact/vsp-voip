const locks = require('../Redis/locks');
const sessionManager = require('../Sessions/sessionManager');
const legManager = require('../Sessions/legManager');
const callPersistence = require('../Sessions/callPersistence');
const stateMachine = require('../StateMachine/stateMachine');
const { mapTelnyxToTriggers } = require('../StateMachine/telnyxTriggerMap');
const policyEngine = require('../Policy/policyEngine');
const commandBus = require('../Commands/commandBus');
const eventBus = require('../Events/domainEventBus');
const { DOMAIN_EVENTS } = require('../Events/domainEvents');
const { safeJsonParse } = require('../Utils/safeJson');
const { v3Logger } = require('../Utils/v3Logger');
const { metrics } = require('../Utils/metrics');
const { withSpan } = require('../Utils/tracing');
const { GLOBAL_FLAGS, CALLMANAGER } = require('../constants');
const { V3ConflictError } = require('../errors');
const { resolveTenantForWebhook, extractTenantFromClientState } = require('../Utils/tenantBootstrap');

function isCallManagerEnabled() {
  return process.env[GLOBAL_FLAGS.TELEPHONY_V3_CALLMANAGER_ENABLED] === 'true';
}

/**
 * @param {import('../types').V3NormalizedWebhook} normalized
 */
function extractTenantId(normalized) {
  return extractTenantFromClientState(normalized);
}

function inferSessionOrigin(normalized) {
  if (normalized.state === 'parked') return 'DESK';
  if (normalized.direction === 'incoming') return 'PSTN_INBOUND';
  if (normalized.direction === 'outgoing') return 'PSTN_OUTBOUND';
  return 'SYSTEM';
}

function inferSessionDirection(normalized) {
  if (normalized.direction === 'incoming') return 'INBOUND';
  if (normalized.direction === 'outgoing') return 'OUTBOUND';
  return 'INTERNAL';
}

/**
 * @param {import('../types').V3NormalizedWebhook} normalized
 * @param {string|null} tenantId
 * @param {string} eventId
 * @param {string} workerId
 * @param {string} ingressId
 * @param {Record<string, unknown>|null} [tenantResolution]
 */
async function bootstrapSessionAndLeg(
  normalized,
  tenantId,
  eventId,
  workerId,
  ingressId,
  tenantResolution = null,
) {
  return locks.withBootstrapLock(
    normalized.callControlId,
    async () => {
      const existingLeg = await legManager.findLegByCallControlId(normalized.callControlId);
      if (existingLeg) {
        const session = await sessionManager.loadSession(existingLeg.sessionId, tenantId);
        return { session, leg: existingLeg, createdSession: false, createdLeg: false };
      }

      const sessionInput = {
        tenantId,
        telnyxCallSessionId: normalized.callSessionId,
        primaryCallControlId: normalized.callControlId,
        correlationId: normalized.correlationId,
        origin: inferSessionOrigin(normalized),
        direction: inferSessionDirection(normalized),
      };

      if (tenantResolution?.callKind === 'DESK_OUTBOUND') {
        sessionInput.callerUserId = tenantResolution.callerUserId ?? null;
        sessionInput.callerExtensionId = tenantResolution.callerExtensionId ?? null;
        sessionInput.routeSnapshot = {
          callKind: 'DESK_OUTBOUND',
          deskBootstrap: {
            source: tenantResolution.source ?? null,
            extensionNumber: tenantResolution.extensionNumber ?? null,
            sipUsername: tenantResolution.sipUsername ?? null,
            resolvedVia: tenantResolution.resolvedVia ?? null,
          },
        };
      }

      const { session, created: createdSession } = await sessionManager.findOrCreateSession(sessionInput);

      const { leg, created: createdLeg } = await legManager.findOrCreateLeg({
        sessionId: session.id,
        callControlId: normalized.callControlId,
        role: normalized.state === 'parked' ? 'ORIGIN' : 'PSTN',
        connectionId: normalized.connectionId,
        direction: normalized.direction,
        fromAddress: normalized.from,
        toAddress: normalized.to,
      });

      const loadedSession = await sessionManager.loadSession(leg.sessionId, tenantId);

      if (createdSession) {
        await eventBus.publish(buildEvent(DOMAIN_EVENTS.SESSION_CREATED, eventId, loadedSession, normalized, {
          workerId,
          ingressId,
        }));
      }
      if (createdLeg) {
        await eventBus.publish(buildEvent(DOMAIN_EVENTS.LEG_CREATED, `${eventId}:leg`, loadedSession, normalized, {
          legId: leg.id,
          callControlId: leg.callControlId,
        }));
      }

      return {
        session: loadedSession,
        leg,
        createdSession,
        createdLeg,
      };
    },
    { retries: CALLMANAGER.LOCK_RETRIES },
  );
}

function buildSessionPatch(transition, normalized) {
  const patch = { state: transition.toState };
  if (transition.toState === 'ACTIVE') patch.answeredAt = new Date();
  if (['ENDED', 'FAILED'].includes(transition.toState)) patch.endedAt = new Date();
  if (transition.toState === 'FAILED') patch.failureCode = normalized.eventType;
  return patch;
}

function buildLegPatch(transition, normalized) {
  const patch = { state: transition.toState };
  if (transition.toState === 'ANSWERED' || transition.toState === 'BRIDGED') {
    patch.answeredAt = new Date();
  }
  if (['ENDED', 'FAILED'].includes(transition.toState)) {
    patch.endedAt = new Date();
    patch.hangupCause = normalized.eventType;
  }
  return patch;
}

/**
 * @param {Object} params
 */
async function processFsmOnce(params) {
  const {
    normalized, tenantId, eventId, workerId, ingressId, sessionId,
  } = params;

  const session = await sessionManager.loadSession(sessionId, tenantId);
  const leg = await legManager.findLegByCallControlId(normalized.callControlId);
  if (!leg) return { handled: false, reason: 'leg_not_found' };

  const triggers = mapTelnyxToTriggers(normalized);

  await policyEngine.evaluate({
    eventId,
    sessionId: session.id,
    tenantId,
    correlationId: session.correlationId,
    telnyxEventType: normalized.eventType,
    sessionState: session.state,
    legState: leg.state,
  });

  const fsmResult = stateMachine.applyWithCompletion(
    { session, leg },
    {
      sessionTrigger: triggers.sessionTrigger,
      legTrigger: triggers.legTrigger,
      eventId,
    },
  );

  const sessionTransitions = [];
  if (fsmResult.sessionTransition) {
    sessionTransitions.push({
      transition: { ...fsmResult.sessionTransition, eventId, metadata: triggers.metadata },
      patch: buildSessionPatch(fsmResult.sessionTransition, normalized),
    });
  }
  if (fsmResult.sessionCompletionTransition) {
    sessionTransitions.push({
      transition: { ...fsmResult.sessionCompletionTransition, metadata: triggers.metadata },
      patch: buildSessionPatch(fsmResult.sessionCompletionTransition, normalized),
    });
  }

  const legWrite = fsmResult.legTransition
    ? {
      transition: { ...fsmResult.legTransition, eventId, metadata: triggers.metadata },
      patch: buildLegPatch(fsmResult.legTransition, normalized),
    }
    : null;

  const commandIntents = stateMachine.deriveCommandIntents({
    sessionTransition: fsmResult.sessionTransition,
    legTransition: fsmResult.legTransition,
  });

  const hasFsmWrites = sessionTransitions.length > 0 || legWrite;
  if (!hasFsmWrites && !commandIntents.length) {
    return {
      handled: true,
      sessionId: session.id,
      legId: leg.id,
      sessionState: session.state,
      legState: leg.state,
      invalidSessionTransition: fsmResult.invalidSessionTransition,
      invalidLegTransition: fsmResult.invalidLegTransition,
      duplicate: false,
    };
  }

  const persistResult = await callPersistence.persistCallFsmResult({
    sessionId: session.id,
    sessionVersion: session.version,
    legId: leg.id,
    legVersion: leg.version,
    sessionTransitions,
    legWrite,
    commandIntents,
    commandContext: {
      sessionId: session.id,
      legId: leg.id,
      tenantId,
      correlationId: session.correlationId,
      targetCallControlId: leg.callControlId,
      eventId,
    },
    tenantId,
  });

  if (!persistResult.duplicate) {
    for (const write of sessionTransitions) {
      await eventBus.publish(buildEvent(
        DOMAIN_EVENTS.SESSION_STATE_CHANGED,
        `${write.transition.eventId}:session`,
        persistResult.session,
        normalized,
        { transition: write.transition },
      ));
      if (write.transition.triggerEvent === 'session.closed') {
        await eventBus.publish(buildEvent(
          DOMAIN_EVENTS.SESSION_CLOSED,
          `${write.transition.eventId}:closed`,
          persistResult.session,
          normalized,
          { transition: write.transition },
        ));
      }
    }

    if (legWrite) {
      await eventBus.publish(buildEvent(
        DOMAIN_EVENTS.LEG_STATE_CHANGED,
        `${eventId}:leg-state`,
        persistResult.session,
        normalized,
        { legId: persistResult.leg.id, transition: legWrite.transition },
      ));
      if (['ENDED', 'FAILED'].includes(legWrite.transition.toState)) {
        await eventBus.publish(buildEvent(
          DOMAIN_EVENTS.LEG_ENDED,
          `${eventId}:leg-ended`,
          persistResult.session,
          normalized,
          { legId: persistResult.leg.id },
        ));
      }
    }

    if (persistResult.commandRows.length) {
      await commandBus.publishEnqueuedCommands(persistResult.commandRows, {
        sessionId: persistResult.session.id,
        tenantId,
        correlationId: persistResult.session.correlationId,
      });
    }
  }

  metrics.callManagerProcessed({
    event_type: normalized.eventType,
    session_state: persistResult.session.state,
  });

  v3Logger.info('callmanager.processed', {
    workerId,
    ingressId,
    sessionId: persistResult.session.id,
    legId: persistResult.leg.id,
    eventType: normalized.eventType,
    sessionState: persistResult.session.state,
    legState: persistResult.leg.state,
    duplicate: persistResult.duplicate,
    phase: 2,
  });

  return {
    handled: true,
    sessionId: persistResult.session.id,
    legId: persistResult.leg.id,
    sessionState: persistResult.session.state,
    legState: persistResult.leg.state,
    invalidSessionTransition: fsmResult.invalidSessionTransition,
    invalidLegTransition: fsmResult.invalidLegTransition,
    duplicate: persistResult.duplicate,
  };
}

/**
 * @param {Object} params
 */
async function processFsmWithRetry(params) {
  const maxRetries = CALLMANAGER.OPTIMISTIC_LOCK_MAX_RETRIES;
  for (let attempt = 0; attempt < maxRetries; attempt += 1) {
    try {
      return await processFsmOnce(params);
    } catch (error) {
      if (error instanceof V3ConflictError && attempt < maxRetries - 1) {
        metrics.callManagerRetry({ attempt: String(attempt + 1) });
        v3Logger.info('callmanager.optimistic_retry', {
          sessionId: params.sessionId,
          attempt: attempt + 1,
          eventId: params.eventId,
        });
        continue;
      }
      throw error;
    }
  }
  throw new V3ConflictError('CallManager optimistic lock retries exhausted');
}

/**
 * @param {import('../types').V3IngressContext} ctx
 */
async function processIngressEvent(ctx) {
  const { normalized, workerId, ingressId, traceId } = ctx;
  const eventId = normalized.telnyxEventId || ingressId;

  if (!normalized.callControlId) {
    v3Logger.debug('callmanager.no_call_control_id', {
      eventType: normalized.eventType,
      ingressId,
    });
    return { handled: false, reason: 'no_call_control_id' };
  }

  const tenantResolution = await resolveTenantForWebhook(normalized);
  if (tenantResolution.rejected) {
    metrics.tenantBootstrapFailed({ reason: tenantResolution.reason || 'rejected' });
    return {
      handled: false,
      rejected: true,
      reason: tenantResolution.reason || 'tenant_unresolved',
    };
  }

  const tenantId = tenantResolution.tenantId;

  return withSpan('telephony.callmanager.process', {
    workerId,
    ingressId,
    eventType: normalized.eventType,
    traceId: traceId || '',
  }, async () => {
    let leg = await legManager.findLegByCallControlId(normalized.callControlId);
    let session = leg ? await sessionManager.loadSession(leg.sessionId, tenantId) : null;

    const isInboundBootstrap = normalized.eventType === 'call.initiated'
      || (normalized.eventType === 'call.ringing' && !session);

    if (!session && isInboundBootstrap) {
      if (!tenantId && inferSessionOrigin(normalized) === 'PSTN_INBOUND') {
        metrics.tenantBootstrapFailed({ reason: 'missing_tenant_inbound' });
        return { handled: false, rejected: true, reason: 'missing_tenant_inbound' };
      }

      const boot = await bootstrapSessionAndLeg(
        normalized,
        tenantId,
        eventId,
        workerId,
        ingressId,
        tenantResolution,
      );
      session = boot.session;
      leg = boot.leg;
    }

    if (!session || !leg) {
      v3Logger.debug('callmanager.no_session', {
        eventType: normalized.eventType,
        callControlId: normalized.callControlId,
        ingressId,
      });
      return { handled: false, reason: 'no_session_or_leg' };
    }

    const result = await locks.withSessionLock(
      session.id,
      () => processFsmWithRetry({
        normalized,
        tenantId,
        eventId,
        workerId,
        ingressId,
        sessionId: session.id,
      }),
      { retries: CALLMANAGER.LOCK_RETRIES },
    );

    return { ...result, tenantId: session.tenantId || tenantId };
  });
}

function buildEvent(eventType, eventId, session, normalized, payload = {}) {
  return {
    eventId,
    eventType,
    occurredAt: new Date().toISOString(),
    sessionId: session.id,
    tenantId: session.tenantId,
    correlationId: session.correlationId,
    callControlId: normalized.callControlId,
    payload,
  };
}

module.exports = {
  isCallManagerEnabled,
  processIngressEvent,
  extractTenantId,
  bootstrapSessionAndLeg,
  processFsmWithRetry,
  processFsmOnce,
};
