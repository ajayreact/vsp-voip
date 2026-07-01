const crypto = require('crypto');
const { getPrisma } = require('../internal/prisma');
const eventBus = require('../Events/domainEventBus');
const { DOMAIN_EVENTS } = require('../Events/domainEvents');
const featureFlags = require('../FeatureFlags/featureFlagService');
const { v3Logger } = require('../Utils/v3Logger');
const { metrics } = require('../Utils/metrics');
const { createPstnRouteResult, ROUTING_FLOW } = require('./pstnRouteResult');
const pstnResolver = require('./pstnResolver');
const pstnPolicy = require('./pstnPolicy');
const pstnCommandBuilder = require('./pstnCommandBuilder');
const { POLICY_ACTION } = require('./pstnPolicy');

/** @type {Set<string>} */
const routedSessions = new Set();
/** @type {Set<string>} */
const handledEvents = new Set();
let registered = false;

function resetPstnRouterForTests() {
  routedSessions.clear();
  handledEvents.clear();
  registered = false;
}

/**
 * @param {import('../types').V3DomainEvent} event
 */
function isPstnRoutingEvent(event) {
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
async function publishPstnEvent(event, eventType, payload) {
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
 * Route a PSTN session. Never calls Telnyx directly.
 *
 * @param {import('../types').V3DomainEvent} event
 */
async function routePstnSession(event) {
  const startedMs = Date.now();
  const dedupeKey = `${event.sessionId}:${event.eventId}`;
  if (handledEvents.has(dedupeKey)) {
    return { skipped: true, reason: 'duplicate_event' };
  }
  handledEvents.add(dedupeKey);

  const traceId = event.payload?.traceId || event.eventId;

  await publishPstnEvent(event, DOMAIN_EVENTS.PSTN_ROUTE_STARTED, {
    traceId,
    sourceEventType: event.eventType,
  });

  try {
    const { session, originLeg, error: ctxError } = await pstnResolver.loadPstnSessionContext(
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
    if (!flags.pstnEnabled) {
      return { skipped: true, reason: 'pstn_disabled' };
    }

    const prisma = await getPrisma();
    const tenant = await prisma.tenant.findUnique({ where: { id: session.tenantId } });
    if (!tenant) {
      throw new Error('tenant_not_found');
    }

    let destResult;
    let phoneRecord = null;

    if (pstnResolver.isPstnInboundSession(session)) {
      const did = await pstnResolver.resolveDidOwnership(
        prisma,
        session.tenantId,
        originLeg.toAddress,
      );

      if (did.error === 'tenant_isolation_violation' || did.error === 'missing_tenant_or_did') {
        throw new Error(did.error);
      }

      phoneRecord = did.phoneRecord;

      if (did.suspended) {
        destResult = {
          destination: { did: originLeg.toAddress, suspended: true },
          destinationType: 'UNKNOWN',
          routingFlow: ROUTING_FLOW.UNKNOWN,
          targetExtension: null,
          caller: pstnResolver.resolvePstnCaller(originLeg.fromAddress),
          error: 'did_suspended',
        };
      } else {
        destResult = await pstnResolver.resolvePstnInboundDestination(
          session.tenantId,
          did.phoneRecord,
          did.greeting,
          originLeg.fromAddress,
        );
      }
    } else if (pstnResolver.isPstnOutboundStubSession(session, originLeg)) {
      destResult = {
        destination: { stub: true },
        destinationType: 'PSTN',
        routingFlow: ROUTING_FLOW.PSTN_TO_PSTN_OUTBOUND_STUB,
        targetExtension: null,
        caller: pstnResolver.resolvePstnCaller(originLeg.fromAddress),
        error: null,
      };
    } else {
      return { skipped: true, reason: 'not_pstn_session' };
    }

    metrics.pstnDestinationResolution({
      destination_type: destResult.destinationType,
      routing_flow: destResult.routingFlow,
    });

    await publishPstnEvent(event, DOMAIN_EVENTS.PSTN_ROUTE_RESOLVED, {
      traceId,
      routingFlow: destResult.routingFlow,
      destinationType: destResult.destinationType,
      destination: destResult.destination,
      caller: destResult.caller,
      phoneRecordId: phoneRecord?.id ?? null,
    });

    const targetExtension = destResult.targetExtension
      ? await prisma.extension.findFirst({
        where: { id: destResult.targetExtension.id, tenantId: session.tenantId },
        include: { security: true },
      })
      : null;

    const policyDecision = await pstnPolicy.evaluatePstnPolicy({
      tenant,
      targetExtension,
      phoneRecord,
      destination: destResult.destination,
      routingFlow: destResult.routingFlow,
      from: destResult.caller?.raw || destResult.caller?.pstnNumber || originLeg.fromAddress,
      observeOnly: flags.observeOnly,
    });

    const effectiveRoutingFlow = policyDecision.effectiveAction === POLICY_ACTION.VOICEMAIL
      ? ROUTING_FLOW.PSTN_TO_VOICEMAIL
      : destResult.routingFlow;

    const commands = pstnCommandBuilder.buildPstnCommands({
      routingFlow: effectiveRoutingFlow,
      policy: policyDecision,
      originCallControlId: originLeg.callControlId,
      destination: destResult.destination,
      tenantId: session.tenantId,
      connectionId: originLeg.connectionId,
    });

    const routeResult = createPstnRouteResult({
      sessionId: session.id,
      tenantId: session.tenantId,
      routingFlow: effectiveRoutingFlow,
      destinationType: destResult.destinationType,
      destination: destResult.destination,
      caller: destResult.caller,
      targetExtension,
      phoneRecord,
      policy: policyDecision,
      commands,
      observeOnly: flags.observeOnly,
      enforced: policyDecision.enforced,
      traceId,
      error: destResult.error,
    });

    const snapshot = {
      routingModule: 'pstn',
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
      callerUserId: null,
      calleeExtensionId: targetExtension?.id ?? null,
      didPhoneNumberId: phoneRecord?.id ?? null,
      ringGroupId: destResult.destination?.ringGroupId ?? null,
    });

    routedSessions.add(session.id);

    if (policyDecision.effectiveAction === POLICY_ACTION.DENY) {
      metrics.policyDenied({ routing_flow: destResult.routingFlow, reason: policyDecision.reason || 'deny' });
      await publishPstnEvent(event, DOMAIN_EVENTS.PSTN_ROUTE_DENIED, {
        traceId,
        policy: policyDecision,
        routeResult,
      });
    } else {
      await publishPstnEvent(event, DOMAIN_EVENTS.PSTN_ROUTE_ALLOWED, {
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

    if (!flags.observeOnly && effectiveRoutingFlow === ROUTING_FLOW.PSTN_TO_IVR) {
      const sidecarCoordinator = require('../Sidecar/sidecarCoordinator');
      await sidecarCoordinator.startIvrFromRouting({
        sessionId: session.id,
        tenantId: session.tenantId,
        callControlId: originLeg.callControlId,
        connectionId: originLeg.connectionId,
      });
    }

    const durationMs = Date.now() - startedMs;
    metrics.pstnRoute({ routing_flow: effectiveRoutingFlow, result: 'completed' });
    metrics.observePstnRouteDuration(durationMs, { routing_flow: effectiveRoutingFlow });

    await publishPstnEvent(event, DOMAIN_EVENTS.PSTN_ROUTE_COMPLETED, {
      traceId,
      routeResult,
      durationMs,
      commandsEnqueued: !flags.observeOnly,
    });

    v3Logger.info('pstn.route.completed', {
      sessionId: session.id,
      tenantId: session.tenantId,
      routingFlow: effectiveRoutingFlow,
      policyAction: policyDecision.action,
      observeOnly: flags.observeOnly,
      commandCount: commands.length,
      durationMs,
      traceId,
    });

    return { ok: true, routeResult };
  } catch (error) {
    const durationMs = Date.now() - startedMs;
    metrics.pstnRouteFailed({ routing_flow: ROUTING_FLOW.UNKNOWN, reason: 'error' });
    metrics.observePstnRouteDuration(durationMs, { routing_flow: ROUTING_FLOW.UNKNOWN });

    await publishPstnEvent(event, DOMAIN_EVENTS.PSTN_ROUTE_FAILED, {
      traceId,
      error: error.message,
      durationMs,
    });

    v3Logger.error('pstn.route.failed', {
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
  if (!isPstnRoutingEvent(event)) return;
  if (event.eventType === DOMAIN_EVENTS.LEG_CREATED && !event.payload?.legId) return;
  await routePstnSession(event);
}

function register() {
  if (registered) return;
  registered = true;

  eventBus.subscribe(DOMAIN_EVENTS.SESSION_CREATED, handleDomainEvent);
  eventBus.subscribe(DOMAIN_EVENTS.LEG_CREATED, handleDomainEvent);

  v3Logger.info('pstn.router.registered', { phase: 3.4 });
}

module.exports = {
  register,
  routePstnSession,
  handleDomainEvent,
  resetPstnRouterForTests,
  isRegistered: () => registered,
};
