const crypto = require('crypto');
const { getRedisClient } = require('./redis');
const { normalizePhoneNumber } = require('./phone');
const {
  getSession,
  saveSession,
  deleteSession,
  clearPendingAgentRing,
  resolveActiveAgentCall,
  clearActiveAgentCall,
} = require('./callControlSessionStore');
const { formatWebRtcDialTo } = require('./telnyxCallControl');
const { formatTargetDialTo, resolveExtensionRingTargets } = require('./inboundRouting');
const { loadCredentialConnectionId } = require('./softphone');

const TRANSFER_SESSION_TTL_SEC = 3600;

const TRANSFER_STAGES = Object.freeze({
  IDLE: 'idle',
  TRANSFERRING: 'transferring',
  COMPLETED: 'completed',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
});

const TERMINAL_TRANSFER_STAGES = new Set([
  TRANSFER_STAGES.COMPLETED,
  TRANSFER_STAGES.FAILED,
  TRANSFER_STAGES.CANCELLED,
]);

const ALLOWED_STAGE_TRANSITIONS = Object.freeze({
  [TRANSFER_STAGES.IDLE]: new Set([TRANSFER_STAGES.TRANSFERRING, TRANSFER_STAGES.CANCELLED]),
  [TRANSFER_STAGES.TRANSFERRING]: new Set([
    TRANSFER_STAGES.COMPLETED,
    TRANSFER_STAGES.FAILED,
    TRANSFER_STAGES.CANCELLED,
  ]),
  [TRANSFER_STAGES.COMPLETED]: new Set(),
  [TRANSFER_STAGES.FAILED]: new Set(),
  [TRANSFER_STAGES.CANCELLED]: new Set(),
});

const memoryTransferSessions = new Map();
const memoryInboundTransferIndex = new Map();

function buildTransferKey(transferId) {
  return String(transferId || '').trim();
}

function transferRedisKey(transferId) {
  return `cts:${buildTransferKey(transferId)}`;
}

function inboundTransferRedisKey(inboundCallControlId) {
  return `cts:inbound:${String(inboundCallControlId || '').trim()}`;
}

function isTerminalTransferStage(stage) {
  return TERMINAL_TRANSFER_STAGES.has(stage);
}

function canTransitionTransferStage(fromStage, toStage) {
  const allowed = ALLOWED_STAGE_TRANSITIONS[fromStage];
  return Boolean(allowed && allowed.has(toStage));
}

function encodeTransferClientState({ transferId, stage = 'blind' }) {
  return Buffer.from(JSON.stringify({
    v: 1,
    kind: 'transfer',
    transferId: String(transferId),
    stage: String(stage),
  })).toString('base64');
}

function decodeTransferClientState(clientState) {
  if (!clientState) return null;
  try {
    const parsed = JSON.parse(Buffer.from(String(clientState), 'base64').toString('utf8'));
    if (parsed?.kind !== 'transfer' || !parsed?.transferId) return null;
    return parsed;
  } catch {
    return null;
  }
}

function inferDestinationType(destination) {
  const raw = String(destination || '').trim();
  if (!raw) return null;
  if (/^sip:/i.test(raw)) return 'sip';
  const digits = raw.replace(/\D/g, '');
  if (digits && digits.length <= 6 && digits.length >= 2 && /^\d+$/.test(digits)) {
    return 'extension';
  }
  return 'pstn';
}

const { normalizeExtensionNumber } = require('./extensionNumber');

async function resolveTransferDestination(prisma, tenantId, destination, destinationType, platform) {
  const raw = String(destination || '').trim();
  if (!raw) {
    throw Object.assign(new Error('destination is required'), { status: 400 });
  }

  const type = destinationType || inferDestinationType(raw);
  if (!type) {
    throw Object.assign(new Error('destinationType is required'), { status: 400 });
  }

  if (type === 'pstn') {
    const to = normalizePhoneNumber(raw);
    if (!to) {
      throw Object.assign(new Error('Invalid PSTN destination'), { status: 400 });
    }
    return { type: 'pstn', value: to, to };
  }

  if (type === 'sip') {
    const to = raw.startsWith('sip:') ? raw : `sip:${raw}`;
    return { type: 'sip', value: to, to };
  }

  if (type === 'extension') {
    const extensionNumber = normalizeExtensionNumber(raw);
    const targetExtension = await prisma.extension.findFirst({
      where: { tenantId, extensionNumber, status: 'ACTIVE' },
      include: { user: true, forwarding: true, security: true },
    });
    if (!targetExtension) {
      throw Object.assign(new Error(`Extension ${extensionNumber} not found`), { status: 404 });
    }

    const credentialConnectionId = loadCredentialConnectionId(platform);
    const resolution = await resolveExtensionRingTargets(
      prisma,
      targetExtension,
      credentialConnectionId,
    );
    const targets = resolution?.targets || [];
    const dialTarget = targets.find((target) => formatTargetDialTo(target))
      || targets.find((target) => target.type === 'phone' && target.phone);

    let to = dialTarget ? formatTargetDialTo(dialTarget) : null;
    if (!to && dialTarget?.phone) {
      to = normalizePhoneNumber(dialTarget.phone);
    }
    if (!to) {
      throw Object.assign(
        new Error(`Extension ${extensionNumber} is not reachable for transfer`),
        { status: 400 },
      );
    }

    return { type: 'extension', value: extensionNumber, to };
  }

  throw Object.assign(new Error(`Unsupported destinationType: ${type}`), { status: 400 });
}

