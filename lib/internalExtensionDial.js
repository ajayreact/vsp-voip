const { getCredentialConnectionId } = require('./telnyxConfig');
const { getCallControlApplicationId } = require('./telnyxCallControlSetup');
const { formatWebRtcDialTo, telnyxApiRequest } = require('./telnyxCallControl');
const { resolveExtensionRingTargets } = require('./inboundRouting');
const { resolveExtensionCallPolicy } = require('./extensionInbound');
const { getApiPublicUrl } = require('./telnyxRecordingSetup');
const { buildExtensionVoicemailToLabel } = require('./voicemail');
const {
  saveSession,
  getSession,
} = require('./callControlSession');
const {
  loadRingGroupByExtensionNumber,
  resolveRingGroupEntityTargets,
} = require('./ringGroupRouter');
const { answerCall, speakCall } = require('./telnyxCallControl');
const { EXTENSION_DIAL_PATTERN } = require('./telephony/constants');
const { logDeskOutboundRoute } = require('./telephony/deskOutboundLogger');
const {
  isPstnDestination,
  parseInternalExtensionDestination,
  isTelnyxCredentialSipDestination,
  isOutboundDirection,
  isValidE164CallerId,
  describeCredentialConnectionOutboundGate,
  isCredentialConnectionOutbound,
} = require('./telephony/PayloadNormalizer');
const {
  resolveCallerFromAddress,
  resolveCallerFromPayload,
  resolveCallerFromUniqueRegisteredExtension,
  resolveParkedOutboundPstnFrom,
} = require('./telephony/CallerResolver');
const {
  loadTargetExtension,
  loadTargetExtensionByDid,
  resolveExtensionNumberFromTo,
} = require('./telephony/DestinationResolver');

function getStartConnectFlow() {
  return require('./inboundCallControl').startConnectFlow;
}

function encodeClientState(data) {
  return Buffer.from(JSON.stringify(data)).toString('base64');
}

function logParkedOutboundPayloadContext(payload) {
  console.log('[INTERNAL CALL] parked outbound payload', {
    from: payload?.from || null,
    sip_username: payload?.sip_username || null,
    username: payload?.username || null,
    credential_username: payload?.credential_username || null,
    calling_party_id: payload?.calling_party_id || null,
    caller_id_number: payload?.caller_id_number || null,
    connection_id: payload?.connection_id || null,
    to: payload?.to || null,
    direction: payload?.direction || null,
    call_control_id: payload?.call_control_id || null,
  });
}

async function speakOutboundFailure(callControlId) {
  try {
    await answerCall(callControlId);
    await speakCall(
      callControlId,
      'Your call cannot be completed. Goodbye.',
      encodeClientState({ stage: 'hangup' }),
    );
  } catch (error) {
    console.warn('   ↳ Outbound failure cleanup failed:', error.message);
  }
}

async function applyInternalCallPolicyActions(prisma, session, policy) {
  const callControlId = session.callControlId;

  if (policy?.action === 'block') {
    await speakCall(
      callControlId,
      'Your call cannot be completed at this time. Goodbye.',
      encodeClientState({ stage: 'hangup' }),
    );
    return true;
  }

  if (policy?.action === 'voicemail') {
    const { routeToVoicemailOrHangup } = require('./inboundCallControl');
    await routeToVoicemailOrHangup(session, { reason: policy.reason || 'Do not disturb' });
    return true;
  }

  if (policy?.action === 'forward') {
    session.preResolvedTargets = policy.targets;
    session.ringTimeout = policy.ringTimeout || 25;
    session.ringStrategy = policy.strategy || 'simultaneous';
    session.extensionPolicyReason = policy.reason;
    await saveSession(callControlId, session);
    await getStartConnectFlow()(session, prisma, { skipAnnouncements: true });
    return true;
  }

  return false;
}

