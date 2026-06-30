const { getCredentialConnectionId } = require('../telnyxConfig');
const { getCallControlApplicationId } = require('../telnyxCallControlSetup');
const { buildExtensionVoicemailToLabel } = require('../voicemail');
const { loadTargetExtension } = require('./DestinationResolver');
const { resolveExtensionCallPolicy } = require('../extensionInbound');
const { resolveExtensionRingTargets, hasAppRingTargets } = require('../inboundRouting');
const { logDeskOutboundRoute } = require('./deskOutboundLogger');
const defaultBridge = require('./CallBridgeService');
const defaultCallState = require('./CallStateManager');

function encodeClientState(data) {
  return Buffer.from(JSON.stringify(data)).toString('base64');
}

function getBeginInternalExtensionRing() {
  return require('../internalExtensionDial').beginInternalExtensionRing;
}

function getApplyInternalCallPolicyActions() {
  return require('../internalExtensionDial').applyInternalCallPolicyActions;
}

function getLoadRingGroupByExtensionNumber() {
  return require('../ringGroupRouter').loadRingGroupByExtensionNumber;
}

const defaultDeps = {
  loadTargetExtension,
  loadRingGroupByExtensionNumber: (...args) => getLoadRingGroupByExtensionNumber()(...args),
  resolveExtensionCallPolicy,
  resolveExtensionRingTargets,
  hasAppRingTargets,
  beginInternalExtensionRing: (...args) => getBeginInternalExtensionRing()(...args),
  applyInternalCallPolicyActions: (...args) => getApplyInternalCallPolicyActions()(...args),
  callState: defaultCallState,
};

/**
 * Desk → extension outbound (V2 orchestration — reuses legacy policy, ring, connect flow).
 *
 * @returns {boolean|null} true/false when handled; null → legacy (ring group / unsupported)
 */
