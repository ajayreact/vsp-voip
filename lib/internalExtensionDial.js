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

function getStartConnectFlow() {
  return require('./inboundCallControl').startConnectFlow;
}

const EXTENSION_DIAL_PATTERN = /^\d{2,6}$/;

function encodeClientState(data) {
  return Buffer.from(JSON.stringify(data)).toString('base64');
}

function isPstnDestination(to) {
  const digits = String(to || '').replace(/\D/g, '');
  return digits.length >= 10;
}

function parseInternalExtensionDestination(to) {
  if (!to || isPstnDestination(to)) return null;
  const raw = String(to).trim();
  const sipMatch = raw.match(/sip:(?:\+?)(\d{2,6})@/i);
  if (sipMatch) return sipMatch[1];
  const digits = raw.replace(/\D/g, '');
  if (EXTENSION_DIAL_PATTERN.test(digits)) return digits;
  return null;
}

function extractSipUsername(from) {
  const raw = String(from || '').trim();
  if (!raw) return null;
  if (raw.startsWith('sip:')) {
    const match = raw.match(/^sip:([^@;]+)/i);
    return match ? match[1] : null;
  }
  if (raw.includes('@')) return raw.split('@')[0];
  return raw;
}

async function resolveCallerFromAddress(prisma, from) {
  const sipUsername = extractSipUsername(from);
  if (!sipUsername) return null;

  const deskExtension = await prisma.extension.findFirst({
    where: { telnyxSipUsername: sipUsername, status: 'ACTIVE' },
    include: { user: true },
  });
  if (deskExtension) {
    return {
      tenantId: deskExtension.tenantId,
      callerExtension: deskExtension,
      user: deskExtension.user,
      sipUsername,
    };
  }

  const user = await prisma.user.findFirst({
    where: { telnyxSipUsername: sipUsername },
    include: {
      extensions: {
        where: { status: 'ACTIVE' },
        orderBy: { extensionNumber: 'asc' },
        take: 1,
      },
    },
  });
  if (!user?.tenantId) return null;

  return {
    tenantId: user.tenantId,
    callerExtension: user.extensions[0] || null,
    user,
    sipUsername,
  };
}

async function resolveCallerFromPayload(prisma, payload) {
  let caller = await resolveCallerFromAddress(prisma, payload?.from);
  if (caller?.tenantId) return caller;

  const extFromMatch = String(payload?.from || '').match(/^ext:(\d{2,6})$/i);
  if (extFromMatch) {
    const extension = await prisma.extension.findFirst({
      where: { extensionNumber: extFromMatch[1], status: 'ACTIVE' },
      include: { user: true },
    });
    if (extension?.user?.telnyxSipUsername) {
      return {
        tenantId: extension.tenantId,
        callerExtension: extension,
        user: extension.user,
        sipUsername: extension.user.telnyxSipUsername,
      };
    }
  }

  const headers = payload?.custom_headers;
  if (Array.isArray(headers)) {
    for (const header of headers) {
      const value = header?.header_value ?? header?.value;
      if (!value) continue;
      caller = await resolveCallerFromAddress(prisma, value);
      if (caller?.tenantId) return caller;
    }
  }

  for (const field of ['sip_from', 'calling_party_id']) {
    if (payload?.[field]) {
      caller = await resolveCallerFromAddress(prisma, payload[field]);
      if (caller?.tenantId) return caller;
    }
  }

  const { normalizePhoneNumber } = require('./phone');
  const normalizedFrom = normalizePhoneNumber(payload?.from);
  if (normalizedFrom) {
    const phoneRecord = await prisma.phoneNumber.findUnique({
      where: { number: normalizedFrom },
      select: { tenantId: true, assignedUserId: true },
    });
    if (phoneRecord?.assignedUserId) {
      const user = await prisma.user.findFirst({
        where: { id: phoneRecord.assignedUserId, tenantId: phoneRecord.tenantId },
        include: {
          extensions: {
            where: { status: 'ACTIVE' },
            orderBy: { extensionNumber: 'asc' },
            take: 1,
          },
        },
      });
      if (user?.telnyxSipUsername) {
        return {
          tenantId: phoneRecord.tenantId,
          callerExtension: user.extensions[0] || null,
          user,
          sipUsername: user.telnyxSipUsername,
        };
      }
    }
    if (phoneRecord?.tenantId) {
      caller = await resolveCallerFromAddress(prisma, payload?.sip_from || payload?.calling_party_id);
      if (caller?.tenantId === phoneRecord.tenantId) return caller;
    }
  }

  return null;
}

function isCredentialConnectionOutbound(payload, platform) {
  const credentialConnectionId = getCredentialConnectionId(platform);
  if (!credentialConnectionId || !payload?.connection_id) return false;
  if (String(payload.connection_id) !== String(credentialConnectionId)) return false;
  return String(payload.direction || '').toLowerCase() === 'outgoing';
}