async function beginInternalExtensionRing(
  prisma,
  {
    callControlId,
    tenant,
    targetExtension,
    callerFrom,
    callerExtension,
    credentialConnectionId,
    callControlApplicationId,
    greeting,
    alreadyAnswered = false,
    callSessionId,
  },
) {
  const resolution = await resolveExtensionRingTargets(
    prisma,
    targetExtension,
    credentialConnectionId,
  );

  const vmTo = buildExtensionVoicemailToLabel(targetExtension.extensionNumber)
    || targetExtension.extensionNumber;

  const session = {
    callControlId,
    callSessionId: callSessionId || callControlId,
    callKind: 'internal',
    tenantId: tenant.id,
    tenant,
    greeting: greeting || {},
    phoneRecord: null,
    targetExtensionId: targetExtension.id,
    voicemailExtensionId: targetExtension.id,
    targetExtensionNumber: targetExtension.extensionNumber,
    callerExtensionId: callerExtension?.id || null,
    from: callerFrom,
    to: vmTo,
    credentialConnectionId,
    callControlApplicationId,
    preResolvedTargets: resolution?.targets || [],
    ringTimeout: resolution?.ringTimeout || 25,
    ringStrategy: resolution?.strategy || 'sequential',
    stage: 'init',
  };

  await saveSession(callControlId, session);
  if (!alreadyAnswered) {
    await answerCall(callControlId, encodeClientState({ tenantId: tenant.id, direction: 'internal' }));
  }

  if (!session.preResolvedTargets.length) {
    await speakCall(
      callControlId,
      `Extension ${targetExtension.extensionNumber} is not available. Goodbye.`,
      encodeClientState({ stage: 'hangup' }),
    );
    return session;
  }

  await getStartConnectFlow()(session, prisma, { skipAnnouncements: true });
  return session;
}

async function handleInternalRingGroupCallInitiated(
  prisma,
  payload,
  platform,
  tenant,
  caller,
  targetExtensionNumber,
  ringGroup,
) {
  const callControlId = payload.call_control_id;
  const credentialConnectionId = getCredentialConnectionId(platform);
  const callControlApplicationId = getCallControlApplicationId(platform);
  const greeting = await prisma.greeting.findUnique({ where: { tenantId: tenant.id } });
  const resolution = await resolveRingGroupEntityTargets(prisma, ringGroup, credentialConnectionId);

  const callerFrom = caller.callerExtension?.extensionNumber
    ? `ext:${caller.callerExtension.extensionNumber}`
    : payload.from;

  const session = {
    callControlId,
    callSessionId: payload.call_session_id || callControlId,
    callKind: 'internal',
    tenantId: tenant.id,
    tenant,
    greeting: greeting || {},
    phoneRecord: null,
    targetExtensionNumber,
    ringGroupId: ringGroup.id,
    ringGroup,
    callerExtensionId: caller.callerExtension?.id || null,
    from: callerFrom,
    to: targetExtensionNumber,
    credentialConnectionId,
    callControlApplicationId,
    preResolvedTargets: resolution?.targets || [],
    ringTimeout: resolution?.ringTimeout || 25,
    ringStrategy: resolution?.strategy || 'sequential',
    stage: 'init',
  };

  await saveSession(callControlId, session);
  await answerCall(
    callControlId,
    encodeClientState({ tenantId: tenant.id, direction: 'internal', ringGroupId: ringGroup.id }),
  );

  if (!session.preResolvedTargets.length) {
    await speakCall(
      callControlId,
      `Extension ${targetExtensionNumber} is not available. Goodbye.`,
      encodeClientState({ stage: 'hangup' }),
    );
    return true;
  }

  await getStartConnectFlow()(session, prisma, { skipAnnouncements: true });
  return true;
}

