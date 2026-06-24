const { normalizePhoneNumber } = require('./phone');
const { resolveGreetingMessage } = require('./greeting');
const { isWithinBusinessHours } = require('./businessHours');
const { applyNumberRoutingToGreeting } = require('./numberRouting');
const { normalizeIvrOptions } = require('./callRouting');
const { buildRecordingClientState } = require('./callRecording');
const { buildVoicemailClientStateFromSession, clampVoicemailMaxLength } = require('./voicemail');
const { getCachedTenant, setCachedTenant } = require('./tenantCache');
const { isTenantOperational } = require('./tenantGuard');
const { getCredentialConnectionId } = require('./telnyxConfig');
const { loadPlatformSettings } = require('./platformSettings');
const {
  hasAppRingMembers,
  hasAppRingTargets,
  resolveRingTargets,
  formatTargetDialTo,
  resolveExtensionForPhoneRecord,
} = require('./inboundRouting');
const { resolveExtensionInboundPolicy, applyExtensionFallback } = require('./extensionInbound');
const {
  recordRingGroupOffered,
  recordRingGroupAnswered,
  recordRingGroupMissed,
  markMembersRung,
} = require('./ringGroups');
const { syncPhoneNumbersToCallControlApp, getCallControlApplicationId } = require('./telnyxCallControlSetup');
const {
  answerCall,
  speakCall,
  gatherUsingSpeak,
  dialDestination,
  hangupCall,
  startCallRecording,
  startVoicemailRecording,
} = require('./telnyxCallControl');
const {
  getSession,
  saveSession,
  deleteSession,
  pruneStaleSessions,
  findSession,
  claimConnectedLeg,
  claimAnswerSideEffects,
  getClaimedWinner,
  indexOutboundLeg,
} = require('./callControlSession');
const { recordCallQualityFromTelnyxEvent } = require('./voiceTelemetry');
const { recordRaceConditionPrevented } = require('./telephonyHealth');

const ONLINE_WINDOW_MS = 5 * 60 * 1000;

function encodeClientState(data) {
  return Buffer.from(JSON.stringify(data)).toString('base64');
}

function decodeClientState(clientState) {
  if (!clientState) return null;
  try {
    return JSON.parse(Buffer.from(String(clientState), 'base64').toString('utf8'));
  } catch {
    return null;
  }
}

function isUserOnline(user) {
  if (!user?.softphoneOnlineAt || !user?.telnyxSipUsername) return false;
  return new Date(user.softphoneOnlineAt).getTime() >= Date.now() - ONLINE_WINDOW_MS;
}

function resolveOpenHoursMessage(greeting, tenantName) {
  const template = greeting?.message || 'Welcome to {company}. Please hold while we connect you.';
  return resolveGreetingMessage(template, tenantName);
}

function resolveClosedMessage(greeting, tenantName) {
  const template = greeting?.afterHoursMessage
    || 'Thank you for calling {company}. We are currently closed.';
  return resolveGreetingMessage(template, tenantName);
}

function resolveNoAnswerMessage(greeting, tenantName) {
  const template = greeting?.noAnswerMessage
    || 'Sorry, no one is available at {company} right now. Goodbye.';
  return resolveGreetingMessage(template, tenantName);
}

function resolveVoicemailPrompt(greeting, tenantName) {
  const template = greeting?.voicemailPrompt
    || 'Sorry we missed your call at {company}. Please leave a message after the beep.';
  return resolveGreetingMessage(template, tenantName);
}

function logCallControlDiagnostics(eventType, payload, session, inboundCallControlId, extra = {}) {
  console.log('[CALL CONTROL] webhook', {
    eventType,
    sessionId: inboundCallControlId || session?.callControlId || null,
    callControlId: payload?.call_control_id || null,
    stage: session?.stage || null,
    winnerLeg: session?.winnerLeg || session?.connectedLeg || null,
    connectedAt: session?.connectedAt || null,
    activeBridge: session?.activeBridge === true,
    timestamp: new Date().toISOString(),
    ...extra,
  });
}

function hasBridgedState(session) {
  return Boolean(
    session?.stage === 'bridged'
    || session?.stage === 'connected'
    || session?.activeBridge === true
    || session?.winnerLeg
    || session?.connectedAt
    || session?.connectedLeg
  );
}

async function hasActiveWinner(session, inboundCallControlId) {
  if (hasBridgedState(session)) return true;
  if (!inboundCallControlId) return false;
  return Boolean(await getClaimedWinner(inboundCallControlId));
}

async function logInboundCallStart(prisma, session) {
  if (!session?.callSessionId) return;
  await prisma.callLog.upsert({
    where: { callSid: session.callSessionId },
    create: {
      callSid: session.callSessionId,
      from: session.from,
      to: session.to,
      status: 'ringing',
      tenantId: session.tenantId,
      direction: 'inbound',
      callType: 'inbound',
    },
    update: {
      status: 'ringing',
      tenantId: session.tenantId,
    },
  });
}

async function startVoicemailCapture(session) {
  const { callControlId, greeting, tenant, ringGroup } = session;
  const prompt = resolveVoicemailPrompt(greeting, tenant.name);
  session.stage = 'voicemail_prompt';
  await saveSession(callControlId, session);
  await speakCall(
    callControlId,
    prompt,
    encodeClientState({ stage: 'voicemail_record' }),
  );
}

