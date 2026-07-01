const { getPrisma } = require('../internal/prisma');
const { getLegCache } = require('../Redis/legCache');
const { getSessionCache, setSessionCache } = require('../Redis/sessionCache');
const { V3NotFoundError } = require('../errors');

/**
 * Load session from Redis cache, then Postgres. Warm cache on PG hit.
 * @param {string} sessionId
 */
async function loadSessionById(sessionId) {
  const cached = await getSessionCache(sessionId);
  if (cached) return cached;

  const prisma = await getPrisma();
  const session = await prisma.v3CallSession.findUnique({
    where: { id: sessionId },
    include: { legs: true },
  });
  if (!session) {
    throw new V3NotFoundError('session', sessionId);
  }

  const snapshot = {
    id: session.id,
    tenantId: session.tenantId,
    state: session.state,
    correlationId: session.correlationId,
    version: session.version,
    legs: session.legs.map((leg) => ({
      id: leg.id,
      callControlId: leg.callControlId,
      role: leg.role,
      state: leg.state,
    })),
  };
  await setSessionCache(sessionId, snapshot);
  return snapshot;
}

/**
 * @param {string|null|undefined} callControlId
 */
async function loadSessionByCallControlId(callControlId) {
  if (!callControlId) return null;

  const legMapping = await getLegCache(callControlId);
  if (legMapping?.sessionId) {
    return loadSessionById(legMapping.sessionId);
  }

  const prisma = await getPrisma();
  const leg = await prisma.v3CallLeg.findUnique({
    where: { callControlId },
    include: { session: { include: { legs: true } } },
  });
  if (!leg) return null;

  const snapshot = {
    id: leg.session.id,
    tenantId: leg.session.tenantId,
    state: leg.session.state,
    correlationId: leg.session.correlationId,
    version: leg.session.version,
    legs: leg.session.legs.map((l) => ({
      id: l.id,
      callControlId: l.callControlId,
      role: l.role,
      state: l.state,
    })),
  };
  await setSessionCache(leg.session.id, snapshot);
  return snapshot;
}

module.exports = {
  loadSessionById,
  loadSessionByCallControlId,
};