async function handleInternalExtensionCallInitiated(prisma, payload, platform, targetExtensionNumber) {
  const callControlId = payload.call_control_id;
  const caller = await resolveCallerFromPayload(prisma, payload, platform);

  logDeskOutboundRoute({
    event: 'desk.outbound.route',
    phase: 'legacy_extension',
    extension: targetExtensionNumber,
    callControlId,
    callerResolved: Boolean(caller?.tenantId),
  });

  if (!caller?.tenantId) {
    console.warn('   ↳ Parked WebRTC extension skipped: caller not resolved', {
      from: payload?.from || null,
      to: payload?.to || null,
      callControlId,
      targetExtensionNumber,
    });
    return false;
  }

  const tenant = await prisma.tenant.findUnique({ where: { id: caller.tenantId } });
  if (!tenant) return false;

  const targetExtension = await loadTargetExtension(prisma, tenant.id, targetExtensionNumber);
  if (!targetExtension) {
    const ringGroup = await loadRingGroupByExtensionNumber(prisma, tenant.id, targetExtensionNumber);
    if (ringGroup) {
      return handleInternalRingGroupCallInitiated(
        prisma,
        payload,
        platform,
        tenant,
        caller,
        targetExtensionNumber,
        ringGroup,
      );
    }

    await answerCall(callControlId);
    await speakCall(
      callControlId,
      `Extension ${targetExtensionNumber} is not available. Goodbye.`,
      encodeClientState({ stage: 'hangup' }),
    );
    return true;
  }

  const { handleExtensionOutbound } = require('./telephony/ExtensionCallService');
  const result = await handleExtensionOutbound({
    prisma,
    payload,
    platform,
    caller,
    destination: {
      kind: 'EXTENSION',
      extensionNumber: targetExtensionNumber,
      tenantId: tenant.id,
    },
    skipMobileGate: true,
  });

  return result === true;
}

/**
 * Mobile credential PSTN passthrough — delegates to PstnCallService.
 */
async function handleParkedPstnOutboundPassthrough(prisma, payload, platform) {
  const expectedConnectionId = getCredentialConnectionId(platform);

  if (!isCredentialConnectionOutbound(payload, platform)) {
    console.warn('   ↳ Parked WebRTC PSTN passthrough skipped: credential connection mismatch', {
      payloadConnectionId: payload?.connection_id || null,
      expectedConnectionId: expectedConnectionId || null,
      direction: payload?.direction || null,
    });
    return false;
  }

  if (!isPstnDestination(payload.to)) {
    console.warn('   ↳ Parked WebRTC PSTN passthrough skipped: destination is not PSTN', {
      destination: payload?.to || null,
    });
    return false;
  }

  if (!getCallControlApplicationId(platform)) {
    console.warn('   ↳ Parked WebRTC PSTN passthrough skipped: missing Call Control Application ID');
    return false;
  }

  const callControlId = payload.call_control_id;
  const to = String(payload.to || '').trim();
  if (!callControlId || !to) {
    console.warn('   ↳ Parked WebRTC PSTN passthrough skipped: missing callControlId or destination', {
      callControlId: callControlId || null,
      destination: to || null,
    });
    return false;
  }

  const caller = await resolveCallerFromPayload(prisma, payload, platform);
  const { handlePstnOutbound } = require('./telephony/PstnCallService');

  logDeskOutboundRoute({
    event: 'desk.outbound.route',
    phase: 'legacy_pstn',
    callControlId,
    to,
    tenantId: caller?.tenantId ?? null,
  });

  try {
    return await handlePstnOutbound({
      prisma,
      payload,
      platform,
      caller,
      destination: {
        kind: 'PSTN',
        pstnNumber: to,
        tenantId: caller?.tenantId ?? null,
      },
    });
  } catch (error) {
    const telnyxDetail = error.telnyx?.errors?.[0]?.detail;
    console.error(
      `   ↳ Parked WebRTC PSTN passthrough dial failed (${error.status || 'error'}):`,
      telnyxDetail || error.message,
      { parkedLegId: callControlId, to },
    );
    throw error;
  }
}

/**
 * Route parked WebRTC outbound into V2 desk router or legacy mobile-credential handlers.
 */