async function routeToVoicemailOrHangup(session, { reason, fallbackTrigger } = {}) {
  if (await hasActiveWinner(session, session?.callControlId)) {
    console.log('[CALL CONTROL] Voicemail bypassed because call already bridged', {
      sessionId: session?.callControlId || null,
      stage: session?.stage || null,
      winnerLeg: session?.winnerLeg || session?.connectedLeg || null,
      timestamp: new Date().toISOString(),
    });
    recordRaceConditionPrevented({
      source: 'routeToVoicemailOrHangup',
      sessionId: session?.callControlId || null,
      stage: session?.stage || null,
      winnerLeg: session?.winnerLeg || session?.connectedLeg || null,
    });
    return;
  }

  if (reason) {
    console.log(`   ↳ Routing to voicemail: ${reason}`);
  }

  if (fallbackTrigger && (session.phoneRecord || session.callKind === 'internal')) {
    const { getPrisma } = require('../db');
    const prisma = await getPrisma();
    const forwarded = await applyExtensionFallback(session, prisma, fallbackTrigger);
    if (forwarded) {
      console.log(`   ↳ Extension ${fallbackTrigger} forward applied`);
      session.stage = 'connect';
      await saveSession(session.callControlId, session);
      await startRinging(session, prisma);
      return;
    }
  }

  const groupVmEnabled = session.ringGroup?.voicemailEnabled;
  const tenantVmEnabled = session.greeting?.voicemailEnabled !== false;
  const voicemailAllowed = session.ringGroupId
    ? groupVmEnabled !== false
    : tenantVmEnabled;

  if (session.ringGroupId && !voicemailAllowed) {
    const { getPrisma } = require('../db');
    const prisma = await getPrisma();
    await recordRingGroupMissed(prisma, session.ringGroupId, session.callSessionId);
    await speakCall(
      session.callControlId,
      resolveNoAnswerMessage(session.greeting, session.tenant.name),
      encodeClientState({ stage: 'hangup' }),
    );
    return;
  }

  if (voicemailAllowed) {
    if (session.ringGroupId) {
      const { getPrisma } = require('../db');
      const prisma = await getPrisma();
      await recordRingGroupMissed(prisma, session.ringGroupId, session.callSessionId);
    }
    await startVoicemailCapture(session);
    return;
  }

  if (session.ringGroupId) {
    const { getPrisma } = require('../db');
    const prisma = await getPrisma();
    await recordRingGroupMissed(prisma, session.ringGroupId, session.callSessionId);
  }

  await speakCall(
    session.callControlId,
    resolveNoAnswerMessage(session.greeting, session.tenant.name),
    encodeClientState({ stage: 'hangup' }),
  );
}

function resolveRecordingNotice(greeting, tenantName) {
  const template = greeting?.callRecordingNotice
    || 'This call may be recorded for quality and training purposes.';
  return resolveGreetingMessage(template, tenantName);
}

async function resolveInboundContext(prisma, payload) {
  const to = normalizePhoneNumber(payload.to);
  const from = normalizePhoneNumber(payload.from);
  if (!to) return null;

  let tenant = await getCachedTenant(to);
  let greeting = null;
  let phoneRecord = null;

  if (tenant) {
    greeting = await prisma.greeting.findUnique({ where: { tenantId: tenant.id } });
    tenant = await prisma.tenant.findUnique({ where: { id: tenant.id } });
  } else {
    phoneRecord = await prisma.phoneNumber.findUnique({
      where: { number: to },
      include: { tenant: true, assignedUser: true },
    });
    if (phoneRecord?.tenant) {
      tenant = phoneRecord.tenant;
      greeting = await prisma.greeting.findUnique({ where: { tenantId: tenant.id } });
      await setCachedTenant(to, tenant);
    }
  }

  if (tenant && !phoneRecord) {
    phoneRecord = await prisma.phoneNumber.findUnique({
      where: { number: to },
      include: { assignedUser: true },
    });
  }

  if (phoneRecord?.isActive === false) {
    return {
      tenant,
      greeting,
      phoneRecord,
      suspended: true,
      from,
      to,
    };
  }

  if (tenant && !isTenantOperational(tenant)) {
    return {
      tenant,
      greeting,
      phoneRecord,
      suspended: true,
      from,
      to,
    };
  }

  if (phoneRecord && greeting) {
    greeting = applyNumberRoutingToGreeting(greeting, phoneRecord);
  }

  return {
    tenant,
    greeting,
    phoneRecord,
    suspended: false,
    from,
    to,
  };
}

function hasConfiguredAppRingMembers(greeting, phoneRecord) {
  return hasAppRingMembers(greeting, phoneRecord);
}

async function resolveRingTargetsForSession(prisma, session) {
  return resolveRingTargets(
    prisma,
    session.tenantId,
    session.greeting,
    session.phoneRecord,
    session.credentialConnectionId,
  );
}

async function logInboundCall(prisma, session, status = 'completed') {
  if (!session?.callSessionId) return;
  await prisma.callLog.upsert({
    where: { callSid: session.callSessionId },
    create: {
      callSid: session.callSessionId,
      from: session.from,
      to: session.to,
      status,
      tenantId: session.tenantId,
      direction: 'inbound',
      callType: status === 'completed' ? 'answered' : 'missed',
      endedAt: new Date(),
    },
    update: {
      status,
      tenantId: session.tenantId,
      endedAt: new Date(),
    },
  });
}

