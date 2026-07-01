const { getPrisma } = require('../internal/prisma');
const { resolveCallerFromAddress } = require('../../telephony/CallerResolver');
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
const { ROUTING_FLOW, DESTINATION_TYPE } = require('./deskRouteResult');

/**
 * @param {import('../types').V3SessionRecord} session
 * @param {import('../types').V3LegRecord} originLeg
 */
async function resolveDeskCaller(session, originLeg) {
  const prisma = await getPrisma();
  const tenantId = session.tenantId;
  if (!tenantId) {
    return { caller: null, error: 'missing_tenant' };
  }

  const fromAddress = originLeg.fromAddress || session.primaryCallControlId;
  const caller = await resolveCallerFromAddress(prisma, fromAddress);
  if (!caller?.tenantId) {
    return { caller: null, error: 'caller_not_resolved' };
  }

  if (caller.tenantId !== tenantId) {
    return { caller: null, error: 'tenant_isolation_violation' };
  }

  return {
    caller: {
      tenantId: caller.tenantId,
      userId: caller.user?.id ?? null,
      extensionId: caller.callerExtension?.id ?? null,
      extensionNumber: caller.callerExtension?.extensionNumber ?? null,
      sipUsername: caller.sipUsername ?? null,
    },
    error: null,
  };
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
    return { destination: null, destinationType: DESTINATION_TYPE.UNKNOWN, error: 'tenant_isolation_violation' };
  }

  if (destination.kind === 'PSTN') {
    return {
      destination,
      destinationType: DESTINATION_TYPE.PSTN,
      routingFlow: ROUTING_FLOW.DESK_TO_PSTN,
      error: null,
    };
  }

  if (destination.kind === 'EXTENSION' && destination.extensionNumber) {
    const targetExtension = await loadTargetExtension(prisma, tenantId, destination.extensionNumber);
    if (!targetExtension) {
      const ringGroup = await loadRingGroupByExtensionNumber(prisma, tenantId, destination.extensionNumber);
      if (ringGroup) {
        return {
          destination: { ...destination, ringGroupId: ringGroup.id, ringGroupName: ringGroup.name },
          destinationType: DESTINATION_TYPE.RING_GROUP,
          routingFlow: ROUTING_FLOW.RING_GROUP,
          targetExtension: null,
          error: null,
        };
      }
      return {
        destination,
        destinationType: DESTINATION_TYPE.UNKNOWN,
        routingFlow: ROUTING_FLOW.UNKNOWN,
        targetExtension: null,
        error: 'extension_not_found',
      };
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

    return {
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
    };
  }

  if (destination.kind === 'CREDENTIAL_SIP') {
    return {
      destination,
      destinationType: DESTINATION_TYPE.EMPLOYEE_SIP,
      routingFlow: ROUTING_FLOW.DESK_TO_MOBILE,
      targetExtension: null,
      error: null,
    };
  }

  const classified = classifyDestinationKind(toAddress);
  return {
    destination,
    destinationType: DESTINATION_TYPE.UNKNOWN,
    routingFlow: ROUTING_FLOW.UNKNOWN,
    targetExtension: null,
    error: classified.kind === 'UNKNOWN' ? 'unknown_destination' : null,
  };
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
    return { session: null, originLeg: null, error: 'origin_leg_not_found' };
  }
  return { session, originLeg, error: null };
}

module.exports = {
  resolveDeskCaller,
  resolveDeskDestination,
  loadDeskSessionContext,
};
