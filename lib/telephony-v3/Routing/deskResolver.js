const { getPrisma } = require('../internal/prisma');
const { resolveCallerFromPayload } = require('../../telephony/CallerResolver');
const { loadPlatformSettings } = require('../../platformSettings');
const {
  resolveOutboundDestination,
  loadTargetExtension,
  classifyDestinationKind,
} = require('../../telephony/DestinationResolver');
const {
  resolveExtensionRingTargets,
  hasAppRingTargets,
  formatTargetDialTo,
} = require('../../inboundRouting');
const { getCredentialConnectionId } = require('../../telnyxConfig');
const { loadRingGroupByExtensionNumber } = require('../../ringGroupRouter');
const sessionManager = require('../Sessions/sessionManager');
const { v3Logger } = require('../Utils/v3Logger');
const { ROUTING_FLOW, DESTINATION_TYPE } = require('./deskRouteResult');

/**
 * @param {string} tenantId
 * @param {string|null|undefined} toAddress
 * @param {Record<string, unknown>} result
 */
function logDeskDestinationResult(tenantId, toAddress, result) {
  const summary = {
    tenantId,
    toAddress: toAddress ?? null,
    routingFlow: result.routingFlow ?? null,
    destinationType: result.destinationType ?? null,
    resolvedExtension: result.targetExtension?.extensionNumber
      ?? result.destination?.extensionNumber
      ?? null,
    resolvedDestination: result.destination?.dialTo
      ?? result.destination?.pstnNumber
      ?? result.destination?.extensionNumber
      ?? null,
    destination: result.destination
      ? {
        kind: result.destination.kind,
        dialTo: result.destination.dialTo ?? null,
        pstnNumber: result.destination.pstnNumber ?? null,
        extensionNumber: result.destination.extensionNumber ?? null,
      }
      : null,
    error: result.error ?? null,
  };
  console.log('[V3] deskResolver.resolveDeskDestination', summary);
  v3Logger.info('desk.resolver.destination', summary);
}

/**
 * Rebuild Telnyx payload shape for desk caller resolution after bootstrap.
 * @param {import('../types').V3LegRecord} originLeg
 * @param {import('../types').V3SessionRecord} session
 */
function buildDeskCallerPayload(originLeg, session) {
  const deskBootstrap = session.routeSnapshot?.deskBootstrap || {};
  const payload = {
    from: originLeg.fromAddress,
    to: originLeg.toAddress,
    call_control_id: originLeg.callControlId,
    connection_id: originLeg.connectionId,
    direction: originLeg.direction || 'outgoing',
    state: 'parked',
  };

  if (deskBootstrap.sipUsername) {
    payload.sip_username = deskBootstrap.sipUsername;
    payload.username = deskBootstrap.sipUsername;
  }

  return payload;
}

/**
 * @param {import('../types').V3SessionRecord} session
 * @param {import('../types').V3LegRecord} originLeg
 */
