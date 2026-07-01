const crypto = require('crypto');
const { getPrisma } = require('../internal/prisma');
const eventBus = require('../Events/domainEventBus');
const { DOMAIN_EVENTS } = require('../Events/domainEvents');
const featureFlags = require('../FeatureFlags/featureFlagService');
const { v3Logger } = require('../Utils/v3Logger');
const { metrics } = require('../Utils/metrics');
const { createMobileRouteResult, ROUTING_FLOW } = require('./mobileRouteResult');
const mobileResolver = require('./mobileResolver');
const mobilePolicy = require('./mobilePolicy');
const mobileCommandBuilder = require('./mobileCommandBuilder');
const { POLICY_ACTION } = require('./mobilePolicy');

/** @type {Set<string>} */
const routedSessions = new Set();
/** @type {Set<string>} */
const handledEvents = new Set();
let registered = false;

function resetMobileRouterForTests() {
  routedSessions.clear();
  handledEvents.clear();
  registered = false;
}

/**
 * @param {import('../types').V3DomainEvent} event
 */
function isMobileRoutingEvent(event) {
  return event.eventType === DOMAIN_EVENTS.SESSION_CREATED
    || event.eventType === DOMAIN_EVENTS.LEG_CREATED;
}

/**
 * @param {string} sessionId
 */
async function hasExistingRoute(sessionId) {
  if (routedSessions.has(sessionId)) return true;
  const prisma = await getPrisma();
  const row = await prisma.v3CallSession.findUnique({
    where: { id: sessionId },
    select: { routeSnapshot: true },
  });
  return Boolean(row?.routeSnapshot);
}

/**
 * @param {string} sessionId
 * @param {number} version
 * @param {Record<string, unknown>} snapshot
 * @param {Record<string, unknown>} patch
 */
async function persistRouteSnapshot(sessionId, version, snapshot, patch) {
  const { mergeRouteSnapshotTopLevel } = require('../Utils/routeSnapshotHelper');
  const merged = await mergeRouteSnapshotTopLevel({ sessionId, version, patch: snapshot });
  if (!merged.ok) return false;

  if (patch && Object.keys(patch).length) {
    const prisma = await getPrisma();
    await prisma.v3CallSession.updateMany({
      where: { id: sessionId },
      data: { ...patch, updatedAt: new Date() },
    });
  }
  return true;
}

/**
 * @param {import('../types').V3DomainEvent} event
 * @param {string} eventType
 * @param {Record<string, unknown>} payload
 */
async function publishMobileEvent(event, eventType, payload) {
  await eventBus.publish({
    eventId: crypto.randomUUID(),
    eventType,
    occurredAt: new Date().toISOString(),
    sessionId: event.sessionId,
    tenantId: event.tenantId ?? null,
    correlationId: event.correlationId ?? null,
    callControlId: event.callControlId ?? null,
    payload,
  });
}

/**
 * Route a mobile-originated session. Never calls Telnyx directly.
 *
 * @param {import('../types').V3DomainEvent} event
 */
