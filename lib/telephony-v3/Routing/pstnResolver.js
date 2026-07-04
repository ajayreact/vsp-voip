const { getPrisma } = require('../internal/prisma');
const { normalizePhoneNumber } = require('../../phone');
const { applyNumberRoutingToGreeting, resolveEffectiveRoutingType } = require('../../numberRouting');
const { getCredentialConnectionId } = require('../../telnyxConfig');
const {
  resolveRingTargets,
  resolveExtensionForPhoneRecord,
  hasAppRingTargets,
  hasSipRingTargets,
  formatTargetDialTo,
} = require('../../inboundRouting');
const {
  extractSipUsername,
  looksLikeTelnyxCredentialUsername,
} = require('../../telephony/PayloadNormalizer');
const sessionManager = require('../Sessions/sessionManager');
const { ROUTING_FLOW, DESTINATION_TYPE } = require('./pstnRouteResult');

/**
 * @param {import('../types').V3SessionRecord} session
 */
function isPstnInboundSession(session) {
  if (session.origin === 'DESK') return false;
  return session.origin === 'PSTN_INBOUND' || session.direction === 'INBOUND';
}

/**
 * @param {import('../types').V3SessionRecord} session
 * @param {import('../types').V3LegRecord} originLeg
 */
function isPstnOutboundStubSession(session, originLeg) {
  if (session.origin === 'DESK') return false;
  if (session.direction !== 'OUTBOUND' && session.origin !== 'PSTN_OUTBOUND') return false;
  const sipUser = extractSipUsername(originLeg?.fromAddress);
  if (sipUser && looksLikeTelnyxCredentialUsername(sipUser)) return false;
  if (session.origin === 'PSTN_INBOUND') return false;
  return true;
}

/**
 * @param {object} prisma
 * @param {string} tenantId
 * @param {string|null|undefined} toAddress
 */
async function resolveDidOwnership(prisma, tenantId, toAddress) {
  const normalizedDid = normalizePhoneNumber(toAddress);
  if (!tenantId || !normalizedDid) {
    return { phoneRecord: null, greeting: null, tenant: null, error: 'missing_tenant_or_did' };
  }

  const phoneRecord = await prisma.phoneNumber.findFirst({
    where: { number: normalizedDid, tenantId },
    include: { assignedUser: true },
  });

  if (!phoneRecord) {
    return { phoneRecord: null, greeting: null, tenant: null, error: 'unknown_did' };
  }

  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
  const greeting = tenant
    ? await prisma.greeting.findUnique({ where: { tenantId } })
    : null;

  return {
    phoneRecord,
    greeting,
    tenant,
    error: null,
    suspended: phoneRecord.isActive === false,
  };
}

/**
 * @param {string|null|undefined} fromAddress
 */
function resolvePstnCaller(fromAddress) {
  const pstnNumber = normalizePhoneNumber(fromAddress) || fromAddress || null;
  return {
    pstnNumber,
    raw: fromAddress ?? null,
    anonymous: !pstnNumber || String(fromAddress || '').toLowerCase().includes('anonymous'),
  };
}

/**
 * @param {string} tenantId
 * @param {object|null} phoneRecord
 * @param {object|null} greeting
 * @param {string|null|undefined} fromAddress
 */