async function resolveDeskCaller(session, originLeg) {
  const prisma = await getPrisma();
  const tenantId = session.tenantId;
  if (!tenantId) {
    const result = { caller: null, error: 'missing_tenant' };
    console.log('[V3] deskResolver.resolveDeskCaller', { sessionId: session.id, ...result });
    v3Logger.info('desk.resolver.caller', { sessionId: session.id, ...result });
    return result;
  }

  if (session.callerUserId && session.callerExtensionId) {
    const extension = await prisma.extension.findFirst({
      where: {
        id: session.callerExtensionId,
        tenantId,
        status: 'ACTIVE',
      },
      include: { user: true },
    });
    if (extension?.user?.id === session.callerUserId) {
      const result = {
        caller: {
          tenantId,
          userId: extension.user.id,
          extensionId: extension.id,
          extensionNumber: extension.extensionNumber,
          sipUsername: extension.user.telnyxSipUsername || session.routeSnapshot?.deskBootstrap?.sipUsername || null,
        },
        error: null,
      };
      console.log('[V3] deskResolver.resolveDeskCaller', {
        sessionId: session.id,
        tenantId,
        source: 'session_bootstrap',
        caller: result.caller,
      });
      v3Logger.info('desk.resolver.caller', {
        sessionId: session.id,
        tenantId,
        source: 'session_bootstrap',
        caller: result.caller,
      });
      return result;
    }
  }

  const platform = await loadPlatformSettings(prisma);
  const payload = buildDeskCallerPayload(originLeg, session);
  const caller = await resolveCallerFromPayload(prisma, payload, platform);
  if (!caller?.tenantId) {
    const result = { caller: null, error: 'caller_not_resolved' };
    console.log('[V3] deskResolver.resolveDeskCaller', {
      sessionId: session.id,
      tenantId,
      source: 'payload',
      from: originLeg.fromAddress,
      to: originLeg.toAddress,
      ...result,
    });
    v3Logger.info('desk.resolver.caller', {
      sessionId: session.id,
      tenantId,
      source: 'payload',
      from: originLeg.fromAddress,
      to: originLeg.toAddress,
      ...result,
    });
    return result;
  }

  if (caller.tenantId !== tenantId) {
    const result = { caller: null, error: 'tenant_isolation_violation' };
    console.log('[V3] deskResolver.resolveDeskCaller', result);
    v3Logger.info('desk.resolver.caller', { sessionId: session.id, tenantId, ...result });
    return result;
  }

  const result = {
    caller: {
      tenantId: caller.tenantId,
      userId: caller.user?.id ?? null,
      extensionId: caller.callerExtension?.id ?? null,
      extensionNumber: caller.callerExtension?.extensionNumber ?? null,
      sipUsername: caller.sipUsername ?? null,
    },
    error: null,
  };
  console.log('[V3] deskResolver.resolveDeskCaller', {
    sessionId: session.id,
    tenantId,
    caller: result.caller,
    error: result.error,
  });
  v3Logger.info('desk.resolver.caller', {
    sessionId: session.id,
    tenantId,
    caller: result.caller,
    error: result.error,
  });
  return result;
}

/**
 * @param {string} tenantId
 * @param {string|null|undefined} toAddress
 * @param {{ tenantId?: string|null }|null} caller
 */
