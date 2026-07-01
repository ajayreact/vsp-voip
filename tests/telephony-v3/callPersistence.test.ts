import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockTransaction = vi.fn();
const mockCreateOutbox = vi.fn();

const prisma = require('../../lib/telephony-v3/internal/prisma');
const requireRedis = require('../../lib/telephony-v3/Redis/requireRedis');
const callPersistence = require('../../lib/telephony-v3/Sessions/callPersistence');
const { V3ConflictError } = require('../../lib/telephony-v3/errors');

describe('V3 CallPersistence (Phase 2.6)', () => {
  beforeEach(() => {
    vi.spyOn(requireRedis, 'requireV3Redis').mockResolvedValue({
      set: vi.fn().mockResolvedValue('OK'),
      del: vi.fn().mockResolvedValue(1),
      get: vi.fn().mockResolvedValue(null),
      expire: vi.fn().mockResolvedValue(1),
    });
  });

  afterEach(() => {
    prisma.__resetGetPrismaForTests();
    vi.restoreAllMocks();
  });

  it('persists session, leg, and commands atomically', async () => {
    const sessionRow = {
      id: 'sess-1',
      tenantId: 't1',
      state: 'ENDED',
      version: 3,
      correlationId: 'c1',
      engineVersion: 1,
      legs: [],
    };
    const legRow = {
      id: 'leg-1',
      sessionId: 'sess-1',
      callControlId: 'cc-1',
      role: 'ORIGIN',
      state: 'ENDED',
      version: 2,
    };

    prisma.__setGetPrismaForTests(async () => ({
      v3CallSession: { findUnique: vi.fn() },
      v3CallLeg: { findUnique: vi.fn() },
      $transaction: mockTransaction,
    }));

    mockTransaction.mockImplementation(async (fn) => fn({
      v3CallSession: {
        findUnique: vi.fn()
          .mockResolvedValueOnce({ ...sessionRow, state: 'RINGING', version: 1, tenantId: 't1' })
          .mockResolvedValueOnce(sessionRow),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      v3CallLeg: {
        findUnique: vi.fn().mockResolvedValue({ ...legRow, state: 'RINGING', version: 1 }),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      v3SessionTransition: { create: vi.fn() },
      v3LegTransition: { create: vi.fn() },
      v3CommandOutbox: {
        create: mockCreateOutbox.mockResolvedValue({
          id: 'cmd-1',
          commandType: 'HANGUP',
          idempotencyKey: 'sess-1:HANGUP:evt-1:cc-1:0',
        }),
        findUnique: vi.fn(),
      },
    }));

    const result = await callPersistence.persistCallFsmResult({
      sessionId: 'sess-1',
      sessionVersion: 1,
      legId: 'leg-1',
      legVersion: 1,
      sessionTransitions: [{
        transition: {
          fromState: 'RINGING',
          toState: 'ENDING',
          triggerEvent: 'leg.ended',
          eventId: 'evt-1',
        },
        patch: { state: 'ENDING' },
      }],
      legWrite: {
        transition: {
          fromState: 'RINGING',
          toState: 'ENDED',
          triggerEvent: 'leg.hangup',
          eventId: 'evt-1',
        },
        patch: { state: 'ENDED' },
      },
      commandIntents: [{ commandType: 'HANGUP', reason: 'fsm_teardown', payload: {} }],
      commandContext: {
        sessionId: 'sess-1',
        legId: 'leg-1',
        targetCallControlId: 'cc-1',
        eventId: 'evt-1',
      },
      tenantId: 't1',
    });

    expect(result.session.state).toBe('ENDED');
    expect(result.commandRows).toHaveLength(1);
    expect(mockCreateOutbox).toHaveBeenCalled();
  });

  it('throws V3ConflictError on version mismatch (transaction rollback)', async () => {
    prisma.__setGetPrismaForTests(async () => ({
      $transaction: mockTransaction,
    }));

    mockTransaction.mockImplementation(async (fn) => fn({
      v3CallSession: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'sess-1',
          tenantId: 't1',
          state: 'RINGING',
          version: 1,
          legs: [],
        }),
        updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      },
      v3CallLeg: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'leg-1',
          sessionId: 'sess-1',
          callControlId: 'cc-1',
          role: 'ORIGIN',
          state: 'RINGING',
          version: 1,
        }),
      },
      v3SessionTransition: { create: vi.fn() },
      v3LegTransition: { create: vi.fn() },
      v3CommandOutbox: { create: mockCreateOutbox, findUnique: vi.fn() },
    }));

    await expect(callPersistence.persistCallFsmResult({
      sessionId: 'sess-1',
      sessionVersion: 1,
      legId: 'leg-1',
      legVersion: 1,
      sessionTransitions: [{
        transition: {
          fromState: 'RINGING',
          toState: 'ENDING',
          triggerEvent: 'leg.ended',
          eventId: 'evt-1',
        },
        patch: { state: 'ENDING' },
      }],
      legWrite: null,
      commandIntents: [],
      commandContext: { sessionId: 'sess-1', legId: 'leg-1', eventId: 'evt-1' },
    })).rejects.toThrow(V3ConflictError);
  });
});