async function handleParkedWebRtcOutboundInitiated(prisma, payload, platform) {
  const callControlId = payload?.call_control_id || null;

  logDeskOutboundRoute({
    event: 'desk.outbound.route',
    phase: 'enter',
    handler: 'handleParkedWebRtcOutboundInitiated',
    callControlId,
    destination: payload?.to || null,
    connection_id: payload?.connection_id || null,
  });

  if (await handleInternalApiCallerInitiated(prisma, payload, platform)) {
    logDeskOutboundRoute({ event: 'desk.outbound.route', result: 'internal_api', callControlId });
    return true;
  }

  const outboundGate = describeCredentialConnectionOutboundGate(payload, platform);
  if (!outboundGate.ok) {
    console.warn('   ↳ Parked WebRTC outbound skipped:', outboundGate);
    logDeskOutboundRoute({
      event: 'desk.outbound.route',
      result: 'skipped',
      reason: outboundGate.reason,
      callControlId,
    });
    return false;
  }

  logParkedOutboundPayloadContext(payload);

  const { isCallControlApplicationOutbound } = require('./telephony/PayloadNormalizer');
  const { routeDeskOutbound } = require('./telephony/DeskCallRouter');
  const { isDeskCallRouterV2Enabled } = require('./telephony/constants');

  let resolvedCaller = null;
  let callerProvided = false;

  if (isPstnDestination(payload.to)) {
    resolvedCaller = await resolveCallerFromPayload(prisma, payload, platform, {
      logCallerResolved: true,
    });
    callerProvided = Boolean(resolvedCaller?.tenantId);
    if (resolvedCaller?.tenantId) {
      const targetByDid = await loadTargetExtensionByDid(prisma, resolvedCaller.tenantId, payload.to);
      if (targetByDid?.extensionNumber) {
        logDeskOutboundRoute({
          event: 'desk.outbound.route',
          routing: 'tenant_did_to_extension',
          extension: targetByDid.extensionNumber,
          callControlId,
        });
        const handled = await handleInternalExtensionCallInitiated(
          prisma,
          payload,
          platform,
          targetByDid.extensionNumber,
        );
        if (handled) return true;
      }
    }
  }

  let extensionNumber = parseInternalExtensionDestination(payload.to);
  if (!extensionNumber && isTelnyxCredentialSipDestination(payload.to)) {
    if (!resolvedCaller?.tenantId) {
      resolvedCaller = await resolveCallerFromPayload(prisma, payload, platform, {
        logCallerResolved: true,
      });
      callerProvided = Boolean(resolvedCaller?.tenantId);
    }
    extensionNumber = await resolveExtensionNumberFromTo(
      prisma,
      payload.to,
      resolvedCaller?.tenantId ?? null,
    );
    if (extensionNumber) {
      logDeskOutboundRoute({
        event: 'desk.outbound.route',
        phase: 'destination_resolved',
        extension: extensionNumber,
        resolvedVia: resolvedCaller?.tenantId ? 'credential_sip' : 'credential_sip_global',
        callControlId,
      });
    }
  }

  if (isDeskCallRouterV2Enabled() && isCallControlApplicationOutbound(payload, platform)) {
    if (!callerProvided && extensionNumber) {
      resolvedCaller = await resolveCallerFromPayload(prisma, payload, platform, {
        logCallerResolved: true,
      });
      callerProvided = Boolean(resolvedCaller?.tenantId);
    }

    const v2Result = await routeDeskOutbound(
      prisma,
      payload,
      platform,
      { caller: resolvedCaller, callerProvided, extensionNumber },
    );

    if (v2Result !== null) {
      if (extensionNumber && !v2Result) {
        await speakOutboundFailure(callControlId);
      }
      logDeskOutboundRoute({
        event: 'desk.outbound.route',
        result: v2Result ? 'handled' : 'failed',
        routing: 'v2',
        callControlId,
      });
      return extensionNumber ? true : v2Result;
    }
  }

  if (extensionNumber) {
    const handled = await handleInternalExtensionCallInitiated(
      prisma,
      payload,
      platform,
      extensionNumber,
    );
    if (!handled) await speakOutboundFailure(callControlId);
    return true;
  }

  if (isPstnDestination(payload.to)) {
    return handleParkedPstnOutboundPassthrough(prisma, payload, platform);
  }

  logDeskOutboundRoute({
    event: 'desk.outbound.route',
    result: 'unsupported_destination',
    callControlId,
    destination: payload?.to || null,
    credentialSip: isTelnyxCredentialSipDestination(payload?.to),
    callerResolved: Boolean(resolvedCaller?.tenantId),
  });
  return false;
}