async function resolveDeskDestination(tenantId, toAddress, caller) {
  const prisma = await getPrisma();
  const payload = { to: toAddress, from: caller?.extensionNumber ? `ext:${caller.extensionNumber}` : null };
  const destination = await resolveOutboundDestination(prisma, payload, { tenantId: caller?.tenantId ?? tenantId });

  if (destination.tenantId && destination.tenantId !== tenantId) {
    return logDeskDestinationResult(tenantId, toAddress, {
      destination: null, destinationType: DESTINATION_TYPE.UNKNOWN, error: 'tenant_isolation_violation',
    });
  }

  if (destination.kind === 'PSTN') {
    return logDeskDestinationResult(tenantId, toAddress, {
      destination,
      destinationType: DESTINATION_TYPE.PSTN,
      routingFlow: ROUTING_FLOW.DESK_TO_PSTN,
      error: null,
    });
  }

  if (destination.kind === 'EXTENSION' && destination.extensionNumber) {
    const targetExtension = await loadTargetExtension(prisma, tenantId, destination.extensionNumber);
    if (!targetExtension) {
      const ringGroup = await loadRingGroupByExtensionNumber(prisma, tenantId, destination.extensionNumber);
      if (ringGroup) {
        return logDeskDestinationResult(tenantId, toAddress, {
          destination: { ...destination, ringGroupId: ringGroup.id, ringGroupName: ringGroup.name },
          destinationType: DESTINATION_TYPE.RING_GROUP,
          routingFlow: ROUTING_FLOW.RING_GROUP,
          targetExtension: null,
          error: null,
        });
      }
      return logDeskDestinationResult(tenantId, toAddress, {
        destination,
        destinationType: DESTINATION_TYPE.UNKNOWN,
        routingFlow: ROUTING_FLOW.UNKNOWN,
        targetExtension: null,
        error: 'extension_not_found',
      });
    }

    const credentialConnectionId = getCredentialConnectionId(null);
    const ringResolution = await resolveExtensionRingTargets(
      prisma,
      targetExtension,
      credentialConnectionId,
    );
    const appTargets = ringResolution?.targets || [];
    const routingFlow = hasAppRingTargets(appTargets)
      ? ROUTING_FLOW.DESK_TO_MOBILE
      : ROUTING_FLOW.DESK_TO_DESK;

    let destinationType = DESTINATION_TYPE.EXTENSION;
    if (routingFlow === ROUTING_FLOW.DESK_TO_MOBILE) {
      destinationType = DESTINATION_TYPE.EMPLOYEE_SIP;
    } else if (targetExtension.telnyxSipUsername) {
      destinationType = DESTINATION_TYPE.DESK_SIP;
    }

    const dialTo = appTargets.length
      ? formatTargetDialTo(appTargets[0])
      : (targetExtension.telnyxSipUsername
        ? `sip:${targetExtension.telnyxSipUsername}@sip.telnyx.com`
        : destination.extensionNumber);

    return logDeskDestinationResult(tenantId, toAddress, {
      destination: {
        ...destination,
        dialTo,
        ringTargets: appTargets,
        ringTimeout: ringResolution?.ringTimeout ?? 25,
        ringStrategy: ringResolution?.strategy ?? 'sequential',
      },
      destinationType,
      routingFlow,
      targetExtension,
      error: null,
    });
  }

  if (destination.kind === 'CREDENTIAL_SIP') {
    return logDeskDestinationResult(tenantId, toAddress, {
      destination,
      destinationType: DESTINATION_TYPE.EMPLOYEE_SIP,
      routingFlow: ROUTING_FLOW.DESK_TO_MOBILE,
      targetExtension: null,
      error: null,
    });
  }

  const classified = classifyDestinationKind(toAddress);
  return logDeskDestinationResult(tenantId, toAddress, {
    destination,
    destinationType: DESTINATION_TYPE.UNKNOWN,
    routingFlow: ROUTING_FLOW.UNKNOWN,
    targetExtension: null,
    error: classified.kind === 'UNKNOWN' ? 'unknown_destination' : null,
  });
}

/**
 * @param {string} sessionId
 * @param {string|null|undefined} tenantId
 */
async function loadDeskSessionContext(sessionId, tenantId) {
  const session = await sessionManager.loadSession(sessionId, tenantId);
  const originLeg = (session.legs || []).find((leg) => leg.role === 'ORIGIN')
    || (session.legs || []).find((leg) => leg.callControlId === session.primaryCallControlId);
  if (!originLeg) {
    const result = { session: null, originLeg: null, error: 'origin_leg_not_found' };
    console.log('[V3] deskResolver.loadDeskSessionContext', { sessionId, tenantId, ...result });
    v3Logger.info('desk.resolver.session_context', { sessionId, tenantId, ...result });
    return result;
  }
  const result = { session, originLeg, error: null };
  console.log('[V3] deskResolver.loadDeskSessionContext', {
    sessionId,
    tenantId: session.tenantId,
    origin: session.origin,
    originLegId: originLeg.id,
    originCallControlId: originLeg.callControlId,
    toAddress: originLeg.toAddress,
    fromAddress: originLeg.fromAddress,
  });
  v3Logger.info('desk.resolver.session_context', {
    sessionId,
    tenantId: session.tenantId,
    origin: session.origin,
    originLegId: originLeg.id,
    originCallControlId: originLeg.callControlId,
    toAddress: originLeg.toAddress,
    fromAddress: originLeg.fromAddress,
  });
  return result;
}

module.exports = {
  resolveDeskCaller,
  resolveDeskDestination,
  loadDeskSessionContext,
};