function createTransferSession({
  tenantId,
  agentUserId,
  callerLegId,
  agentLegId,
  inboundSessionId = null,
  callSessionId = null,
  target,
  webrtcCallId = null,
  mode = 'blind',
} = {}) {
  if (!tenantId) {
    throw Object.assign(new Error('tenantId is required'), { status: 400 });
  }
  if (!agentUserId) {
    throw Object.assign(new Error('agentUserId is required'), { status: 400 });
  }
  if (!callerLegId) {
    throw Object.assign(new Error('callerLegId is required'), { status: 400 });
  }
  if (!agentLegId) {
    throw Object.assign(new Error('agentLegId is required'), { status: 400 });
  }
  if (!target?.type || !target?.value) {
    throw Object.assign(new Error('target.type and target.value are required'), { status: 400 });
  }

  const now = Date.now();
  return {
    transferId: crypto.randomUUID(),
    tenantId: String(tenantId),
    agentUserId: String(agentUserId),
    mode: mode === 'blind' ? 'blind' : String(mode),
    stage: TRANSFER_STAGES.IDLE,
    callerLegId: String(callerLegId),
    agentLegId: String(agentLegId),
    inboundSessionId: inboundSessionId ? String(inboundSessionId) : null,
    callSessionId: callSessionId ? String(callSessionId) : null,
    target: {
      type: String(target.type),
      value: String(target.value),
      dialTo: target.dialTo ? String(target.dialTo) : null,
    },
    webrtcCallId: webrtcCallId ? String(webrtcCallId) : null,
    transferDestinationLegId: null,
    targetAnswered: false,
    callerBridgedToTarget: false,
    agentLegReleased: false,
    agentSipUsername: target.agentSipUsername ? String(target.agentSipUsername) : null,
    failureReason: null,
    createdAt: now,
    updatedAt: now,
  };
}

async function indexInboundTransfer(inboundCallControlId, transferId) {
  const inboundId = String(inboundCallControlId || '').trim();
  const id = buildTransferKey(transferId);
  if (!inboundId || !id) return;

  const redis = await getRedisClient().catch(() => null);
  if (redis) {
    await redis.set(inboundTransferRedisKey(inboundId), id, 'EX', TRANSFER_SESSION_TTL_SEC);
    return;
  }
  memoryInboundTransferIndex.set(inboundId, id);
}

async function resolveInboundTransferId(inboundCallControlId) {
  const inboundId = String(inboundCallControlId || '').trim();
  if (!inboundId) return null;

  const redis = await getRedisClient().catch(() => null);
  if (redis) {
    return redis.get(inboundTransferRedisKey(inboundId));
  }
  return memoryInboundTransferIndex.get(inboundId) || null;
}

async function clearInboundTransferIndex(inboundCallControlId) {
  const inboundId = String(inboundCallControlId || '').trim();
  if (!inboundId) return;

  const redis = await getRedisClient().catch(() => null);
  if (redis) {
    await redis.del(inboundTransferRedisKey(inboundId));
    return;
  }
  memoryInboundTransferIndex.delete(inboundId);
}

async function getTransferSession(transferId) {
  const id = buildTransferKey(transferId);
  if (!id) return null;

  const redis = await getRedisClient().catch(() => null);
  if (redis) {
    const raw = await redis.get(transferRedisKey(id));
    return raw ? JSON.parse(raw) : null;
  }
  return memoryTransferSessions.get(id) || null;
}

async function saveTransferSession(transferSession) {
  const id = buildTransferKey(transferSession?.transferId);
  if (!id) {
    throw Object.assign(new Error('transferId is required'), { status: 400 });
  }

  const payload = { ...transferSession, updatedAt: Date.now() };
  const redis = await getRedisClient().catch(() => null);
  if (redis) {
    await redis.set(
      transferRedisKey(id),
      JSON.stringify(payload),
      'EX',
      TRANSFER_SESSION_TTL_SEC,
    );
    return payload;
  }
  memoryTransferSessions.set(id, payload);
  return payload;
}