async function routeMobileSession(event) {
  const startedMs = Date.now();
  const dedupeKey = `${event.sessionId}:${event.eventId}`;
  if (handledEvents.has(dedupeKey)) {
    return { skipped: true, reason: 'duplicate_event' };
  }
  handledEvents.add(dedupeKey);

  const traceId = event.payload?.traceId || event.eventId;

  await publishMobileEvent(event, DOMAIN_EVENTS.MOBILE_ROUTE_STARTED, {
    traceId,
    sourceEventType: event.eventType,
  });

  try {
    const { session, originLeg, error: ctxError } = await mobileResolver.loadMobileSessionContext(
      event.sessionId,
      event.tenantId,
    );
    if (ctxError || !session || !originLeg) {
      throw new Error(ctxError || 'session_context_unavailable');
    }

    if (session.origin === 'DESK') {
      return { skipped: true, reason: 'desk_origin' };
    }

    if (await hasExistingRoute(session.id)) {
      return { skipped: true, reason: 'already_routed' };
    }

    if (!session.tenantId) {
      throw new Error('missing_tenant');
    }

    const flags = await featureFlags.getTenantFlags(session.tenantId);
    if (!flags.mobileEnabled) {
      return { skipped: true, reason: 'mobile_disabled' };
    }

    const prisma = await getPrisma();
    const tenant = await prisma.tenant.findUnique({ where: { id: session.tenantId } });
    if (!tenant) {
      throw new Error('tenant_not_found');
    }

    const { caller, error: callerError } = await mobileResolver.resolveMobileCaller(session, originLeg);
    if (callerError || !caller) {
      if (callerError === 'not_mobile_origin') {
        return { skipped: true, reason: 'not_mobile_origin' };
      }
      metrics.mobileRouteFailed({ routing_flow: ROUTING_FLOW.UNKNOWN, reason: callerError || 'caller' });
      throw new Error(callerError || 'caller_not_resolved');
    }

    const destResult = await mobileResolver.resolveMobileDestination(
      session.tenantId,
      originLeg.toAddress,
      caller,
    );

    metrics.mobileDestinationResolution({
      destination_type: destResult.destinationType,
      routing_flow: destResult.routingFlow,
    });

    await publishMobileEvent(event, DOMAIN_EVENTS.MOBILE_ROUTE_RESOLVED, {
      traceId,
      routingFlow: destResult.routingFlow,
      destinationType: destResult.destinationType,
      destination: destResult.destination,
      caller,
    });

    const callerExtension = caller.extensionId
      ? await prisma.extension.findFirst({
        where: { id: caller.extensionId, tenantId: session.tenantId },
        include: { security: true, primaryPhoneNumber: true },
      })
      : null;

    const policyDecision = await mobilePolicy.evaluateMobilePolicy({
      tenant,
      callerExtension,
      targetExtension: destResult.targetExtension,
      destination: destResult.destination,
      routingFlow: destResult.routingFlow,
      from: caller.extensionNumber ? `ext:${caller.extensionNumber}` : originLeg.fromAddress,
      observeOnly: flags.observeOnly,
    });

    const commands = mobileCommandBuilder.buildMobileCommands({
      routingFlow: destResult.routingFlow,
      policy: policyDecision,
      originCallControlId: originLeg.callControlId,
      destination: destResult.destination,
      callerExtension,
      tenantId: session.tenantId,
      connectionId: originLeg.connectionId,
    });

    const routeResult = createMobileRouteResult({
      sessionId: session.id,
      tenantId: session.tenantId,
      routingFlow: destResult.routingFlow,
      destinationType: destResult.destinationType,
      destination: destResult.destination,
      caller,
      targetExtension: destResult.targetExtension,
      policy: policyDecision,
      commands,
      observeOnly: flags.observeOnly,
      enforced: policyDecision.enforced,
      traceId,
      error: destResult.error,
    });

    const snapshot = {
      routingModule: 'mobile',
      routedAt: new Date().toISOString(),
      traceId,
      routingFlow: routeResult.routingFlow,
      destinationType: routeResult.destinationType,
      policyAction: policyDecision.action,
      effectiveAction: policyDecision.effectiveAction,
      observeOnly: flags.observeOnly,
      commands: commands.map((c) => c.commandType),
    };

    await persistRouteSnapshot(session.id, session.version, snapshot, {
      callerExtensionId: caller.extensionId,
      callerUserId: caller.userId,
      calleeExtensionId: destResult.targetExtension?.id ?? null,
    });

    routedSessions.add(session.id);

    if (policyDecision.effectiveAction === POLICY_ACTION.DENY) {
      metrics.policyDenied({ routing_flow: destResult.routingFlow, reason: policyDecision.reason || 'deny' });
      await publishMobileEvent(event, DOMAIN_EVENTS.MOBILE_ROUTE_DENIED, {
        traceId,
        policy: policyDecision,
        routeResult,
      });
    } else {
      await publishMobileEvent(event, DOMAIN_EVENTS.MOBILE_ROUTE_ALLOWED, {
        traceId,
        policy: policyDecision,
        routeResult,
      });
    }

    if (!flags.observeOnly && commands.length) {
      const commandBus = require('../Commands/commandBus');
      await commandBus.enqueueIntents(commands, {
        sessionId: session.id,
        legId: originLeg.id,
        tenantId: session.tenantId,
        correlationId: session.correlationId,
        targetCallControlId: originLeg.callControlId,
        sequenceStart: 0,
      });
    }

    const durationMs = Date.now() - startedMs;
    metrics.mobileRoute({ routing_flow: destResult.routingFlow, result: 'completed' });
    metrics.observeMobileRouteDuration(durationMs, { routing_flow: destResult.routingFlow });

    await publishMobileEvent(event, DOMAIN_EVENTS.MOBILE_ROUTE_COMPLETED, {
      traceId,
      routeResult,
      durationMs,
      commandsEnqueued: !flags.observeOnly,
    });

    v3Logger.info('mobile.route.completed', {
      sessionId: session.id,
      tenantId: session.tenantId,
      routingFlow: destResult.routingFlow,
      policyAction: policyDecision.action,
      observeOnly: flags.observeOnly,
      commandCount: commands.length,
      durationMs,
      traceId,
    });

    return { ok: true, routeResult };
  } catch (error) {
    const durationMs = Date.now() - startedMs;
    metrics.mobileRouteFailed({ routing_flow: ROUTING_FLOW.UNKNOWN, reason: 'error' });
    metrics.observeMobileRouteDuration(durationMs, { routing_flow: ROUTING_FLOW.UNKNOWN });

    await publishMobileEvent(event, DOMAIN_EVENTS.MOBILE_ROUTE_FAILED, {
      traceId,
      error: error.message,
      durationMs,
    });

    v3Logger.error('mobile.route.failed', {
      sessionId: event.sessionId,
      tenantId: event.tenantId,
      error: error.message,
      traceId,
    });

    return { ok: false, error: error.message };
  }
}

/**
 * @param {import('../types').V3DomainEvent} event
 */
async function handleDomainEvent(event) {
  if (!isMobileRoutingEvent(event)) return;
  if (event.eventType === DOMAIN_EVENTS.LEG_CREATED && !event.payload?.legId) return;
  await routeMobileSession(event);
}

function register() {
  if (registered) return;
  registered = true;

  eventBus.subscribe(DOMAIN_EVENTS.SESSION_CREATED, handleDomainEvent);
  eventBus.subscribe(DOMAIN_EVENTS.LEG_CREATED, handleDomainEvent);

  v3Logger.info('mobile.router.registered', { phase: 3.3 });
}

module.exports = {
  register,
  routeMobileSession,
  handleDomainEvent,
  resetMobileRouterForTests,
  isRegistered: () => registered,
};
