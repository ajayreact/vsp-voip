const { getRedisClient } = require('./redis');
const { logger } = require('./logger');

const SESSION_TTL_SEC = 3600;
const memorySessions = new Map();
const memoryWinnerClaims = new Map();
const memorySideEffects = new Set();
const memoryLegIndex = new Map();
const memoryAgentPending = new Map();
const memoryClaimQueues = new Map();

function buildSessionKey(callControlId) {
  return String(callControlId || '').trim();
}

function redisKey(callControlId) {
  return `ccs:${buildSessionKey(callControlId)}`;
}

function winnerRedisKey(inboundId) {
  return `ccs:winner:${inboundId}`;
}

function legIndexRedisKey(legId) {
  return `ccs:leg:${legId}`;
}

function sideEffectsRedisKey(inboundId, legId) {
  return `ccs:answerfx:${inboundId}:${legId}`;
}

function agentPendingRedisKey(sipUsername) {
  return `ccs:agent:${String(sipUsername || '').trim().toLowerCase()}`;
}

async function withMemoryInboundLock(inboundId, fn) {
  const prev = memoryClaimQueues.get(inboundId) || Promise.resolve();
  const next = prev.then(() => fn(), () => fn());
  memoryClaimQueues.set(inboundId, next.finally(() => {
    if (memoryClaimQueues.get(inboundId) === next) {
      memoryClaimQueues.delete(inboundId);
    }
  }));
  return next;
}

async function getSession(callControlId) {
  const id = buildSessionKey(callControlId);
  if (!id) return null;

  const redis = await getRedisClient().catch(() => null);
  if (redis) {
    const raw = await redis.get(redisKey(id));
    return raw ? JSON.parse(raw) : null;
  }
  return memorySessions.get(id) || null;
}

async function saveSession(callControlId, session) {
  const id = buildSessionKey(callControlId);
  if (!id) return;

  const payload = { ...session, updatedAt: Date.now() };
  const redis = await getRedisClient().catch(() => null);
  if (redis) {
    await redis.set(redisKey(id), JSON.stringify(payload), 'EX', SESSION_TTL_SEC);
    return;
  }
  memorySessions.set(id, payload);
}

async function clearSessionClaims(inboundCallControlId, session) {
  const inboundId = buildSessionKey(inboundCallControlId);
  if (!inboundId) return;

  const legIds = new Set();
  if (Array.isArray(session?.outboundLegs)) {
    for (const leg of session.outboundLegs) {
      if (leg?.callControlId) legIds.add(buildSessionKey(leg.callControlId));
    }
  }
  if (session?.connectedLeg) legIds.add(buildSessionKey(session.connectedLeg));
  if (session?.outboundLegCallControlId) {
    legIds.add(buildSessionKey(session.outboundLegCallControlId));
  }

  const redis = await getRedisClient().catch(() => null);
  if (redis) {
    const pipeline = redis.pipeline();
    pipeline.del(winnerRedisKey(inboundId));
    for (const legId of legIds) {
      pipeline.del(legIndexRedisKey(legId));
      pipeline.del(sideEffectsRedisKey(inboundId, legId));
    }
    await pipeline.exec();
    return;
  }

  memoryWinnerClaims.delete(inboundId);
  for (const legId of legIds) {
    memoryLegIndex.delete(legId);
    memorySideEffects.delete(`${inboundId}:${legId}`);
  }
}

async function deleteSession(callControlId) {
  const id = buildSessionKey(callControlId);
  if (!id) return;

  const session = await getSession(id);
  await clearSessionClaims(id, session);

  const redis = await getRedisClient().catch(() => null);
  if (redis) {
    await redis.del(redisKey(id));
    return;
  }
  memorySessions.delete(id);
}

async function pruneStaleSessions(maxAgeMs = 60 * 60 * 1000) {
  const redis = await getRedisClient().catch(() => null);
  if (redis) return;

  const cutoff = Date.now() - maxAgeMs;
  for (const [key, session] of memorySessions.entries()) {
    if ((session.updatedAt || 0) < cutoff) {
      memorySessions.delete(key);
      memoryWinnerClaims.delete(key);
    }
  }
}

/**
 * RC-1: Atomic winner claim across API instances (Redis SET NX).
 * Returns claimed=true only for the first leg to win the race.
 */
