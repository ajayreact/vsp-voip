const { getPrisma } = require('../internal/prisma');
const { mapSessionRow, mapLegRow } = require('./sessionMapper');
const { setSessionCache } = require('../Redis/sessionCache');
const { setLegCache } = require('../Redis/legCache');
const { enqueueCommandInTransaction, buildIdempotencyKey } = require('../Outbox/commandOutbox');
const { assertTenantAccess } = require('./sessionManager');
const { V3ConflictError, V3NotFoundError } = require('../errors');
const { v3Logger } = require('../Utils/v3Logger');
const { OUTBOX } = require('../constants');

/**
 * @typedef {Object} SessionTransitionWrite
 * @property {{ fromState: string, toState: string, triggerEvent: string, eventId: string, metadata?: Record<string, unknown> }} transition
 * @property {Record<string, unknown>} patch
 */

/**
 * Atomically persist session + leg FSM transitions and command intents.
 * @param {Object} input
 * @param {string} input.sessionId
 * @param {number} input.sessionVersion
 * @param {string} input.legId
 * @param {number} input.legVersion
 * @param {SessionTransitionWrite[]} input.sessionTransitions
 * @param {{ transition: Object, patch: Record<string, unknown> }|null} input.legWrite
 * @param {import('../types').V3CommandIntent[]} input.commandIntents
 * @param {{ sessionId: string, legId: string, tenantId?: string|null, correlationId?: string|null, targetCallControlId?: string|null, eventId: string }} input.commandContext
 * @param {string|null|undefined} input.tenantId
 * @returns {Promise<{ session: import('../types').V3SessionRecord, leg: import('../types').V3LegRecord, commandRows: object[], duplicate: boolean }>}
 */
async function persistCallFsmResult(input) {
  const prisma = await getPrisma();
  const hasWrites = input.sessionTransitions.length > 0 || input.legWrite;

  if (!hasWrites && !input.commandIntents.length) {
    const session = await prisma.v3CallSession.findUnique({
      where: { id: input.sessionId },
      include: { legs: true },
    });
    const leg = await prisma.v3CallLeg.findUnique({ where: { id: input.legId } });
    if (!session || !leg) throw new V3NotFoundError('session_or_leg', input.sessionId);
    return {
      session: mapSessionRow(session),
      leg: mapLegRow(leg),
      commandRows: [],
      duplicate: false,
    };
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const existingSession = await tx.v3CallSession.findUnique({
        where: { id: input.sessionId },
        include: { legs: true },
      });
      if (!existingSession) throw new V3NotFoundError('session', input.sessionId);
      assertTenantAccess(existingSession.tenantId, input.tenantId, input.sessionId);

      const existingLeg = await tx.v3CallLeg.findUnique({ where: { id: input.legId } });
      if (!existingLeg) throw new V3NotFoundError('leg', input.legId);

      let expectedSessionVersion = input.sessionVersion;
      let expectedLegVersion = input.legVersion;

      for (const write of input.sessionTransitions) {
        const updateResult = await tx.v3CallSession.updateMany({
          where: { id: input.sessionId, version: expectedSessionVersion },
          data: {
            ...write.patch,
            state: write.transition.toState,
            version: { increment: 1 },
            updatedAt: new Date(),
          },
        });
        if (updateResult.count === 0) {
          throw new V3ConflictError('Session version conflict');
        }

        await tx.v3SessionTransition.create({
          data: {
            sessionId: input.sessionId,
            fromState: write.transition.fromState,
            toState: write.transition.toState,
            triggerEvent: write.transition.triggerEvent,
            eventId: write.transition.eventId,
            metadata: write.transition.metadata || null,
          },
        });
        expectedSessionVersion += 1;
      }

      if (input.legWrite) {
        const updateResult = await tx.v3CallLeg.updateMany({
          where: { id: input.legId, version: expectedLegVersion },
          data: {
            ...input.legWrite.patch,
            state: input.legWrite.transition.toState,
            version: { increment: 1 },
            updatedAt: new Date(),
          },
        });
        if (updateResult.count === 0) {
          throw new V3ConflictError('Leg version conflict');
        }

        await tx.v3LegTransition.create({
          data: {
            sessionId: existingLeg.sessionId,
            legId: input.legId,
            fromState: input.legWrite.transition.fromState,
            toState: input.legWrite.transition.toState,
            triggerEvent: input.legWrite.transition.triggerEvent,
            eventId: `${input.legWrite.transition.eventId}:leg:${input.legId}`,
            metadata: input.legWrite.transition.metadata || null,
          },
        });
      }

      const commandRows = [];
      let sequence = 0;
      for (const intent of input.commandIntents) {
        const target = input.commandContext.targetCallControlId || input.legId || 'none';
        const idempotencyKey = buildIdempotencyKey(
          input.sessionId,
          intent.commandType,
          `${input.commandContext.eventId}:${target}:${sequence}`,
        );
        const row = await enqueueCommandInTransaction(tx, {
          sessionId: input.sessionId,
          legId: input.legId,
          commandType: intent.commandType,
          idempotencyKey,
          payload: {
            ...intent.payload,
            intentReason: intent.reason || null,
            phase: 2,
            sourceEventId: input.commandContext.eventId,
          },
          maxAttempts: OUTBOX.DEFAULT_MAX_ATTEMPTS,
        });
        commandRows.push(row);
        sequence += 1;
      }

      const session = await tx.v3CallSession.findUnique({
        where: { id: input.sessionId },
        include: { legs: true },
      });
      const leg = await tx.v3CallLeg.findUnique({ where: { id: input.legId } });
      return { session, leg, commandRows, duplicate: false };
    });

    const sessionRecord = mapSessionRow(result.session);
    const legRecord = mapLegRow(result.leg);
    await setSessionCache(sessionRecord.id, sessionRecord);
    await setLegCache(legRecord.callControlId, {
      sessionId: legRecord.sessionId,
      legId: legRecord.id,
      role: legRecord.role,
    });

    v3Logger.info('call.fsm_persisted', {
      sessionId: sessionRecord.id,
      legId: legRecord.id,
      sessionState: sessionRecord.state,
      legState: legRecord.state,
      commandCount: result.commandRows.length,
    });

    return {
      session: sessionRecord,
      leg: legRecord,
      commandRows: result.commandRows,
      duplicate: false,
    };
  } catch (error) {
    if (error?.code === 'P2002') {
      v3Logger.info('call.fsm_persist_duplicate', {
        sessionId: input.sessionId,
        eventId: input.commandContext.eventId,
      });
      const session = await prisma.v3CallSession.findUnique({
        where: { id: input.sessionId },
        include: { legs: true },
      });
      const leg = await prisma.v3CallLeg.findUnique({ where: { id: input.legId } });
      if (!session || !leg) throw error;
      return {
        session: mapSessionRow(session),
        leg: mapLegRow(leg),
        commandRows: [],
        duplicate: true,
      };
    }
    throw error;
  }
}

module.exports = { persistCallFsmResult };