async function resolvePstnInboundDestination(tenantId, phoneRecord, greeting, fromAddress) {
  const prisma = await getPrisma();
  const caller = resolvePstnCaller(fromAddress);

  if (!phoneRecord) {
    return {
      destination: null,
      destinationType: DESTINATION_TYPE.UNKNOWN,
      routingFlow: ROUTING_FLOW.UNKNOWN,
      targetExtension: null,
      caller,
      ringResolution: null,
      error: 'unknown_did',
    };
  }

  const credentialConnectionId = getCredentialConnectionId(null);
  let effectiveGreeting = greeting;
  if (effectiveGreeting) {
    effectiveGreeting = applyNumberRoutingToGreeting(effectiveGreeting, phoneRecord);
  }

  const routingType = resolveEffectiveRoutingType(phoneRecord, effectiveGreeting);
  if (routingType === 'ivr' || effectiveGreeting?.ivrEnabled) {
    const targetExtension = await resolveExtensionForPhoneRecord(prisma, tenantId, phoneRecord);
    return {
      destination: { did: phoneRecord.number, ivr: true },
      destinationType: DESTINATION_TYPE.IVR,
      routingFlow: ROUTING_FLOW.PSTN_TO_IVR,
      targetExtension,
      caller,
      ringResolution: null,
      error: null,
    };
  }

  const ringResolution = await resolveRingTargets(
    prisma,
    tenantId,
    effectiveGreeting,
    phoneRecord,
    credentialConnectionId,
  );

  const targetExtension = await resolveExtensionForPhoneRecord(prisma, tenantId, phoneRecord);
  const targets = ringResolution?.targets || [];

  if (ringResolution?.ringGroupId || ringResolution?.ringGroup) {
    const dialTargets = targets
      .map((target) => formatTargetDialTo(target))
      .filter(Boolean);

    return {
      destination: {
        ringGroupId: ringResolution.ringGroupId || ringResolution.ringGroup?.id,
        ringGroupName: ringResolution.ringGroup?.name,
        targets,
        dialTargets,
        strategy: 'sequential',
        ringTimeout: ringResolution.ringTimeout ?? 25,
      },
      destinationType: DESTINATION_TYPE.RING_GROUP,
      routingFlow: ROUTING_FLOW.PSTN_TO_RING_GROUP,
      targetExtension,
      caller,
      ringResolution,
      error: null,
    };
  }

  if (hasAppRingTargets(targets)) {
    const dialTo = formatTargetDialTo(targets.find((t) => t.type === 'app') || targets[0]);
    return {
      destination: {
        dialTo,
        ringTargets: targets.filter((t) => t.type === 'app'),
        ringTimeout: ringResolution?.ringTimeout ?? 25,
        did: phoneRecord.number,
      },
      destinationType: DESTINATION_TYPE.EMPLOYEE_SIP,
      routingFlow: ROUTING_FLOW.PSTN_TO_MOBILE,
      targetExtension,
      caller,
      ringResolution,
      error: null,
    };
  }

  if (hasSipRingTargets(targets)) {
    const dialTo = formatTargetDialTo(targets.find((t) => t.type === 'sip') || targets[0]);
    return {
      destination: {
        dialTo,
        ringTargets: targets.filter((t) => t.type === 'sip'),
        did: phoneRecord.number,
      },
      destinationType: DESTINATION_TYPE.DESK_SIP,
      routingFlow: ROUTING_FLOW.PSTN_TO_DESK,
      targetExtension,
      caller,
      ringResolution,
      error: null,
    };
  }

  if (targetExtension?.telnyxSipUsername) {
    return {
      destination: {
        dialTo: `sip:${targetExtension.telnyxSipUsername}@sip.telnyx.com`,
        extensionNumber: targetExtension.extensionNumber,
        did: phoneRecord.number,
      },
      destinationType: DESTINATION_TYPE.DESK_SIP,
      routingFlow: ROUTING_FLOW.PSTN_TO_DESK,
      targetExtension,
      caller,
      ringResolution,
      error: null,
    };
  }

  if (targets.length === 1 && targets[0].type === 'phone') {
    return {
      destination: {
        dialTo: targets[0].phone,
        forwardTarget: true,
        did: phoneRecord.number,
      },
      destinationType: DESTINATION_TYPE.PSTN,
      routingFlow: ROUTING_FLOW.PSTN_TO_DESK,
      targetExtension,
      caller,
      ringResolution,
      error: null,
    };
  }

  return {
    destination: { did: phoneRecord.number },
    destinationType: DESTINATION_TYPE.UNKNOWN,
    routingFlow: ROUTING_FLOW.UNKNOWN,
    targetExtension,
    caller,
    ringResolution,
    error: 'no_ring_target',
  };
}

/**
 * @param {string} sessionId
 * @param {string|null|undefined} tenantId
 */
async function loadPstnSessionContext(sessionId, tenantId) {
  const session = await sessionManager.loadSession(sessionId, tenantId);
  const originLeg = (session.legs || []).find((leg) => leg.callControlId === session.primaryCallControlId)
    || (session.legs || []).find((leg) => leg.role === 'PSTN')
    || (session.legs || [])[0];
  if (!originLeg) {
    return { session: null, originLeg: null, error: 'origin_leg_not_found' };
  }
  return { session, originLeg, error: null };
}

module.exports = {
  isPstnInboundSession,
  isPstnOutboundStubSession,
  resolveDidOwnership,
  resolvePstnCaller,
  resolvePstnInboundDestination,
  loadPstnSessionContext,
};