async function initiateInternalCallFromApi(prisma, tenantId, userId, targetExtensionNumber, platform) {
  if (!EXTENSION_DIAL_PATTERN.test(String(targetExtensionNumber).trim())) {
    throw Object.assign(new Error('Extension number must be 2–6 digits'), { status: 400 });
  }

  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
  if (!tenant) throw Object.assign(new Error('Organization not found'), { status: 404 });

  const callerExtension = await prisma.extension.findFirst({
    where: { tenantId, userId, status: 'ACTIVE' },
    include: { user: true },
  });

  const callerUser = callerExtension?.user
    || await prisma.user.findFirst({ where: { id: userId, tenantId } });

  if (!callerUser?.telnyxSipUsername) {
    throw Object.assign(
      new Error('Open the softphone once to register before placing internal calls'),
      { status: 400 },
    );
  }

  const targetExtension = await loadTargetExtension(prisma, tenantId, targetExtensionNumber);
  if (!targetExtension) {
    throw Object.assign(new Error(`Extension ${targetExtensionNumber} not found`), { status: 404 });
  }

  const credentialConnectionId = getCredentialConnectionId(platform);
  const callControlApplicationId = getCallControlApplicationId(platform);
  if (!callControlApplicationId) {
    throw Object.assign(new Error('Call Control application is not configured'), { status: 503 });
  }

  const callerFrom = callerExtension
    ? `ext:${callerExtension.extensionNumber}`
    : `user:${callerUser.id}`;

  const policy = await resolveExtensionCallPolicy(
    prisma,
    tenant,
    targetExtension,
    callerFrom,
    { credentialConnectionId, trigger: 'internal' },
  );

  if (policy?.action === 'block') {
    throw Object.assign(new Error(policy.reason || 'Call blocked by security policy'), { status: 403 });
  }

  const resolution = await resolveExtensionRingTargets(
    prisma,
    targetExtension,
    credentialConnectionId,
  );

  if (!resolution?.targets?.length && policy?.action !== 'forward') {
    throw Object.assign(new Error(`Extension ${targetExtensionNumber} has no reachable devices`), { status: 400 });
  }

  const apiPublic = getApiPublicUrl();
  const webhookUrl = apiPublic ? `${apiPublic}/webhook/call-control` : null;

  const clientState = encodeClientState({
    callKind: 'internal_api',
    tenantId,
    targetExtensionNumber,
    targetExtensionId: targetExtension.id,
    callerUserId: userId,
    callerExtensionId: callerExtension?.id || null,
    callerFrom,
    pendingPolicy: policy?.action !== 'ring' ? policy : null,
    preResolvedTargets: policy?.action === 'forward' ? policy.targets : resolution.targets,
    ringTimeout: policy?.ringTimeout || resolution.ringTimeout,
    ringStrategy: policy?.strategy || resolution.strategy,
  });

  const dialTo = formatWebRtcDialTo(callerUser.telnyxSipUsername);
  const fromLabel = callerExtension
    ? `Ext ${callerExtension.extensionNumber}`
    : callerUser.name;

  const originated = await telnyxApiRequest('post', '/calls', {
    to: dialTo,
    from: fromLabel,
    connection_id: callControlApplicationId,
    timeout_secs: 45,
    ...(webhookUrl ? { webhook_url: webhookUrl } : {}),
    client_state: clientState,
  });

  const callControlId = originated?.call_control_id;
  if (!callControlId) {
    throw Object.assign(new Error('Telnyx did not return a call control id'), { status: 502 });
  }

  return {
    callControlId,
    targetExtensionNumber,
    targetDisplayName: targetExtension.displayName,
    ringStrategy: policy?.strategy || resolution.strategy,
    targetCount: (policy?.targets || resolution.targets)?.length || 0,
    policyAction: policy?.action || 'ring',
  };
}