async function startConnectFlow(session, prisma, { skipAnnouncements = false } = {}) {
  const { greeting, tenant, phoneRecord, callControlId, credentialConnectionId } = session;
  const preamble = [];

  if (
    !skipAnnouncements
    && greeting?.playCallRecordingNotice !== false
    && greeting?.callRecordingEnabled !== false
  ) {
    preamble.push(resolveRecordingNotice(greeting, tenant.name));
  }

  const resolved = session.preResolvedTargets
    ? {
      targets: session.preResolvedTargets,
      ringTimeout: session.ringTimeout,
      strategy: session.ringStrategy,
    }
    : await resolveRingTargetsForSession(prisma, session);

  let { targets, ringTimeout, strategy } = resolved;

  if (resolved.ringGroup) {
    session.ringGroup = resolved.ringGroup;
    session.ringGroupId = resolved.ringGroupId || resolved.ringGroup.id;
    if (session.greeting) {
      session.greeting = {
        ...session.greeting,
        callRecordingEnabled: resolved.ringGroup.callRecordingEnabled,
        voicemailEnabled: resolved.ringGroup.voicemailEnabled,
      };
    }
  } else if (resolved.ringGroupId) {
    session.ringGroupId = resolved.ringGroupId;
  }

  if (!targets.length && hasConfiguredAppRingMembers(greeting, phoneRecord)) {
    console.log('   ↳ No dial targets yet — provisioning mobile SIP credentials and retrying');
    const retry = await resolveRingTargetsForSession(prisma, session);
    targets = retry.targets;
    ringTimeout = retry.ringTimeout;
    strategy = retry.strategy;
    session.preResolvedTargets = null;
  }

  session.ringTargets = targets;
  session.ringIndex = 0;
  session.ringTimeout = ringTimeout;
  session.ringStrategy = strategy;
  session.credentialConnectionId = credentialConnectionId;
  session.stage = 'connect';
  await saveSession(callControlId, session);

  if (session.ringGroupId) {
    session.ringGroupOfferedAt = Date.now();
    await recordRingGroupOffered(prisma, session.ringGroupId, session.callSessionId);
    const memberIds = targets.map((t) => t.memberId).filter(Boolean);
    await markMembersRung(prisma, memberIds);
    const memberExtensionIds = [...new Set(targets.map((t) => t.extensionId).filter(Boolean))];
    if (memberExtensionIds.length === 1) {
      session.voicemailExtensionId = memberExtensionIds[0];
    }
    await saveSession(callControlId, session);
  }

  if (!targets.length) {
    if (hasConfiguredAppRingMembers(greeting, phoneRecord)) {
      await routeToVoicemailOrHangup(session, {
        reason: 'mobile app ring group configured but no agent SIP credentials are available',
      });
      return;
    }
    await routeToVoicemailOrHangup(session, { reason: 'no ring targets configured' });
    return;
  }

  if (preamble.length) {
    session.stage = 'preamble';
    session.pendingConnect = true;
    await saveSession(callControlId, session);
    await speakCall(callControlId, preamble.join(' '), encodeClientState({ stage: 'preamble' }));
    return;
  }

  await startRinging(session, prisma);
}

function isSimultaneousStrategy(session) {
  return String(session.ringStrategy || '').toLowerCase() === 'simultaneous';
}

const OUTBOUND_LEG_TERMINAL = new Set(['answered', 'failed', 'cancelled', 'no-answer']);

function getOutboundLegs(session) {
  if (Array.isArray(session.outboundLegs)) return session.outboundLegs;
  if (session.outboundLegCallControlId) {
    return [{
      callControlId: session.outboundLegCallControlId,
      targetIndex: session.ringIndex ?? 0,
      status: session.connectedLeg === session.outboundLegCallControlId ? 'answered' : 'ringing',
    }];
  }
  return [];
}

function findOutboundLeg(session, legCallControlId) {
  if (!legCallControlId) return null;
  return getOutboundLegs(session).find((leg) => leg.callControlId === legCallControlId) || null;
}

function upsertOutboundLeg(session, legEntry) {
  const legs = getOutboundLegs(session);
  const index = legs.findIndex((leg) => leg.targetIndex === legEntry.targetIndex);
  if (index >= 0) {
    legs[index] = { ...legs[index], ...legEntry };
  } else {
    legs.push(legEntry);
  }
  session.outboundLegs = legs;
  return legs;
}

function markOutboundLeg(session, legCallControlId, status) {
  const legs = getOutboundLegs(session).map((leg) => (
    leg.callControlId === legCallControlId ? { ...leg, status } : leg
  ));
  session.outboundLegs = legs;
  return legs;
}

function markOutboundLegByIndex(session, targetIndex, status) {
  const legs = getOutboundLegs(session);
  const index = legs.findIndex((leg) => leg.targetIndex === targetIndex);
  if (index >= 0) {
    legs[index] = { ...legs[index], status };
  } else {
    legs.push({ callControlId: null, targetIndex, status });
  }
  session.outboundLegs = legs;
  return legs;
}

function hasConnectedLeg(session) {
  return Boolean(session.connectedLeg);
}

function anyOutboundLegAnswered(session) {
  return hasConnectedLeg(session)
    || getOutboundLegs(session).some((leg) => leg.status === 'answered');
}

function allOutboundLegsSettled(session) {
  const legs = getOutboundLegs(session);
  if (!legs.length) return false;
  return legs.every((leg) => OUTBOUND_LEG_TERMINAL.has(leg.status));
}

function isOutboundLegEvent(session, legCallControlId) {
  if (!legCallControlId) return false;
  return getOutboundLegs(session).some((leg) => leg.callControlId === legCallControlId);
}

async function cancelRemainingOutboundLegs(session, winningLegId) {
  const protectedWinner = winningLegId || session.winnerLeg || session.connectedLeg;
  const legs = getOutboundLegs(session);
  for (const leg of legs) {
    if (
      leg.callControlId
      && leg.callControlId !== protectedWinner
      && leg.callControlId !== session.winnerLeg
      && leg.callControlId !== session.connectedLeg
      && leg.status === 'ringing'
    ) {
      try {
        await hangupCall(leg.callControlId);
      } catch (error) {
        console.warn(`   ↳ Could not cancel outbound leg ${leg.callControlId}: ${error.message}`);
      }
      leg.status = 'cancelled';
    }
  }
  session.outboundLegs = legs;
}

async function cancelAllRingingOutboundLegs(session) {
  const legs = getOutboundLegs(session);
  for (const leg of legs) {
    if (leg.callControlId && leg.status === 'ringing') {
      try {
        await hangupCall(leg.callControlId);
      } catch (error) {
        console.warn(`   ↳ Could not cancel outbound leg ${leg.callControlId}: ${error.message}`);
      }
      leg.status = 'cancelled';
    }
  }
  session.outboundLegs = legs;
}

async function cleanupInboundSession(prisma, inboundCallControlId, session, callStatus) {
  await logInboundCall(prisma, session, callStatus);
  await deleteSession(inboundCallControlId);
}

async function dialSingleTarget(session, target, targetIndex, ringTimeout) {
  const dialTo = formatTargetDialTo(target);
  if (!dialTo) {
    return { targetIndex, target, error: 'no_dial_destination' };
  }

  console.log(`   ↳ Call Control dial ${target.type}: ${dialTo}`);

  const dialResult = await dialDestination(session.callControlId, {
    to: dialTo,
    from: session.from || session.to,
    connectionId: session.callControlApplicationId,
    timeoutSecs: ringTimeout,
    clientState: encodeClientState({
      stage: 'ringing',
      targetType: target.type,
      targetIndex,
      simultaneous: isSimultaneousStrategy(session),
    }),
  });

  return {
    targetIndex,
    target,
    callControlId: dialResult?.call_control_id || null,
  };
}

