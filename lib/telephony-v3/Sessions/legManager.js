const { getPrisma } = require('../internal/prisma');
const { mapLegRow } = require('./sessionMapper');
const { setLegCache, deleteLegCache } = require('../Redis/legCache');
const { V3ConflictError, V3NotFoundError } = require('../errors');
const { v3Logger } = require('../Utils/v3Logger');

/**
 * @param {import('../types').V3CreateLegInput} input
 */
async function createLeg(input) {
  const prisma = await getPrisma();
  const leg = await prisma.v3CallLeg.create({
    data: {
      sessionId: input.sessionId,
      callControlId: input.callControlId,
      role: input.role,
      state: input.state || 'NEW',
      connectionId: input.connectionId || null,
      direction: input.direction || null,
      fromAddress: input.fromAddress || null,
      toAddress: input.toAddress || null,
    },
  });

  const record = mapLegRow(leg);
  await setLegCache(record.callControlId, {
    sessionId: record.sessionId,
    legId: record.id,
    role: record.role,
  });
  v3Logger.info('leg.created', {
    legId: record.id,
    sessionId: record.sessionId,
    callControlId: record.callControlId,
    role: record.role,
  });
  return record;
}

/**
 * Find existing leg by callControlId or create; reload on uniqueness conflict.
 * @param {import('../types').V3CreateLegInput} input
 * @returns {Promise<{ leg: import('../types').V3LegRecord, created: boolean }>}
 */
async function findOrCreateLeg(input) {
  const existing = await findLegByCallControlId(input.callControlId);
  if (existing) {
    return { leg: existing, created: false };
  }

  try {
    const leg = await createLeg(input);
    return { leg, created: true };
  } catch (error) {
    if (error?.code === 'P2002') {
      const leg = await findLegByCallControlId(input.callControlId);
      if (leg) {
        v3Logger.info('leg.create.duplicate', {
          callControlId: input.callControlId,
          legId: leg.id,
          sessionId: leg.sessionId,
        });
        return { leg, created: false };
      }
    }
    throw error;
  }
}

/**
 * @param {string} callControlId
 */
async function findLegByCallControlId(callControlId) {
  if (!callControlId) return null;
  const prisma = await getPrisma();
  const leg = await prisma.v3CallLeg.findUnique({ where: { callControlId } });
  return leg ? mapLegRow(leg) : null;
}

/**
 * @param {string} legId
 * @param {number} expectedVersion
 * @param {{ state?: string, answeredAt?: Date|null, endedAt?: Date|null, hangupCause?: string|null }} patch
 * @param {{ fromState: string, toState: string, triggerEvent: string, eventId: string, metadata?: Record<string, unknown> }} transition
 */
async function persistLegTransition(legId, expectedVersion, patch, transition) {
  const prisma = await getPrisma();

  try {
    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.v3CallLeg.updateMany({
        where: { id: legId, version: expectedVersion },
        data: {
          ...patch,
          version: { increment: 1 },
          updatedAt: new Date(),
        },
      });

      if (result.count === 0) {
        throw new V3ConflictError('Leg version conflict');
      }

      await tx.v3LegTransition.create({
        data: {
          sessionId: (await tx.v3CallLeg.findUnique({ where: { id: legId } })).sessionId,
          legId,
          fromState: transition.fromState,
          toState: transition.toState,
          triggerEvent: transition.triggerEvent,
          eventId: `${transition.eventId}:leg:${legId}`,
          metadata: transition.metadata || null,
        },
      });

      return tx.v3CallLeg.findUnique({ where: { id: legId } });
    });

    const record = mapLegRow(updated);
    await setLegCache(record.callControlId, {
      sessionId: record.sessionId,
      legId: record.id,
      role: record.role,
    });
    v3Logger.info('leg.transition', {
      legId,
      fromState: transition.fromState,
      toState: transition.toState,
      trigger: transition.triggerEvent,
      eventId: transition.eventId,
    });
    return record;
  } catch (error) {
    if (error?.code === 'P2002') {
      v3Logger.info('leg.transition.duplicate', { legId, eventId: transition.eventId });
      const prisma = await getPrisma();
      const leg = await prisma.v3CallLeg.findUnique({ where: { id: legId } });
      return mapLegRow(leg);
    }
    throw error;
  }
}

async function invalidateLegCache(callControlId) {
  await deleteLegCache(callControlId);
}

module.exports = {
  createLeg,
  findOrCreateLeg,
  findLegByCallControlId,
  persistLegTransition,
  invalidateLegCache,
};