async function deleteTransferSession(transferId) {
  const id = buildTransferKey(transferId);
  if (!id) return;

  const session = await getTransferSession(id);
  if (session?.inboundSessionId) {
    await clearInboundTransferIndex(session.inboundSessionId);
  }

  const redis = await getRedisClient().catch(() => null);
  if (redis) {
    await redis.del(transferRedisKey(id));
    return;
  }
  memoryTransferSessions.delete(id);
}

async function transitionTransferStage(transferId, nextStage, { failureReason = null } = {}) {
  const id = buildTransferKey(transferId);
  if (!id) {
    throw Object.assign(new Error('transferId is required'), { status: 400 });
  }
  if (!Object.values(TRANSFER_STAGES).includes(nextStage)) {
    throw Object.assign(new Error(`Invalid transfer stage: ${nextStage}`), { status: 400 });
  }

  const session = await getTransferSession(id);
  if (!session) {
    throw Object.assign(new Error('Transfer session not found'), { status: 404 });
  }

  if (!canTransitionTransferStage(session.stage, nextStage)) {
    throw Object.assign(
      new Error(`Cannot transition transfer from ${session.stage} to ${nextStage}`),
      { status: 409 },
    );
  }

  const updated = {
    ...session,
    stage: nextStage,
    updatedAt: Date.now(),
    failureReason: nextStage === TRANSFER_STAGES.FAILED
      ? (failureReason ? String(failureReason) : session.failureReason || 'transfer_failed')
      : session.failureReason,
  };

  return saveTransferSession(updated);
}

async function resolveActiveBridgedCallForAgent(sipUsername) {
  const active = await resolveActiveAgentCall(sipUsername);
  if (!active?.inboundCallControlId || !active?.agentLegId) {
    return null;
  }

  const session = await getSession(active.inboundCallControlId);
  if (!session || session.stage !== 'bridged') {
    await clearActiveAgentCall(sipUsername);
    return null;
  }

  const agentLegId = session.connectedLeg || session.winnerLeg || active.agentLegId;
  const callerLegId = active.callerLegId || active.inboundCallControlId;

  return {
    active,
    session,
    callerLegId,
    agentLegId,
    inboundCallControlId: active.inboundCallControlId,
  };
}

async function findTransferSessionForPayload(payload) {
  const clientState = decodeTransferClientState(payload?.client_state);
  if (clientState?.transferId) {
    const byClientState = await getTransferSession(clientState.transferId);
    if (byClientState) return byClientState;
  }

  const callSessionId = payload?.call_session_id
    ? String(payload.call_session_id).trim()
    : null;

  const legId = String(payload?.call_control_id || '').trim();
  if (!legId && !callSessionId) return null;

  const redis = await getRedisClient().catch(() => null);
  const scanSession = async (session) => {
    if (!session) return null;
    if (callSessionId && session.callSessionId === callSessionId
      && session.stage === TRANSFER_STAGES.TRANSFERRING) {
      return session;
    }
    if (
      session.callerLegId === legId
      || session.agentLegId === legId
      || session.transferDestinationLegId === legId
    ) {
      return session;
    }
    return null;
  };

  if (redis) {
    const keys = await redis.keys('cts:*');
    for (const key of keys) {
      if (key.startsWith('cts:inbound:')) continue;
      const raw = await redis.get(key);
      if (!raw) continue;
      const matched = await scanSession(JSON.parse(raw));
      if (matched) return matched;
    }
    return null;
  }

  for (const session of memoryTransferSessions.values()) {
    const matched = await scanSession(session);
    if (matched) return matched;
  }
  return null;
}

async function logTransferredInboundCall(prisma, inboundSession) {
  if (!inboundSession?.callSessionId) return;

  await prisma.callLog.upsert({
    where: { callSid: inboundSession.callSessionId },
    create: {
      callSid: inboundSession.callSessionId,
      from: inboundSession.from,
      to: inboundSession.to,
      status: 'completed',
      tenantId: inboundSession.tenantId,
      direction: 'inbound',
      callType: 'answered',
      endedAt: new Date(),
    },
    update: {
      status: 'completed',
      callType: 'answered',
      endedAt: new Date(),
    },
  });
}