async function loadTargetExtension(prisma, tenantId, extensionNumber) {
  return prisma.extension.findFirst({
    where: {
      tenantId,
      extensionNumber: String(extensionNumber).trim(),
      status: 'ACTIVE',
    },
    include: {
      forwarding: true,
      security: true,
      user: true,
    },
  });
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
    callSessionId: callControlId,
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
  const caller = await resolveCallerFromPayload(prisma, payload);
  if (!caller?.tenantId) {
    console.warn('   ↳ Parked WebRTC extension skipped: caller not resolved', {
      from: payload?.from || null,
      to: payload?.to || null,
      callControlId: payload?.call_control_id || null,
      targetExtensionNumber,
    });
    return false;
  }

  const tenant = await prisma.tenant.findUnique({ where: { id: caller.tenantId } });
  if (!tenant) return false;

  const targetExtension = await loadTargetExtension(prisma, tenant.id, targetExtensionNumber);
  const callControlId = payload.call_control_id;
  const credentialConnectionId = getCredentialConnectionId(platform);
  const callControlApplicationId = getCallControlApplicationId(platform);
  const greeting = await prisma.greeting.findUnique({ where: { tenantId: tenant.id } });

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

  const callerFrom = caller.callerExtension?.extensionNumber
    ? `ext:${caller.callerExtension.extensionNumber}`
    : payload.from;

  const policy = await resolveExtensionCallPolicy(
    prisma,
    tenant,
    targetExtension,
    callerFrom,
    { credentialConnectionId, trigger: 'internal' },
  );

  const vmTo = buildExtensionVoicemailToLabel(targetExtension.extensionNumber)
    || targetExtensionNumber;

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
    targetExtensionNumber,
    callerExtensionId: caller.callerExtension?.id || null,
    from: callerFrom,
    to: vmTo,
    credentialConnectionId,
    callControlApplicationId,
    stage: 'init',
  };

  await saveSession(callControlId, session);
  await answerCall(callControlId, encodeClientState({ tenantId: tenant.id, direction: 'internal' }));

  if (await applyInternalCallPolicyActions(prisma, session, policy)) {
    return true;
  }

  await beginInternalExtensionRing(prisma, {
    callControlId,
    tenant,
    targetExtension,
    callerFrom,
    callerExtension: caller.callerExtension,
    credentialConnectionId,
    callControlApplicationId,
    greeting,
    alreadyAnswered: true,
  });

  return true;
}

/**
 * Park Outbound (Pattern 1): connect parked WebRTC PSTN legs via dial + bridge_on_answer.
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

  const callControlApplicationId = getCallControlApplicationId(platform);
  if (!callControlApplicationId) {
    console.warn('   ↳ Parked WebRTC PSTN passthrough skipped: missing Call Control Application ID');
    return false;
  }

  const callControlId = payload.call_control_id;
  const to = String(payload.to || '').trim();
  const from = String(payload.from || '').trim();
  if (!callControlId || !to) {
    console.warn('   ↳ Parked WebRTC PSTN passthrough skipped: missing callControlId or destination', {
      callControlId: callControlId || null,
      destination: to || null,
    });
    return false;
  }

  console.log('   ↳ Parked WebRTC PSTN passthrough:', from, '→', to, {
    parkedLegId: callControlId,
    callControlApplicationId,
  });

  const { dialDestination } = require('./telnyxCallControl');
  try {
    const dialResult = await dialDestination(callControlId, {
      to,
      from,
      connectionId: callControlApplicationId,
      timeoutSecs: 45,
    });
    const outboundLegId = dialResult?.call_control_id || null;
    console.log('   ↳ Parked WebRTC PSTN passthrough dial created', {
      parkedLegId: callControlId,
      outboundLegId,
      to,
    });
    return true;
  } catch (error) {
    const telnyxDetail = error.telnyx?.errors?.[0]?.detail;
    console.error(
      `   ↳ Parked WebRTC PSTN passthrough dial failed (${error.status || 'error'}):`,
      telnyxDetail || error.message,
      { parkedLegId: callControlId, to, from, callControlApplicationId },
    );
    throw error;
  }
}

/**
 * Route parked WebRTC outbound (credential connection) into extension PBX or PSTN passthrough.
 * API-originate (Call Control app) legs are handled first via internal_api client_state.
 */
async function handleParkedWebRtcOutboundInitiated(prisma, payload, platform) {
  if (await handleInternalApiCallerInitiated(prisma, payload, platform)) {
    return true;
  }

  if (!isCredentialConnectionOutbound(payload, platform)) return false;

  const extensionNumber = parseInternalExtensionDestination(payload.to);
  if (extensionNumber) {
    const handled = await handleInternalExtensionCallInitiated(
      prisma,
      payload,
      platform,
      extensionNumber,
    );
    if (!handled) {
      console.warn('   ↳ Parked WebRTC extension routing failed:', {
        extensionNumber,
        from: payload?.from || null,
        callControlId: payload?.call_control_id || null,
      });
    }
    return handled;
  }

  return handleParkedPstnOutboundPassthrough(prisma, payload, platform);
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
  loadTargetExtension,
  handleInternalExtensionCallInitiated,
  handleParkedPstnOutboundPassthrough,
  handleParkedWebRtcOutboundInitiated,
  initiateInternalCallFromApi,
  handleInternalApiCallerInitiated,
  handleInternalApiCallerAnswered,
  beginInternalExtensionRing,
};
