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
const { getCallControlApplicationId } = require('../../telnyxCallControlSetup');
const {
  extractSipUsername,
  looksLikeTelnyxCredentialUsername,
} = require('../../telephony/PayloadNormalizer');
const sessionManager = require('../Sessions/sessionManager');
const { ROUTING_FLOW, DESTINATION_TYPE } = require('./mobileRouteResult');

/**
 * @param {import('../types').V3SessionRecord} session
 * @param {import('../types').V3LegRecord} originLeg
 * @param {{ sipUsername?: string|null, userId?: string|null }|null} caller
 */
function isMobileOriginatedSession(session, originLeg, caller) {
  if (session.origin === 'DESK') return false;
  if (session.direction === 'INBOUND' || session.origin === 'PSTN_INBOUND') return false;
  if (!caller?.userId && !caller?.sipUsername) return false;

  const credentialConnectionId = getCredentialConnectionId(null);
  const callControlApplicationId = getCallControlApplicationId(null);
  const connectionId = originLeg.connectionId ? String(originLeg.connectionId) : null;

  if (connectionId && callControlApplicationId && connectionId === String(callControlApplicationId)) {
    return false;
  }

  if (connectionId && credentialConnectionId && connectionId === String(credentialConnectionId)) {
    return true;
  }

  const sipUser = extractSipUsername(originLeg.fromAddress);
  if (sipUser && looksLikeTelnyxCredentialUsername(sipUser)) {
    return true;
  }

  return Boolean(caller?.sipUsername);
}

/**
 * @param {import('../types').V3SessionRecord} session
 * @param {import('../types').V3LegRecord} originLeg
 */
async function resolveMobileCaller(session, originLeg) {
  const prisma = await getPrisma();
  const tenantId = session.tenantId;
  if (!tenantId) {
    return { caller: null, error: 'missing_tenant' };
  }

  const fromAddress = originLeg.fromAddress || session.primaryCallControlId;
  const resolved = await resolveCallerFromAddress(prisma, fromAddress);
  if (!resolved?.tenantId) {
    return { caller: null, error: 'caller_not_resolved' };
  }

  if (resolved.tenantId !== tenantId) {
    return { caller: null, error: 'tenant_isolation_violation' };
  }

  const caller = {
    tenantId: resolved.tenantId,
    userId: resolved.user?.id ?? null,
    extensionId: resolved.callerExtension?.id ?? null,
    extensionNumber: resolved.callerExtension?.extensionNumber ?? null,
    sipUsername: resolved.sipUsername ?? null,
    device: resolved.user?.telnyxSipUsername ? 'mobile_app' : null,
  };

  if (!isMobileOriginatedSession(session, originLeg, caller)) {
    return { caller: null, error: 'not_mobile_origin' };
  }

  return { caller, error: null };
}

/**
 * @param {string} tenantId
 * @param {string|null|undefined} toAddress
 * @param {{ tenantId?: string|null, extensionNumber?: string|null }|null} caller
 */
async function resolveMobileDestination(tenantId, toAddress, caller) {
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
      routingFlow: ROUTING_FLOW.MOBILE_TO_PSTN,
      error: null,
    };
  }

  if (destination.kind === 'EXTENSION' && destination.extensionNumber) {
    const targetExtension = await loadTargetExtension(prisma, tenantId, destination.extensionNumber);
    if (!targetExtension) {
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
      ? ROUTING_FLOW.MOBILE_TO_MOBILE
      : ROUTING_FLOW.MOBILE_TO_DESK;

    let destinationType = DESTINATION_TYPE.EXTENSION;
    if (routingFlow === ROUTING_FLOW.MOBILE_TO_MOBILE) {
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
      routingFlow: ROUTING_FLOW.MOBILE_TO_MOBILE,
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
async function loadMobileSessionContext(sessionId, tenantId) {
  const session = await sessionManager.loadSession(sessionId, tenantId);
  const originLeg = (session.legs || []).find((leg) => leg.callControlId === session.primaryCallControlId)
    || (session.legs || []).find((leg) => leg.role === 'ORIGIN')
    || (session.legs || [])[0];
  if (!originLeg) {
    return { session: null, originLeg: null, error: 'origin_leg_not_found' };
  }
  return { session, originLeg, error: null };
}

module.exports = {
  isMobileOriginatedSession,
  resolveMobileCaller,
  resolveMobileDestination,
  loadMobileSessionContext,
};