async function finalizeTransferSuccess(prisma, transferSession, inboundSession) {
  if (transferSession.stage !== TRANSFER_STAGES.COMPLETED) {
    transferSession = await transitionTransferStage(
      transferSession.transferId,
      TRANSFER_STAGES.COMPLETED,
    );
  }

  transferSession.agentLegReleased = true;
  await saveTransferSession(transferSession);

  if (inboundSession) {
    inboundSession.transferCompleted = true;
    inboundSession.stage = 'transferred';
    inboundSession.blindTransferId = null;
    await logTransferredInboundCall(prisma, inboundSession);

    for (const target of inboundSession.ringTargets || []) {
      const sip = target.type === 'app'
        ? target.user?.telnyxSipUsername
        : target.type === 'sip'
          ? target.sipUsername
          : null;
      if (sip) await clearPendingAgentRing(sip);
    }

    if (transferSession.agentSipUsername) {
      await clearActiveAgentCall(transferSession.agentSipUsername);
    }

    await deleteSession(transferSession.inboundSessionId || transferSession.callerLegId);
  }

  console.log('[CALL TRANSFER] completed', {
    transferId: transferSession.transferId,
    target: transferSession.target?.value,
    callerLegId: transferSession.callerLegId,
    agentLegId: transferSession.agentLegId,
  });
}

async function finalizeTransferFailure(transferSession, reason) {
  if (isTerminalTransferStage(transferSession.stage)) {
    return transferSession;
  }

  const failed = await transitionTransferStage(
    transferSession.transferId,
    TRANSFER_STAGES.FAILED,
    { failureReason: reason || 'transfer_failed' },
  );

  const inboundSession = await getSession(transferSession.inboundSessionId || transferSession.callerLegId);
  if (inboundSession) {
    inboundSession.blindTransferId = null;
    await saveSession(transferSession.inboundSessionId || transferSession.callerLegId, inboundSession);
  }

  console.log('[CALL TRANSFER] failed', {
    transferId: failed.transferId,
    reason: failed.failureReason,
    callerLegId: failed.callerLegId,
  });

  return failed;
}

/**
 * Blind transfer on the PSTN caller leg per Telnyx Transfer Call API.
 * @see https://developers.telnyx.com/api-reference/call-commands/transfer-call
 */
async function initiateBlindTransfer(prisma, {
  tenantId,
  agentUserId,
  agentSipUsername,
  destination,
  destinationType,
  webrtcCallId = null,
  platform,
}) {
  const bridged = await resolveActiveBridgedCallForAgent(agentSipUsername);
  if (!bridged) {
    throw Object.assign(new Error('No active bridged call found for transfer'), { status: 409 });
  }

  const { session, callerLegId, agentLegId, inboundCallControlId } = bridged;

  const existingTransferId = await resolveInboundTransferId(inboundCallControlId);
  if (existingTransferId) {
    const existing = await getTransferSession(existingTransferId);
    if (existing && existing.stage === TRANSFER_STAGES.TRANSFERRING) {
      throw Object.assign(new Error('A transfer is already in progress for this call'), { status: 409 });
    }
  }

  const resolvedTarget = await resolveTransferDestination(
    prisma,
    tenantId,
    destination,
    destinationType,
    platform,
  );

  const transferSession = createTransferSession({
    tenantId,
    agentUserId,
    callerLegId,
    agentLegId,
    inboundSessionId: inboundCallControlId,
    callSessionId: session.callSessionId || null,
    target: {
      type: resolvedTarget.type,
      value: resolvedTarget.value,
      dialTo: resolvedTarget.to,
      agentSipUsername,
    },
    webrtcCallId,
    mode: 'blind',
  });
  transferSession.agentSipUsername = String(agentSipUsername || '').trim().toLowerCase();

  await saveTransferSession(transferSession);
  await indexInboundTransfer(inboundCallControlId, transferSession.transferId);

  session.blindTransferId = transferSession.transferId;
  await saveSession(inboundCallControlId, session);

  await transitionTransferStage(transferSession.transferId, TRANSFER_STAGES.TRANSFERRING);

  const clientState = encodeTransferClientState({
    transferId: transferSession.transferId,
    stage: 'blind',
  });

  try {
    await require('./telnyxCallControl').transferCall(callerLegId, {
      to: resolvedTarget.to,
      from: session.to || undefined,
      clientState,
      targetLegClientState: clientState,
      timeoutSecs: 30,
    });
  } catch (error) {
    await finalizeTransferFailure(transferSession, error.message || 'telnyx_transfer_failed');
    throw Object.assign(
      new Error(error.message || 'Telnyx transfer failed'),
      { status: error.status || 502, transferId: transferSession.transferId },
    );
  }

  const updated = await getTransferSession(transferSession.transferId);
  console.log('[CALL TRANSFER] initiated', {
    transferId: updated.transferId,
    callerLegId,
    agentLegId,
    to: resolvedTarget.to,
  });

  return {
    transferId: updated.transferId,
    stage: updated.stage,
    target: updated.target,
  };
}