async function handleInternalApiCallerInitiated(prisma, payload, platform) {
  let state = null;
  try {
    state = payload.client_state
      ? JSON.parse(Buffer.from(String(payload.client_state), 'base64').toString('utf8'))
      : null;
  } catch {
    return false;
  }

  if (state?.callKind !== 'internal_api') return false;

  const tenant = await prisma.tenant.findUnique({ where: { id: state.tenantId } });
  if (!tenant) return false;

  const callControlId = payload.call_control_id;
  const credentialConnectionId = getCredentialConnectionId(platform);
  const callControlApplicationId = getCallControlApplicationId(platform);
  const greeting = await prisma.greeting.findUnique({ where: { tenantId: tenant.id } });

  const vmTo = buildExtensionVoicemailToLabel(state.targetExtensionNumber)
    || state.targetExtensionNumber;

  const session = {
    callControlId,
    callSessionId: payload.call_session_id || callControlId,
    callKind: 'internal',
    tenantId: tenant.id,
    tenant,
    greeting: greeting || {},
    phoneRecord: null,
    targetExtensionId: state.targetExtensionId,
    voicemailExtensionId: state.targetExtensionId,
    targetExtensionNumber: state.targetExtensionNumber,
    callerExtensionId: state.callerExtensionId,
    from: state.callerFrom,
    to: vmTo,
    credentialConnectionId,
    callControlApplicationId,
    preResolvedTargets: state.preResolvedTargets || [],
    ringTimeout: state.ringTimeout || 25,
    ringStrategy: state.ringStrategy || 'sequential',
    stage: 'init',
  };

  await saveSession(callControlId, session);

  const policy = state.pendingPolicy || { action: 'ring' };
  if (await applyInternalCallPolicyActions(prisma, session, policy)) {
    return true;
  }

  return true;
}

async function handleInternalApiCallerAnswered(prisma, payload) {
  let state = null;
  try {
    state = payload.client_state
      ? JSON.parse(Buffer.from(String(payload.client_state), 'base64').toString('utf8'))
      : null;
  } catch {
    return false;
  }

  if (state?.callKind !== 'internal_api') return false;

  const callControlId = payload.call_control_id;
  let session = await getSession(callControlId);
  if (!session) {
    const platform = await require('./platformSettings').loadPlatformSettings(prisma);
    const vmTo = buildExtensionVoicemailToLabel(state.targetExtensionNumber)
      || state.targetExtensionNumber;
    session = {
      callControlId,
      callSessionId: payload.call_session_id || callControlId,
      callKind: 'internal',
      tenantId: state.tenantId,
      tenant: await prisma.tenant.findUnique({ where: { id: state.tenantId } }),
      greeting: await prisma.greeting.findUnique({ where: { tenantId: state.tenantId } }) || {},
      phoneRecord: null,
      targetExtensionId: state.targetExtensionId,
      voicemailExtensionId: state.targetExtensionId,
      targetExtensionNumber: state.targetExtensionNumber,
      callerExtensionId: state.callerExtensionId,
      from: state.callerFrom,
      to: vmTo,
      credentialConnectionId: getCredentialConnectionId(platform),
      callControlApplicationId: getCallControlApplicationId(platform),
      preResolvedTargets: state.preResolvedTargets || [],
      ringTimeout: state.ringTimeout || 25,
      ringStrategy: state.ringStrategy || 'sequential',
      stage: 'init',
    };
    await saveSession(callControlId, session);
  }

  if (!session.preResolvedTargets?.length) return true;

  await getStartConnectFlow()(session, prisma, { skipAnnouncements: true });
  return true;
}

module.exports = {
  EXTENSION_DIAL_PATTERN,
  parseInternalExtensionDestination,
  isPstnDestination,
  isCredentialConnectionOutbound,
  resolveCallerFromAddress,
  resolveCallerFromPayload,
  resolveCallerFromUniqueRegisteredExtension,
  resolveParkedOutboundPstnFrom,
  isValidE164CallerId,
  isOutboundDirection,
  describeCredentialConnectionOutboundGate,
  loadTargetExtension,
  loadTargetExtensionByDid,
  applyInternalCallPolicyActions,
  handleInternalExtensionCallInitiated,
  handleParkedPstnOutboundPassthrough,
  handleParkedWebRtcOutboundInitiated,
  initiateInternalCallFromApi,
  handleInternalApiCallerInitiated,
  handleInternalApiCallerAnswered,
  beginInternalExtensionRing,
};