async function dialAllTargetsSimultaneously(session) {
  const { callControlId, ringTargets, ringTimeout, callControlApplicationId } = session;

  if (!ringTargets?.length) {
    await routeToVoicemailOrHangup(session);
    return;
  }

  if (!callControlApplicationId) {
    await routeToVoicemailOrHangup(session, {
      reason: 'Call Control application ID is not configured for outbound dial',
    });
    return;
  }

  session.stage = 'ringing';
  session.outboundLegs = [];
  session.connectedLeg = null;
  session.outboundLegCallControlId = null;
  session.activeTarget = null;
  await saveSession(callControlId, session);

  console.log(`   ↳ Call Control simultaneous ring — ${ringTargets.length} target(s)`);

  // Reserve a leg slot per target before dialing so every target is tracked.
  for (let targetIndex = 0; targetIndex < ringTargets.length; targetIndex += 1) {
    upsertOutboundLeg(session, {
      callControlId: null,
      targetIndex,
      targetType: ringTargets[targetIndex].type,
      status: 'ringing',
    });
  }

  const results = await Promise.all(
    ringTargets.map((target, targetIndex) =>
      dialSingleTarget(session, target, targetIndex, ringTimeout)
        .catch((error) => {
          const telnyxDetail = error.telnyx?.errors?.[0]?.detail;
          return {
            targetIndex,
            target,
            error: telnyxDetail || error.message,
          };
        })),
  );

  for (const result of results) {
    await registerOutboundDialResult(callControlId, result);
  }

  const freshSession = await getSession(callControlId);
  if (!freshSession) return;

  const legs = getOutboundLegs(freshSession);
  if (legs[0]?.callControlId) {
    freshSession.outboundLegCallControlId = legs[0].callControlId;
  }
  await saveSession(callControlId, freshSession);

  const ringingCount = legs.filter((leg) => leg.status === 'ringing' && leg.callControlId).length;
  if (ringingCount === 0 && !await getClaimedWinner(callControlId)) {
    await routeToVoicemailOrHangup(freshSession);
  }
}

/** RC-3: If a winner was chosen while dials were in flight, hang up late legs immediately. */
async function registerOutboundDialResult(inboundCallControlId, result) {
  let session = await getSession(inboundCallControlId);
  if (!session) return;

  const winner = await getClaimedWinner(inboundCallControlId);
  const callAlreadyConnected = Boolean(
    winner
    || session.connectedLeg
    || session.stage === 'bridged',
  );

  if (callAlreadyConnected) {
    if (result.callControlId) {
      if (result.callControlId === winner || result.callControlId === session.winnerLeg || result.callControlId === session.connectedLeg) {
        markOutboundLegByIndex(session, result.targetIndex, 'answered');
        session.winnerLeg = result.callControlId;
        session.connectedLeg = result.callControlId;
        session.outboundLegCallControlId = result.callControlId;
        session.activeBridge = true;
        session.connectedAt = session.connectedAt || new Date().toISOString();
        session.stage = 'bridged';
        await saveSession(inboundCallControlId, session);
        return;
      }
      console.log(
        `   ↳ Late dial for target ${result.targetIndex} — hanging up ${result.callControlId}`,
      );
      try {
        await hangupCall(result.callControlId);
      } catch (error) {
        console.warn(`   ↳ Late dial hangup failed: ${error.message}`);
      }
      markOutboundLegByIndex(session, result.targetIndex, 'cancelled');
    } else {
      markOutboundLegByIndex(session, result.targetIndex, 'failed');
    }
    await saveSession(inboundCallControlId, session);
    return;
  }

  if (result.callControlId) {
    upsertOutboundLeg(session, {
      callControlId: result.callControlId,
      targetIndex: result.targetIndex,
      targetType: result.target?.type,
      status: 'ringing',
    });
    await indexOutboundLeg(inboundCallControlId, result.callControlId);
    console.log(`   ↳ Outbound leg created: ${result.callControlId} (target ${result.targetIndex})`);
  } else {
    markOutboundLegByIndex(session, result.targetIndex, 'failed');
    console.warn(
      `   ↳ Dial failed for target ${result.targetIndex}: ${result.error || 'unknown'}`,
    );
  }
  await saveSession(inboundCallControlId, session);
}

async function startRinging(session, prisma) {
  if (isSimultaneousStrategy(session)) {
    await dialAllTargetsSimultaneously(session);
    return;
  }
  await dialNextTarget(session, prisma);
}

async function handleSimultaneousLegEnded(session, inboundCallControlId, legCallControlId, prisma) {
  const winner = await getClaimedWinner(inboundCallControlId);
  if (winner || hasConnectedLeg(session) || session.stage === 'bridged') {
    return true;
  }

  const leg = findOutboundLeg(session, legCallControlId);
  if (!leg) return true;
  if (leg.status === 'cancelled' || leg.status === 'answered' || leg.status === 'failed') {
    return true;
  }

  markOutboundLeg(session, legCallControlId, 'no-answer');
  await saveSession(inboundCallControlId, session);

  if (anyOutboundLegAnswered(session)) return true;
  if (!allOutboundLegsSettled(session)) return true;

  await routeToVoicemailOrHangup(session, { fallbackTrigger: 'no_answer' });
  return true;
}

async function applyAnswerSideEffectsOnce(prisma, session, inboundCallControlId, legCallControlId) {
  const fx = await claimAnswerSideEffects(inboundCallControlId, legCallControlId);
  if (!fx.claimed) {
    console.log(`   ↳ Answer side effects already applied for ${legCallControlId}`);
    return;
  }

  if (session.ringGroup?.callRecordingEnabled === false) {
    return;
  }
  if (session.greeting?.callRecordingEnabled === false) {
    return;
  }

  try {
    const clientState = buildRecordingClientState({
      tenantId: session.tenantId,
      from: session.from,
      to: session.to,
      direction: 'inbound',
    });
    await startCallRecording(inboundCallControlId, clientState);
  } catch (error) {
    console.warn('   ↳ Inbound recording start failed:', error.message);
  }

  await logInboundCall(prisma, session, 'completed');
}

