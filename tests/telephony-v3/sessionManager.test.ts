import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockCreate = vi.fn();
const mockFindUnique = vi.fn();
const mockUpdateMany = vi.fn();
const mockTransitionCreate = vi.fn();
const mockTransaction = vi.fn();

const prisma = require('../../lib/telephony-v3/internal/prisma');
const requireRedis = require('../../lib/telephony-v3/Redis/requireRedis');
const sessionManager = require('../../lib/telephony-v3/Sessions/sessionManager');
const { V3TenantIsolationError, V3ConflictError } = require('../../lib/telephony-v3/errors');

describe('V3 SessionManager', () => {
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

  function setupPrisma() {
    prisma.__setGetPrismaForTests(async () => ({
      v3CallSession: {
        create: mockCreate,
        findUnique: mockFindUnique,
        updateMany: mockUpdateMany,
      },
      v3SessionTransition: { create: mockTransitionCreate },
      $transaction: mockTransaction,
    }));
  }

  it('creates session and caches record', async () => {
    setupPrisma();
    mockCreate.mockResolvedValue({
      id: 'sess-1',
      tenantId: 'tenant-a',
      state: 'NEW',
      correlationId: 'corr-1',
      version: 0,
      engineVersion: 3,
      legs: [],
    });

    const record = await sessionManager.createSession({
      tenantId: 'tenant-a',
      correlationId: 'corr-1',
    });

    expect(record.id).toBe('sess-1');
    expect(requireRedis.requireV3Redis).toHaveBeenCalled();
  });

  it('enforces tenant isolation on load', async () => {
    setupPrisma();
    mockFindUnique.mockResolvedValue({
      id: 'sess-1',
      tenantId: 'tenant-a',
      state: 'NEW',
      version: 0,
      legs: [],
    });

    await expect(sessionManager.loadSession('sess-1', 'tenant-b')).rejects.toThrow(V3TenantIsolationError);
  });

  it('persists transition with optimistic locking', async () => {
    setupPrisma();
    const updatedSession = {
      id: 'sess-1',
      tenantId: 'tenant-a',
      state: 'BRIDGING',
      version: 2,
      legs: [],
    };
    mockTransaction.mockImplementation(async (fn) => {
      const tx = {
        v3CallSession: {
          findUnique: vi.fn()
            .mockResolvedValueOnce({ id: 'sess-1', tenantId: 'tenant-a', version: 1 })
            .mockResolvedValueOnce(updatedSession),
          updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        },
        v3SessionTransition: { create: mockTransitionCreate },
      };
      return fn(tx);
    });

    const record = await sessionManager.persistSessionTransition(
      'sess-1',
      1,
      { state: 'BRIDGING' },
      {
        fromState: 'RINGING',
        toState: 'BRIDGING',
        triggerEvent: 'call.answered',
        eventId: 'evt-1',
      },
      'tenant-a',
    );

    expect(record.state).toBe('BRIDGING');
    expect(mockTransitionCreate).toHaveBeenCalled();
    expect(requireRedis.requireV3Redis).toHaveBeenCalled();
  });

  it('throws on version conflict', async () => {
    setupPrisma();
    mockTransaction.mockImplementation(async (fn) =>
      fn({
        v3CallSession: {
          findUnique: vi.fn().mockResolvedValue({
            id: 'sess-1',
            tenantId: 'tenant-a',
            version: 2,
          }),
          updateMany: vi.fn().mockResolvedValue({ count: 0 }),
        },
        v3SessionTransition: { create: mockTransitionCreate },
      }),
    );

    await expect(
      sessionManager.persistSessionTransition(
        'sess-1',
        1,
        { state: 'BRIDGING' },
        {
          fromState: 'RINGING',
          toState: 'BRIDGING',
          triggerEvent: 'call.answered',
          eventId: 'evt-1',
        },
      ),
    ).rejects.toThrow(V3ConflictError);
  });
});