async function claimConnectedLeg(inboundCallControlId, legCallControlId) {
  const inboundId = buildSessionKey(inboundCallControlId);
  const legId = buildSessionKey(legCallControlId);
  if (!inboundId || !legId) {
    return {
      claimed: false,
      reason: 'invalid_id',
      isDuplicateWinnerEvent: false,
      lostRace: false,
    };
  }

  const redis = await getRedisClient().catch(() => null);
  if (redis) {
    const key = winnerRedisKey(inboundId);
    const setResult = await redis.set(key, legId, 'EX', SESSION_TTL_SEC, 'NX');
    if (setResult === 'OK') {
      return {
        claimed: true,
        legCallControlId: legId,
        isDuplicateWinnerEvent: false,
        lostRace: false,
      };
    }
    const existing = await redis.get(key);
    return {
      claimed: false,
      legCallControlId: existing,
      isDuplicateWinnerEvent: existing === legId,
      lostRace: Boolean(existing && existing !== legId),
    };
  }

  return withMemoryInboundLock(inboundId, () => {
    const existing = memoryWinnerClaims.get(inboundId);
    if (!existing) {
      memoryWinnerClaims.set(inboundId, legId);
      return {
        claimed: true,
        legCallControlId: legId,
        isDuplicateWinnerEvent: false,
        lostRace: false,
      };
    }
    return {
      claimed: false,
      legCallControlId: existing,
      isDuplicateWinnerEvent: existing === legId,
      lostRace: existing !== legId,
    };
  });
}

/** RC-2: Run recording + call log side effects at most once per winning leg. */
async function claimAnswerSideEffects(inboundCallControlId, legCallControlId) {
  const inboundId = buildSessionKey(inboundCallControlId);
  const legId = buildSessionKey(legCallControlId);
  if (!inboundId || !legId) return { claimed: false };

  const redis = await getRedisClient().catch(() => null);
  if (redis) {
    const key = sideEffectsRedisKey(inboundId, legId);
    const setResult = await redis.set(key, '1', 'EX', SESSION_TTL_SEC, 'NX');
    return { claimed: setResult === 'OK' };
  }

  const token = `${inboundId}:${legId}`;
  if (memorySideEffects.has(token)) return { claimed: false };
  memorySideEffects.add(token);
  return { claimed: true };
}

async function getClaimedWinner(inboundCallControlId) {
  const inboundId = buildSessionKey(inboundCallControlId);
  if (!inboundId) return null;

  const redis = await getRedisClient().catch(() => null);
  if (redis) {
    return redis.get(winnerRedisKey(inboundId));
  }
  return memoryWinnerClaims.get(inboundId) || null;
}

/** Outbound leg → inbound session index for fast webhook lookup. */
async function indexOutboundLeg(inboundCallControlId, outboundLegCallControlId) {
  const inboundId = buildSessionKey(inboundCallControlId);
  const legId = buildSessionKey(outboundLegCallControlId);
  if (!inboundId || !legId) return;

  const redis = await getRedisClient().catch(() => null);
  if (redis) {
    await redis.set(legIndexRedisKey(legId), inboundId, 'EX', SESSION_TTL_SEC);
    return;
  }
  memoryLegIndex.set(legId, inboundId);
}

async function resolveInboundIdFromLeg(callControlId) {
  const legId = buildSessionKey(callControlId);
  if (!legId) return null;

  const redis = await getRedisClient().catch(() => null);
  if (redis) {
    return redis.get(legIndexRedisKey(legId));
  }
  return memoryLegIndex.get(legId) || null;
}