async function onOutboundLegAnswered(
  prisma,
  session,
  inboundCallControlId,
  legCallControlId,
  { eventType } = {},
) {
  if (!legCallControlId || !inboundCallControlId) return;

  const freshSession = await getSession(inboundCallControlId);
  if (freshSession) session = freshSession;
  logCallControlDiagnostics(eventType || 'answer', { call_control_id: legCallControlId }, session, inboundCallControlId);

  if (hasBridgedState(session) && (session.connectedLeg === legCallControlId || session.winnerLeg === legCallControlId)) {
    await applyAnswerSideEffectsOnce(prisma, session, inboundCallControlId, legCallControlId);
    return;
  }

  if (isSimultaneousStrategy(session)) {
    const leg = findOutboundLeg(session, legCallControlId);
    if (!leg || leg.status === 'cancelled' || leg.status === 'failed') {
      console.log(`   ↳ Ignoring answer on leg ${legCallControlId} (status=${leg?.status || 'unknown'})`);
      return;
    }
  }

  const claim = await claimConnectedLeg(inboundCallControlId, legCallControlId);

  if (!claim.claimed) {
    if (claim.isDuplicateWinnerEvent) {
      console.log(
        `   ↳ Duplicate ${eventType || 'answer'} for winner ${legCallControlId}`,
      );
      await applyAnswerSideEffectsOnce(prisma, session, inboundCallControlId, legCallControlId);
      return;
    }
    if (claim.lostRace) {
      console.log(
        `   ↳ Ignoring answer on leg ${legCallControlId} — winner is ${claim.legCallControlId}`,
      );
      try {
        await hangupCall(legCallControlId);
      } catch (error) {
        console.warn(`   ↳ Loser leg hangup failed: ${error.message}`);
      }
      markOutboundLeg(session, legCallControlId, 'cancelled');
      await saveSession(inboundCallControlId, session);
    }
    return;
  }

  session.stage = 'bridged';
  session.activeBridge = true;
  session.connectedAt = session.connectedAt || new Date().toISOString();
  session.winnerLeg = legCallControlId;
  session.connectedLeg = legCallControlId;
  session.outboundLegCallControlId = legCallControlId;
  await saveSession(inboundCallControlId, session);

  if (isSimultaneousStrategy(session)) {
    const leg = findOutboundLeg(session, legCallControlId);
    session.activeTarget = session.ringTargets?.[leg?.targetIndex] || null;
    markOutboundLeg(session, legCallControlId, 'answered');
    console.log(`   ↳ Simultaneous ring winner: ${legCallControlId} (target ${leg?.targetIndex})`);
    await saveSession(inboundCallControlId, session);
    await cancelRemainingOutboundLegs(session, legCallControlId);
  }

  await saveSession(inboundCallControlId, session);
  await applyAnswerSideEffectsOnce(prisma, session, inboundCallControlId, legCallControlId);

  const memberId = session.activeTarget?.memberId || session.ringTargets?.[session.ringIndex]?.memberId;
  if (session.ringGroupId) {
    await recordRingGroupAnswered(prisma, session, memberId);
  }
}

async function dialNextTarget(session, prisma) {
  const { callControlId, ringTargets, ringIndex, ringTimeout, callControlApplicationId, to } = session;
  const target = ringTargets[ringIndex];
  if (!target) {
    await speakCall(
      callControlId,
      resolveNoAnswerMessage(session.greeting, session.tenant.name),
      encodeClientState({ stage: 'hangup' }),
    );
    return;
  }

  session.stage = 'ringing';
  session.activeTarget = target;
  await saveSession(callControlId, session);

  const dialTo = formatTargetDialTo(target);

  if (!dialTo) {
    session.ringIndex += 1;
    if (session.ringIndex < (session.ringTargets?.length || 0)) {
      await saveSession(callControlId, session);
      await dialNextTarget(session, prisma);
      return;
    }
    await routeToVoicemailOrHangup(session);
    return;
  }

  if (!callControlApplicationId) {
    await routeToVoicemailOrHangup(session, {
      reason: 'Call Control application ID is not configured for outbound dial',
    });
    return;
  }

  console.log(`   ↳ Call Control dial ${target.type}: ${dialTo}`);

  try {
    const dialResult = await dialDestination(callControlId, {
      to: dialTo,
      from: to,
      connectionId: callControlApplicationId,
      timeoutSecs: ringTimeout,
      clientState: encodeClientState({ stage: 'ringing', targetType: target.type }),
    });
    const outboundLegId = dialResult?.call_control_id;
    if (outboundLegId) {
      session.outboundLegCallControlId = outboundLegId;
      await saveSession(callControlId, session);
      console.log(`   ↳ Outbound app leg created: ${outboundLegId}`);
    }
  } catch (error) {
    const telnyxDetail = error.telnyx?.errors?.[0]?.detail;
    console.error(
      `   ↳ Call Control dial failed (${error.status || 'error'}): ${telnyxDetail || error.message}`,
    );
    session.ringIndex += 1;
    if (session.ringIndex < (session.ringTargets?.length || 0)) {
      await saveSession(callControlId, session);
      await dialNextTarget(session, prisma);
      return;
    }
    await routeToVoicemailOrHangup(session);
  }
}