async function handleTransferCallControlEvent(prisma, eventType, payload) {
  const transferSession = await findTransferSessionForPayload(payload);
  if (!transferSession) return false;

  const legId = String(payload?.call_control_id || '').trim();
  const awaitingAgentCleanup = eventType === 'call.hangup'
    && transferSession.stage === TRANSFER_STAGES.COMPLETED
    && legId === transferSession.agentLegId
    && !transferSession.agentLegReleased;

  if (isTerminalTransferStage(transferSession.stage) && !awaitingAgentCleanup) {
    return false;
  }

  const clientState = decodeTransferClientState(payload?.client_state);
  const isTransferTagged = clientState?.kind === 'transfer'
    || transferSession.stage === TRANSFER_STAGES.TRANSFERRING
    || awaitingAgentCleanup;

  if (!isTransferTagged && transferSession.stage !== TRANSFER_STAGES.TRANSFERRING) {
    return false;
  }

  if (eventType === 'call.initiated') {
    if (String(payload?.direction || '').toLowerCase() !== 'outgoing') return false;
    if (legId === transferSession.callerLegId || legId === transferSession.agentLegId) {
      return false;
    }
    transferSession.transferDestinationLegId = legId;
    await saveTransferSession(transferSession);
    console.log('[CALL TRANSFER] destination leg initiated', {
      transferId: transferSession.transferId,
      transferDestinationLegId: legId,
    });
    return true;
  }

  if (eventType === 'call.answered') {
    if (
      legId === transferSession.transferDestinationLegId
      || (clientState?.transferId === transferSession.transferId && legId !== transferSession.agentLegId)
    ) {
      transferSession.targetAnswered = true;
      await saveTransferSession(transferSession);
      console.log('[CALL TRANSFER] destination answered', {
        transferId: transferSession.transferId,
        legId,
      });
      return true;
    }
    return false;
  }

  if (eventType === 'call.bridged') {
    if (transferSession.stage !== TRANSFER_STAGES.TRANSFERRING) return false;

    const involvesDestination = legId === transferSession.transferDestinationLegId;
    const involvesCaller = legId === transferSession.callerLegId && transferSession.targetAnswered;

    if (involvesDestination || involvesCaller) {
      transferSession.callerBridgedToTarget = true;
      await saveTransferSession(transferSession);
      await transitionTransferStage(transferSession.transferId, TRANSFER_STAGES.COMPLETED);
      console.log('[CALL TRANSFER] caller bridged to destination', {
        transferId: transferSession.transferId,
        legId,
      });
      return true;
    }
    return false;
  }

  if (eventType === 'call.hangup') {
    const inboundSession = await getSession(
      transferSession.inboundSessionId || transferSession.callerLegId,
    );

    if (
      legId === transferSession.transferDestinationLegId
      && !transferSession.callerBridgedToTarget
    ) {
      await finalizeTransferFailure(transferSession, 'transfer_target_unavailable');
      return true;
    }

    if (
      legId === transferSession.agentLegId
      && transferSession.callerBridgedToTarget
    ) {
      await finalizeTransferSuccess(prisma, transferSession, inboundSession);
      return true;
    }

    if (
      legId === transferSession.agentLegId
      && transferSession.stage === TRANSFER_STAGES.COMPLETED
    ) {
      await finalizeTransferSuccess(prisma, transferSession, inboundSession);
      return true;
    }

    return false;
  }

  return false;
}

/** Test-only reset for in-memory transfer session state. */
function __resetMemoryTransferStateForTests() {
  memoryTransferSessions.clear();
  memoryInboundTransferIndex.clear();
}

module.exports = {
  TRANSFER_STAGES,
  TERMINAL_TRANSFER_STAGES,
  ALLOWED_STAGE_TRANSITIONS,
  isTerminalTransferStage,
  canTransitionTransferStage,
  encodeTransferClientState,
  decodeTransferClientState,
  inferDestinationType,
  resolveTransferDestination,
  createTransferSession,
  getTransferSession,
  saveTransferSession,
  deleteTransferSession,
  transitionTransferStage,
  resolveActiveBridgedCallForAgent,
  initiateBlindTransfer,
  handleTransferCallControlEvent,
  findTransferSessionForPayload,
  finalizeTransferSuccess,
  finalizeTransferFailure,
  indexInboundTransfer,
  resolveInboundTransferId,
  __resetMemoryTransferStateForTests,
};
