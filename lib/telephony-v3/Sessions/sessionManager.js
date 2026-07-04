const crypto = require('crypto');
const { getPrisma } = require('../internal/prisma');
const { mapSessionRow } = require('./sessionMapper');
const { setSessionCache, deleteSessionCache } = require('../Redis/sessionCache');
const { V3ConflictError, V3NotFoundError, V3TenantIsolationError } = require('../errors');
const { v3Logger } = require('../Utils/v3Logger');
const { ENGINE_VERSION } = require('../constants');

/**
 * @param {import('../types').V3CreateSessionInput} input
 */
async function createSession(input) {
  const prisma = await getPrisma();
  const session = await prisma.v3CallSession.create({
    data: {
      tenantId: input.tenantId || null,
      state: input.state || 'NEW',
      origin: input.origin || null,
      direction: input.direction || null,
      telnyxCallSessionId: input.telnyxCallSessionId || null,
      primaryCallControlId: input.primaryCallControlId || null,
      correlationId: input.correlationId || crypto.randomUUID(),
      callerExtensionId: input.callerExtensionId || null,
      callerUserId: input.callerUserId || null,
      routeSnapshot: input.routeSnapshot || undefined,
      engineVersion: ENGINE_VERSION,
    },
    include: { legs: true },
  });

  const record = mapSessionRow(session);
  await setSessionCache(record.id, record);
  v3Logger.info('session.created', { sessionId: record.id, tenantId: record.tenantId, state: record.state });
  return record;
}

/**
 * Find existing session by telnyxCallSessionId or create; reload on uniqueness conflict.
 * @param {import('../types').V3CreateSessionInput} input
 * @returns {Promise<{ session: import('../types').V3SessionRecord, created: boolean }>}
 */
async function findOrCreateSession(input) {
  const prisma = await getPrisma();

  if (input.telnyxCallSessionId) {
    const existing = await prisma.v3CallSession.findFirst({
      where: { telnyxCallSessionId: input.telnyxCallSessionId },
      include: { legs: true },
    });
    if (existing) {
      return { session: mapSessionRow(existing), created: false };
    }
  }

  try {
    const session = await createSession(input);
    return { session, created: true };
  } catch (error) {
    if (error?.code === 'P2002' && input.telnyxCallSessionId) {
      const existing = await prisma.v3CallSession.findFirst({
        where: { telnyxCallSessionId: input.telnyxCallSessionId },
        include: { legs: true },
      });
      if (existing) {
        v3Logger.info('session.create.duplicate', {
          telnyxCallSessionId: input.telnyxCallSessionId,
          sessionId: existing.id,
        });
        return { session: mapSessionRow(existing), created: false };
      }
    }
    throw error;
  }
}

/**
 * @param {string} sessionId
 * @param {string|null|undefined} tenantId
 */
async function loadSession(sessionId, tenantId = null) {
  const prisma = await getPrisma();
  const session = await prisma.v3CallSession.findUnique({
    where: { id: sessionId },
    include: { legs: true },
  });
  if (!session) throw new V3NotFoundError('session', sessionId);
  assertTenantAccess(session.tenantId, tenantId, sessionId);
  return mapSessionRow(session);
}

/**
 * Optimistic-lock session update with transition audit row.
 * @param {string} sessionId
 * @param {number} expectedVersion
 * @param {{ state?: string, failureCode?: string|null, answeredAt?: Date|null, endedAt?: Date|null }} patch
 * @param {{ fromState: string, toState: string, triggerEvent: string, eventId: string, metadata?: Record<string, unknown> }} transition
 * @param {string|null|undefined} tenantId
 */
async function persistSessionTransition(sessionId, expectedVersion, patch, transition, tenantId = null) {
  const prisma = await getPrisma();

  try {
    const updated = await prisma.$transaction(async (tx) => {
      const existing = await tx.v3CallSession.findUnique({ where: { id: sessionId } });
      if (!existing) throw new V3NotFoundError('session', sessionId);
      assertTenantAccess(existing.tenantId, tenantId, sessionId);

      const result = await tx.v3CallSession.updateMany({
        where: { id: sessionId, version: expectedVersion },
        data: {
          ...patch,
          version: { increment: 1 },
          updatedAt: new Date(),
        },
      });

      if (result.count === 0) {
        throw new V3ConflictError('Session version conflict');
      }

      await tx.v3SessionTransition.create({
        data: {
          sessionId,
          fromState: transition.fromState,
          toState: transition.toState,
          triggerEvent: transition.triggerEvent,
          eventId: transition.eventId,
          metadata: transition.metadata || null,
        },
      });

      return tx.v3CallSession.findUnique({
        where: { id: sessionId },
        include: { legs: true },
      });
    });

    const record = mapSessionRow(updated);
    await setSessionCache(record.id, record);
    v3Logger.info('session.transition', {
      sessionId,
      fromState: transition.fromState,
      toState: transition.toState,
      trigger: transition.triggerEvent,
      eventId: transition.eventId,
    });
    return record;
  } catch (error) {
    if (error?.code === 'P2002') {
      v3Logger.info('session.transition.duplicate', { sessionId, eventId: transition.eventId });
      return loadSession(sessionId, tenantId);
    }
    throw error;
  }
}

/**
 * @param {string|null} sessionTenantId
 * @param {string|null|undefined} requestTenantId
 * @param {string} sessionId
 */
function assertTenantAccess(sessionTenantId, requestTenantId, sessionId) {
  if (!requestTenantId || !sessionTenantId) return;
  if (sessionTenantId !== requestTenantId) {
    throw new V3TenantIsolationError(sessionId, requestTenantId);
  }
}

async function invalidateSessionCache(sessionId) {
  await deleteSessionCache(sessionId);
}

module.exports = {
  createSession,
  findOrCreateSession,
  loadSession,
  persistSessionTransition,
  assertTenantAccess,
  invalidateSessionCache,
};