async function handleIvrSelection(session, digit, prisma) {
  const options = normalizeIvrOptions(session.greeting?.ivrOptions);
  const selected = options.find((option) => option.digit === String(digit));
  if (!selected) {
    await speakCall(session.callControlId, 'Invalid selection. Goodbye.', encodeClientState({ stage: 'hangup' }));
    return;
  }

  if (selected.action === 'forward' && selected.forwardTo) {
    session.greeting = {
      ...session.greeting,
      forwardEnabled: true,
      forwardNumber: selected.forwardTo,
      ringGroupEnabled: false,
    };
    session.ringTargets = [{
      type: 'phone',
      phone: normalizePhoneNumber(selected.forwardTo),
      label: selected.label,
    }];
    session.ringIndex = 0;
    session.stage = 'connect';
    await saveSession(session.callControlId, session);
    await dialNextTarget(session, prisma);
    return;
  }

  if (selected.action === 'ring_group' && session.greeting?.ringGroupEnabled) {
    await startConnectFlow(session, prisma);
    return;
  }

  const message = resolveGreetingMessage(
    selected.message || `You selected ${selected.label}.`,
    session.tenant.name,
  );
  await speakCall(session.callControlId, message, encodeClientState({ stage: 'hangup' }));
}

async function handleCallInitiated(prisma, payload, platform) {
  const callControlId = payload.call_control_id;
  const {
    parseInternalExtensionDestination,
    handleInternalExtensionCallInitiated,
    handleInternalApiCallerInitiated,
  } = require('./internalExtensionDial');

  if (await handleInternalApiCallerInitiated(prisma, payload, platform)) {
    return;
  }

  const internalExtension = parseInternalExtensionDestination(payload.to);
  if (internalExtension) {
    const handled = await handleInternalExtensionCallInitiated(
      prisma,
      payload,
      platform,
      internalExtension,
    );
    if (handled) return;
  }

  const context = await resolveInboundContext(prisma, payload);
  if (!context?.tenant) {
    console.log('   ↳ Call Control: unknown tenant');
    await answerCall(callControlId);
    await speakCall(callControlId, 'Welcome. This number is not configured.', encodeClientState({ stage: 'hangup' }));
    return;
  }

  if (context.suspended) {
    await answerCall(callControlId);
    await speakCall(
      callControlId,
      'This phone number is temporarily suspended. Please try again later.',
      encodeClientState({ stage: 'hangup' }),
    );
    return;
  }

  const credentialConnectionId = getCredentialConnectionId(platform);
  const callControlApplicationId = getCallControlApplicationId(platform);
  const { tenant, greeting, from, to } = context;

  const { targets, ringTimeout, strategy } = await resolveRingTargets(
    prisma,
    tenant.id,
    greeting || {},
    context.phoneRecord,
    credentialConnectionId,
  );
  const routedExtension = await resolveExtensionForPhoneRecord(
    prisma,
    tenant.id,
    context.phoneRecord,
  );
  const configuredAppRing = hasConfiguredAppRingMembers(greeting || {}, context.phoneRecord);
  const ringsMobileApp = hasAppRingTargets(targets) || configuredAppRing;

  const session = {
    callControlId,
    callSessionId: payload.call_session_id || callControlId,
    tenantId: tenant.id,
    tenant,
    greeting: greeting || {},
    phoneRecord: context.phoneRecord,
    from,
    to,
    credentialConnectionId,
    callControlApplicationId,
    preResolvedTargets: targets,
    ringTimeout,
    ringStrategy: strategy,
    voicemailExtensionId: routedExtension?.id || null,
    stage: 'init',
  };
  await saveSession(callControlId, session);

  await answerCall(callControlId, encodeClientState({ tenantId: tenant.id, direction: 'inbound' }));
  await logInboundCallStart(prisma, session);

  if (greeting?.businessHoursEnabled) {
    const open = isWithinBusinessHours(greeting.businessHours, tenant.timezone || 'America/New_York');
    if (!open) {
      session.stage = 'closed';
      await saveSession(callControlId, session);
      if (greeting?.afterHoursVoicemailEnabled && greeting?.voicemailEnabled !== false) {
        await speakCall(
          callControlId,
          resolveClosedMessage(greeting, tenant.name),
          encodeClientState({ stage: 'after_hours_closed' }),
        );
      } else {
        await speakCall(
          callControlId,
          resolveClosedMessage(greeting, tenant.name),
          encodeClientState({ stage: 'hangup' }),
        );
      }
      return;
    }
  }

  const ivrOptions = normalizeIvrOptions(greeting?.ivrOptions);
  if (greeting?.ivrEnabled && ivrOptions.length && !ringsMobileApp) {
    const prompt = resolveGreetingMessage(
      greeting.ivrPrompt || 'Welcome to {company}.',
      tenant.name,
    );
    session.stage = 'ivr';
    await saveSession(callControlId, session);
    await gatherUsingSpeak(callControlId, {
      prompt,
      maximumDigits: 1,
      clientState: encodeClientState({ stage: 'ivr' }),
    });
    return;
  }

  const extPolicy = await resolveExtensionInboundPolicy(
    prisma,
    tenant,
    context.phoneRecord,
    from,
    { credentialConnectionId },
  );

  if (extPolicy?.action === 'block') {
    await speakCall(
      callControlId,
      'Your call cannot be completed at this time. Goodbye.',
      encodeClientState({ stage: 'hangup' }),
    );
    return;
  }

  if (extPolicy?.action === 'voicemail') {
    session.voicemailExtensionId = extPolicy.extension?.id || session.voicemailExtensionId;
    await saveSession(callControlId, session);
    await routeToVoicemailOrHangup(session, { reason: extPolicy.reason || 'Do not disturb' });
    return;
  }

  if (extPolicy?.action === 'forward') {
    session.preResolvedTargets = extPolicy.targets;
    session.ringTimeout = extPolicy.ringTimeout || 25;
    session.ringStrategy = extPolicy.strategy || 'simultaneous';
    session.extensionId = extPolicy.extension?.id || null;
    await saveSession(callControlId, session);
    if (!callControlApplicationId) {
      await routeToVoicemailOrHangup(session, {
        reason: 'Call Control application ID is not configured for forwarding',
      });
      return;
    }
    await startConnectFlow(session, prisma, { skipAnnouncements: true });
    return;
  }

  if (extPolicy?.action === 'screen') {
    session.stage = 'screening';
    session.callerDisplayName = extPolicy.callerDisplayName || from;
    session.extensionId = extPolicy.extension?.id || null;
    await saveSession(callControlId, session);
    await gatherUsingSpeak(callControlId, {
      prompt: `Call from ${session.callerDisplayName}. Press 1 to accept, or 2 to reject.`,
      maximumDigits: 1,
      clientState: encodeClientState({ stage: 'screening' }),
    });
    return;
  }

  if (ringsMobileApp) {
    if (!callControlApplicationId) {
      console.error('   ↳ Call Control app ID missing — cannot ring mobile app');
      await routeToVoicemailOrHangup(session, {
        reason: 'TELNYX_CALL_CONTROL_APP_ID is not configured',
      });
      return;
    }
    if (configuredAppRing && !hasAppRingTargets(targets)) {
      console.log('   ↳ App ring configured — provisioning SIP credentials for mobile agents');
      const retry = await resolveRingTargets(
        prisma,
        tenant.id,
        greeting || {},
        context.phoneRecord,
        credentialConnectionId,
      );
      session.preResolvedTargets = retry.targets;
      session.ringTimeout = retry.ringTimeout;
      session.ringStrategy = retry.strategy;
    } else {
      console.log('   ↳ Direct mobile app ring — skipping greeting before connect');
    }
    await startConnectFlow(session, prisma, { skipAnnouncements: true });
    return;
  }

  if (greeting?.playGreetingBeforeConnect !== false) {
    session.stage = 'greeting';
    await saveSession(callControlId, session);
    await speakCall(
      callControlId,
      resolveOpenHoursMessage(greeting, tenant.name),
      encodeClientState({ stage: 'greeting' }),
    );
    return;
  }

  await startConnectFlow(session, prisma);
}

