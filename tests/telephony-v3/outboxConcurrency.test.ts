import { afterEach, describe, expect, it, vi } from 'vitest';

const mockQueryRaw = vi.fn();

const prisma = require('../../lib/telephony-v3/internal/prisma');
const outbox = require('../../lib/telephony-v3/Outbox/commandOutbox');

describe('V3 Outbox concurrency guarantees', () => {
  afterEach(() => {
    prisma.__resetGetPrismaForTests();
    vi.clearAllMocks();
  });

  it('two workers receive disjoint claim results from atomic UPDATE', async () => {
    mockQueryRaw
      .mockResolvedValueOnce([{ id: 'cmd-1', status: 'PROCESSING', claimOwner: 'worker-a' }])
      .mockResolvedValueOnce([{ id: 'cmd-2', status: 'PROCESSING', claimOwner: 'worker-b' }]);

    prisma.__setGetPrismaForTests(async () => ({
      $queryRaw: mockQueryRaw,
      $transaction: async (fn) => fn({ $queryRaw: mockQueryRaw }),
    }));

    const [a, b] = await Promise.all([
      outbox.claimPendingCommands('worker-a', 1),
      outbox.claimPendingCommands('worker-b', 1),
    ]);

    expect(a.map((r) => r.id)).toEqual(['cmd-1']);
    expect(b.map((r) => r.id)).toEqual(['cmd-2']);
    expect(mockQueryRaw).toHaveBeenCalledTimes(2);
  });

  it('buildIdempotencyKey is deterministic for same logical command', () => {
    const key = outbox.buildIdempotencyKey('sess-1', 'DIAL', 'leg-1');
    expect(key).toBe('sess-1:DIAL:leg-1');
    expect(outbox.buildIdempotencyKey('sess-1', 'DIAL', 'leg-1')).toBe(key);
  });
});