async function handleExtensionOutbound(ctx, deps = defaultDeps) {
  const {
    prisma,
    payload,
    platform,
    caller,
    destination,
    bridge = defaultBridge,
    callState = deps.callState,
  } = ctx;

  const extensionNumber = destination?.extensionNumber;
  const callControlId = payload?.call_control_id;
  const tenantId = destination?.tenantId ?? caller?.tenantId ?? null;

  if (!caller?.tenantId) {
    logDeskOutboundRoute({
      version: 'V2',
      destination: 'EXTENSION',
      result: 'skipped',
      reason: 'caller_not_resolved',
      callControlId: callControlId || null,
      extension: extensionNumber ?? null,
    });
    return false;
  }

  const tenant = await prisma.tenant.findUnique({ where: { id: caller.tenantId } });
  if (!tenant) {
    logDeskOutboundRoute({
      version: 'V2',
      destination: 'EXTENSION',
      result: 'skipped',
      reason: 'tenant_not_found',
      callControlId: callControlId || null,
      tenantId,
      extension: extensionNumber ?? null,
    });
    return false;
  }

  const targetExtension = await deps.loadTargetExtension(prisma, tenant.id, extensionNumber);
  if (!targetExtension) {
    const ringGroup = await deps.loadRingGroupByExtensionNumber(
      prisma,
      tenant.id,
      extensionNumber,
    );
    if (ringGroup) {
      logDeskOutboundRoute({
        version: 'V2',
        destination: 'EXTENSION',
        result: 'fallback',
        reason: 'ring_group_legacy',
        callControlId: callControlId || null,
        tenantId: tenant.id,
        extension: extensionNumber ?? null,
      });
      return null;
    }

    logDeskOutboundRoute({
      version: 'V2',
      destination: 'EXTENSION',
      result: 'unavailable',
      callControlId: callControlId || null,
      tenantId: tenant.id,
      extension: extensionNumber ?? null,
    });
    await bridge.answerParkedLeg(callControlId);
    await bridge.speakAndHangup(
      callControlId,
      `Extension ${extensionNumber} is not available. Goodbye.`,
      encodeClientState({ stage: 'hangup' }),
    );
    return true;
  }

  const credentialConnectionId = getCredentialConnectionId(platform);

  if (!ctx.skipMobileGate) {
    const ringPreview = await deps.resolveExtensionRingTargets(
      prisma,
      targetExtension,
      credentialConnectionId,
    );
    if (deps.hasAppRingTargets(ringPreview?.targets || [])) {
      logDeskOutboundRoute({
        version: 'V2',
        destination: 'EXTENSION',
        result: 'fallback',
        reason: 'mobile_app_targets',
        callControlId: callControlId || null,
        tenantId: tenant.id,
        extension: extensionNumber ?? null,
      });
      return null;
    }
  }

  const callControlApplicationId = getCallControlApplicationId(platform);

  if (!callControlApplicationId) {
    logDeskOutboundRoute({
      version: 'V2',
      destination: 'EXTENSION',
      result: 'skipped',
      reason: 'missing_call_control_application_id',
      callControlId: callControlId || null,
      tenantId: tenant.id,
      extension: extensionNumber ?? null,
    });
    await bridge.answerParkedLeg(callControlId);
    await bridge.speakAndHangup(
      callControlId,
      'Your call cannot be completed at this time. Goodbye.',
      encodeClientState({ stage: 'hangup' }),
    );
    return true;
  }

  const greeting = await prisma.greeting.findUnique({ where: { tenantId: tenant.id } });
  const callerFrom = caller.callerExtension?.extensionNumber
    ? `ext:${caller.callerExtension.extensionNumber}`
    : payload.from;

  const policy = await deps.resolveExtensionCallPolicy(
    prisma,
    tenant,
    targetExtension,
    callerFrom,
    { credentialConnectionId, trigger: 'internal' },
  );

  const vmTo = buildExtensionVoicemailToLabel(targetExtension.extensionNumber)
    || extensionNumber;

  const session = {
    callControlId,
    callSessionId: payload.call_session_id || callControlId,
    callKind: 'internal',
    tenantId: tenant.id,
    tenant,
    greeting: greeting || {},
    phoneRecord: null,
    targetExtensionId: targetExtension.id,
    voicemailExtensionId: targetExtension.id,
    targetExtensionNumber: extensionNumber,
    callerExtensionId: caller.callerExtension?.id || null,
    from: callerFrom,
    to: vmTo,
    credentialConnectionId,
    callControlApplicationId,
    stage: 'init',
  };

  logDeskOutboundRoute({
    version: 'V2',
    destination: 'EXTENSION',
    phase: 'route_selected',
    callControlId,
    tenantId: tenant.id,
    extension: extensionNumber,
    targetExtensionId: targetExtension.id,
  });

  await callState.createSession(callControlId, session);
  await bridge.answerParkedLeg(
    callControlId,
    encodeClientState({ tenantId: tenant.id, direction: 'internal' }),
  );

  if (await deps.applyInternalCallPolicyActions(prisma, session, policy)) {
    logDeskOutboundRoute({
      version: 'V2',
      destination: 'EXTENSION',
      result: 'policy_applied',
      callControlId,
      tenantId: tenant.id,
      extension: extensionNumber,
    });
    return true;
  }

  await deps.beginInternalExtensionRing(prisma, {
    callControlId,
    tenant,
    targetExtension,
    callerFrom,
    callerExtension: caller.callerExtension,
    credentialConnectionId,
    callControlApplicationId,
    greeting,
    alreadyAnswered: true,
    callSessionId: payload.call_session_id || callControlId,
  });

  logDeskOutboundRoute({
    version: 'V2',
    destination: 'EXTENSION',
    result: 'ring_started',
    callControlId,
    tenantId: tenant.id,
    extension: extensionNumber,
  });

  return true;
}

module.exports = {
  handleExtensionOutbound,
  defaultDeps,
};