async function handleSpeakEnded(prisma, payload) {
  const callControlId = payload.call_control_id;
  const session = await getSession(callControlId);
  if (!session) return;

  const clientState = decodeClientState(payload.client_state);
  if (clientState?.stage === 'hangup') {
    await hangupCall(callControlId);
    return;
  }

  if (clientState?.stage === 'voicemail_record') {
    session.stage = 'voicemail_record';
    await saveSession(callControlId, session);
    const maxLength = clampVoicemailMaxLength(session.greeting?.voicemailMaxLength);
    const vmState = buildVoicemailClientStateFromSession(session);
    await startVoicemailRecording(callControlId, { maxLength, clientState: vmState });
    return;
  }

  if (clientState?.stage === 'after_hours_closed') {
    if (session.greeting?.afterHoursVoicemailEnabled && session.greeting?.voicemailEnabled !== false) {
      await startVoicemailCapture(session);
    } else {
      await hangupCall(callControlId);
    }
    return;
  }

  if (session.stage === 'greeting' || session.stage === 'preamble') {
    await startConnectFlow(session, prisma);
    return;
  }

  if (session.stage === 'hangup_pending') {
    await hangupCall(callControlId);
  }
}

async function handleGatherEnded(prisma, payload) {
  const callControlId = payload.call_control_id;
  const session = await getSession(callControlId);
  if (!session) return;

  if (session.stage === 'screening') {
    const digit = String(payload.digits || '').trim()[0];
    if (digit === '1') {
      session.stage = 'init';
      await saveSession(callControlId, session);
      await startConnectFlow(session, prisma, { skipAnnouncements: true });
      return;
    }
    await speakCall(
      callControlId,
      'Call rejected. Goodbye.',
      encodeClientState({ stage: 'hangup' }),
    );
    return;
  }

  if (session.stage !== 'ivr') return;

  const digits = String(payload.digits || '').trim();
  if (!digits) {
    await speakCall(callControlId, 'We did not receive a selection. Goodbye.', encodeClientState({ stage: 'hangup' }));
    return;
  }

  await handleIvrSelection(session, digits[0], prisma);
}

async function handleDialEnded(prisma, payload) {
  const { session, inboundCallControlId } = await findSession(payload);
  if (!session || !inboundCallControlId) return;

  const dialStatus = String(payload.dial_call_status || payload.status || '').toLowerCase();
  const legCallControlId = payload.call_control_id;
  logCallControlDiagnostics('call.dial.ended', payload, session, inboundCallControlId, { dialStatus });

  if (dialStatus === 'answered' || dialStatus === 'bridged') {
    return;
  }

  if (await hasActiveWinner(session, inboundCallControlId)) {
    console.log('[CALL CONTROL] Ignoring dial.ended for already-bridged session', {
      sessionId: inboundCallControlId,
      stage: session.stage,
      winnerLeg: session.winnerLeg || session.connectedLeg || await getClaimedWinner(inboundCallControlId),
      eventType: 'call.dial.ended',
      timestamp: new Date().toISOString(),
    });
    recordRaceConditionPrevented({
      source: 'handleDialEnded',
      eventType: 'call.dial.ended',
      sessionId: inboundCallControlId,
      stage: session.stage,
      winnerLeg: session.winnerLeg || session.connectedLeg || await getClaimedWinner(inboundCallControlId),
    });
    return;
  }

  if (isSimultaneousStrategy(session)) {
    const winner = await getClaimedWinner(inboundCallControlId);
    if (session.stage !== 'ringing' || winner || hasConnectedLeg(session)) return;
    if (!isOutboundLegEvent(session, legCallControlId)) return;
    await handleSimultaneousLegEnded(session, inboundCallControlId, legCallControlId, prisma);
    return;
  }

  if (session.stage !== 'ringing') return;

  session.ringIndex += 1;
  if (session.ringIndex < (session.ringTargets?.length || 0)) {
    await saveSession(inboundCallControlId, session);
    await dialNextTarget(session, prisma);
    return;
  }

  await routeToVoicemailOrHangup(session, { fallbackTrigger: 'no_answer' });
}

async function handleDialAnswered(prisma, payload) {
  const { session, inboundCallControlId } = await findSession(payload);
  if (!session || !inboundCallControlId) return;
  logCallControlDiagnostics('call.dial.answered', payload, session, inboundCallControlId);

  await onOutboundLegAnswered(
    prisma,
    session,
    inboundCallControlId,
    payload.call_control_id,
    { eventType: 'call.dial.answered' },
  );
}