async function findSession(payload) {
  const callControlId = payload?.call_control_id
    ? String(payload.call_control_id).trim()
    : null;

  if (callControlId) {
    const direct = await getSession(callControlId);
    if (direct) {
      return { session: direct, inboundCallControlId: callControlId };
    }

    const indexedInboundId = await resolveInboundIdFromLeg(callControlId);
    if (indexedInboundId) {
      const indexedSession = await getSession(indexedInboundId);
      if (indexedSession) {
        return { session: indexedSession, inboundCallControlId: indexedInboundId };
      }
    }
  }

  const linkTo = payload?.link_to ? String(payload.link_to).trim() : null;
  if (linkTo) {
    const linked = await getSession(linkTo);
    if (linked) {
      return { session: linked, inboundCallControlId: linkTo };
    }
  }

  const sessionId = payload?.call_session_id
    ? String(payload.call_session_id).trim()
    : null;

  const redis = await getRedisClient().catch(() => null);
  if (redis) {
    const keys = await redis.keys('ccs:*');
    for (const key of keys) {
      if (key.startsWith('ccs:winner:') || key.startsWith('ccs:leg:') || key.startsWith('ccs:answerfx:')) {
        continue;
      }
      const raw = await redis.get(key);
      if (!raw) continue;
      const session = JSON.parse(raw);
      const inboundId = key.replace(/^ccs:/, '');
      if (sessionId && session.callSessionId === sessionId) {
        return { session, inboundCallControlId: inboundId };
      }
      if (callControlId && session.connectedLeg === callControlId) {
        return { session, inboundCallControlId: inboundId };
      }
      if (callControlId && session.outboundLegCallControlId === callControlId) {
        return { session, inboundCallControlId: inboundId };
      }
      if (callControlId && Array.isArray(session.outboundLegs)) {
        const matched = session.outboundLegs.some((leg) => leg.callControlId === callControlId);
        if (matched) {
          return { session, inboundCallControlId: inboundId };
        }
      }
    }
    return { session: null, inboundCallControlId: null };
  }

  for (const [inboundId, session] of memorySessions.entries()) {
    if (sessionId && session.callSessionId === sessionId) {
      return { session, inboundCallControlId: inboundId };
    }
    if (callControlId && session.connectedLeg === callControlId) {
      return { session, inboundCallControlId: inboundId };
    }
    if (callControlId && session.outboundLegCallControlId === callControlId) {
      return { session, inboundCallControlId: inboundId };
    }
    if (callControlId && Array.isArray(session.outboundLegs)) {
      const matched = session.outboundLegs.some((leg) => leg.callControlId === callControlId);
      if (matched) {
        return { session, inboundCallControlId: inboundId };
      }
    }
  }

  return { session: null, inboundCallControlId: null };
}

async function getCallControlSessionStats() {
  const redis = await getRedisClient().catch(() => null);
  if (redis) {
    const keys = await redis.keys('ccs:*');
    let activeSessions = 0;
    let winnerClaims = 0;
    for (const key of keys) {
      if (key.startsWith('ccs:winner:')) {
        winnerClaims += 1;
      } else if (!key.startsWith('ccs:leg:') && !key.startsWith('ccs:answerfx:')) {
        activeSessions += 1;
      }
    }
    return { activeSessions, winnerClaims, source: 'redis' };
  }

  return {
    activeSessions: memorySessions.size,
    winnerClaims: memoryWinnerClaims.size,
    source: 'memory',
  };
}

/** Maps agent SIP username → inbound session while an app ring is pending. */
async function indexPendingAgentRing(inboundCallControlId, sipUsername, pstnCaller) {
  const inboundId = buildSessionKey(inboundCallControlId);
  const user = String(sipUsername || '').trim().toLowerCase();
  if (!inboundId || !user) return;

  const payload = JSON.stringify({
    inboundCallControlId: inboundId,
    pstnCaller: pstnCaller || null,
    indexedAt: Date.now(),
  });

  const redis = await getRedisClient().catch(() => null);
  if (redis) {
    await redis.set(agentPendingRedisKey(user), payload, 'EX', SESSION_TTL_SEC);
    return;
  }
  memoryAgentPending.set(user, payload);
}

async function resolvePendingAgentRing(sipUsername) {
  const user = String(sipUsername || '').trim().toLowerCase();
  if (!user) return null;

  const redis = await getRedisClient().catch(() => null);
  if (redis) {
    const raw = await redis.get(agentPendingRedisKey(user));
    return raw ? JSON.parse(raw) : null;
  }
  const raw = memoryAgentPending.get(user);
  return raw ? (typeof raw === 'string' ? JSON.parse(raw) : raw) : null;
}

async function clearPendingAgentRing(sipUsername) {
  const user = String(sipUsername || '').trim().toLowerCase();
  if (!user) return;

  const redis = await getRedisClient().catch(() => null);
  if (redis) {
    await redis.del(agentPendingRedisKey(user));
  }
  memoryAgentPending.delete(user);
}

/** Test-only reset for in-memory claim state. */
function __resetMemoryClaimStateForTests() {
  memoryWinnerClaims.clear();
  memorySideEffects.clear();
  memoryLegIndex.clear();
  memoryAgentPending.clear();
  memoryClaimQueues.clear();
  memorySessions.clear();
}

module.exports = {
  getSession,
  saveSession,
  deleteSession,
  pruneStaleSessions,
  findSession,
  getCallControlSessionStats,
  claimConnectedLeg,
  claimAnswerSideEffects,
  getClaimedWinner,
  indexOutboundLeg,
  indexPendingAgentRing,
  resolvePendingAgentRing,
  clearPendingAgentRing,
  clearSessionClaims,
  __resetMemoryClaimStateForTests,
};
