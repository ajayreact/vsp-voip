import { afterEach, describe, expect, it, vi } from 'vitest';

const mockFindOrCreateSession = vi.fn();
const mockFindOrCreateLeg = vi.fn();

vi.mock('../../lib/telephony-v3/Redis/requireRedis', () => ({
  requireV3Redis: vi.fn(async () => ({
    set: vi.fn().mockResolvedValue('OK'),
    del: vi.fn().mockResolvedValue(1),
    get: vi.fn().mockResolvedValue(null),
    expire: vi.fn().mockResolvedValue(1),
    eval: vi.fn().mockResolvedValue(1),
  })),
  isV3RedisRequired: () => true,
}));

vi.mock('../../lib/telephony-v3/Redis/legCache', () => ({
  setLegCache: vi.fn(async () => {}),
  deleteLegCache: vi.fn(async () => {}),
  getLegCache: vi.fn(async () => null),
}));

const prisma = require('../../lib/telephony-v3/internal/prisma');
const sessionManager = require('../../lib/telephony-v3/Sessions/sessionManager');
const legManager = require('../../lib/telephony-v3/Sessions/legManager');

describe('V3 findOrCreate (Phase 2.6)', () => {
  afterEach(() => {
    prisma.__resetGetPrismaForTests();
    vi.restoreAllMocks();
  });

  it('findOrCreateSession reloads on telnyxCallSessionId conflict', async () => {
    const existing = {
      id: 'sess-existing',
      tenantId: 't1',
      state: 'NEW',
      version: 0,
      correlationId: 'c1',
      engineVersion: 1,
      legs: [],
    };

    prisma.__setGetPrismaForTests(async () => ({
      v3CallSession: {
        findFirst: vi.fn()
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce(existing),
        create: vi.fn().mockRejectedValue({ code: 'P2002' }),
      },
    }));

    const { session, created } = await sessionManager.findOrCreateSession({
      tenantId: 't1',
      telnyxCallSessionId: 'ts-1',
      correlationId: 'c1',
    });

    expect(created).toBe(false);
    expect(session.id).toBe('sess-existing');
  });

  it('findOrCreateLeg reloads on callControlId conflict', async () => {
    const existingLeg = {
      id: 'leg-existing',
      sessionId: 'sess-1',
      callControlId: 'cc-1',
      role: 'ORIGIN',
      state: 'NEW',
      version: 0,
    };

    const findUnique = vi.fn()
      .mockResolvedValueOnce(null)
      .mockResolvedValue(existingLeg);

    prisma.__setGetPrismaForTests(async () => ({
      v3CallLeg: {
        findUnique,
        create: vi.fn().mockRejectedValue({ code: 'P2002' }),
      },
    }));

    const { leg, created } = await legManager.findOrCreateLeg({
      sessionId: 'sess-1',
      callControlId: 'cc-1',
      role: 'ORIGIN',
    });

    expect(created).toBe(false);
    expect(leg.id).toBe('leg-existing');
    expect(findUnique).toHaveBeenCalledTimes(2);
  });
});