async function handleCallAnswered(prisma, payload) {
  const { session, inboundCallControlId } = await findSession(payload);
  if (!session || !inboundCallControlId) return false;

  const legCallControlId = payload.call_control_id;
  const isInboundLeg = legCallControlId === inboundCallControlId;
  const isOutboundLeg = isOutboundLegEvent(session, legCallControlId);

  logCallControlDiagnostics('call.answered', payload, session, inboundCallControlId, {
    isInboundLeg,
    isOutboundLeg,
  });

  if (!isOutboundLeg || isInboundLeg) return false;

  await onOutboundLegAnswered(
    prisma,
    session,
    inboundCallControlId,
    legCallControlId,
    { eventType: 'call.answered' },
  );
  return true;
}

async function handleCallBridged(prisma, payload) {
  const { session, inboundCallControlId } = await findSession(payload);
  if (!session || !inboundCallControlId) return;
  logCallControlDiagnostics('call.bridged', payload, session, inboundCallControlId);

  await onOutboundLegAnswered(
    prisma,
    session,
    inboundCallControlId,
    payload.call_control_id,
    { eventType: 'call.bridged' },
  );
}

async function handleHangup(prisma, payload) {
  const { session, inboundCallControlId } = await findSession(payload);
  if (session && inboundCallControlId) {
    const legCallControlId = payload.call_control_id;
    const isInboundLeg = legCallControlId === inboundCallControlId;
    const isOutboundLeg = isOutboundLegEvent(session, legCallControlId);
    logCallControlDiagnostics('call.hangup', payload, session, inboundCallControlId, {
      isInboundLeg,
      isOutboundLeg,
    });
    const activeWinner = await hasActiveWinner(session, inboundCallControlId);

    if (isInboundLeg && session.stage === 'ringing' && isSimultaneousStrategy(session) && !activeWinner) {
      await cancelAllRingingOutboundLegs(session);
      await cleanupInboundSession(prisma, inboundCallControlId, session, 'no-answer');
      return;
    }

    if (session.stage === 'ringing' && isOutboundLeg) {
      if (activeWinner) {
        console.log('[CALL CONTROL] Ignoring hangup fallback for bridged session', {
          sessionId: inboundCallControlId,
          stage: session.stage,
          winnerLeg: session.winnerLeg || session.connectedLeg || await getClaimedWinner(inboundCallControlId),
          eventType: 'call.hangup',
          timestamp: new Date().toISOString(),
        });
        recordRaceConditionPrevented({
          source: 'handleHangup',
          eventType: 'call.hangup',
          sessionId: inboundCallControlId,
          stage: session.stage,
          winnerLeg: session.winnerLeg || session.connectedLeg || await getClaimedWinner(inboundCallControlId),
        });
        if (legCallControlId !== session.winnerLeg && legCallControlId !== session.connectedLeg) {
          markOutboundLeg(session, legCallControlId, 'cancelled');
          await saveSession(inboundCallControlId, session);
        }
        return;
      }
      if (isSimultaneousStrategy(session)) {
        await handleSimultaneousLegEnded(session, inboundCallControlId, legCallControlId, prisma);
        return;
      }

      session.ringIndex += 1;
      if (session.ringIndex < (session.ringTargets?.length || 0)) {
        await saveSession(inboundCallControlId, session);
        await dialNextTarget(session, prisma);
        return;
      }
      await routeToVoicemailOrHangup(session, { fallbackTrigger: 'no_answer' });
      return;
    }

    if (isOutboundLeg && hasConnectedLeg(session) && legCallControlId !== session.connectedLeg) {
      markOutboundLeg(session, legCallControlId, 'cancelled');
      await saveSession(inboundCallControlId, session);
      return;
    }

    await cleanupInboundSession(
      prisma,
      inboundCallControlId,
      session,
      session.stage === 'bridged' ? 'completed' : 'no-answer',
    );
  }

  try {
    await recordCallQualityFromTelnyxEvent(prisma, {
      data: { event_type: 'call.hangup', payload },
    });
  } catch (error) {
    console.warn('   ↳ Call quality telemetry save failed:', error.message);
  }
}

async function handleInboundCallControlEvent(prisma, body) {
  pruneStaleSessions();
  const eventType = body?.data?.event_type;
  const payload = body?.data?.payload;
  if (!payload?.call_control_id) return null;

  const platform = await loadPlatformSettings(prisma);

  console.log('📲 Call Control event:', eventType, payload.from, '→', payload.to);

  switch (eventType) {
    case 'call.initiated':
      if (String(payload.direction || '').toLowerCase() === 'incoming') {
        await handleCallInitiated(prisma, payload, platform);
      } else {
        const { handleInternalApiCallerInitiated } = require('./internalExtensionDial');
        await handleInternalApiCallerInitiated(prisma, payload, platform);
      }
      break;
    case 'call.answered':
      {
        const handledInboundWinner = await handleCallAnswered(prisma, payload);
        if (handledInboundWinner) break;
        const { handleInternalApiCallerAnswered } = require('./internalExtensionDial');
        await handleInternalApiCallerAnswered(prisma, payload);
      }
      break;
    case 'call.speak.ended':
      await handleSpeakEnded(prisma, payload);
      break;
    case 'call.gather.ended':
      await handleGatherEnded(prisma, payload);
      break;
    case 'call.dial.ended':
      await handleDialEnded(prisma, payload);
      break;
    case 'call.dial.answered':
      await handleDialAnswered(prisma, payload);
      break;
    case 'call.bridged':
      await handleCallBridged(prisma, payload);
      break;
    case 'call.hangup':
      await handleHangup(prisma, payload);
      break;
    default:
      break;
  }

  return { eventType, callControlId: payload.call_control_id };
}

module.exports = {
  handleInboundCallControlEvent,
  startConnectFlow,
  routeToVoicemailOrHangup,
  hasConfiguredAppRingMembers,
  isUserOnline,
  ONLINE_WINDOW_MS,
  isSimultaneousStrategy,
  getOutboundLegs,
  markOutboundLeg,
  markOutboundLegByIndex,
  anyOutboundLegAnswered,
  allOutboundLegsSettled,
  hasConnectedLeg,
  findOutboundLeg,
  isOutboundLegEvent,
  registerOutboundDialResult,
};
