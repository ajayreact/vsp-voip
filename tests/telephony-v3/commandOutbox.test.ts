import { afterEach, describe, expect, it, vi } from 'vitest';

const mockCreate = vi.fn();
const mockFindUnique = vi.fn();

const prisma = require('../../lib/telephony-v3/internal/prisma');
const outbox = require('../../lib/telephony-v3/Outbox/commandOutbox');

describe('V3 CommandOutbox', () => {
  afterEach(() => {
    prisma.__resetGetPrismaForTests();
    vi.clearAllMocks();
  });

  it('enqueues command with idempotency key', async () => {
    prisma.__setGetPrismaForTests(async () => ({
      v3CommandOutbox: {
        create: mockCreate,
        findUnique: mockFindUnique,
      },
    }));

    mockCreate.mockResolvedValue({
      id: 'cmd-1',
      commandType: 'DIAL',
      status: 'PENDING',
    });

    const row = await outbox.enqueueCommand({
      sessionId: 'sess-1',
      commandType: 'DIAL',
      idempotencyKey: 'sess-1:DIAL:leg-1',
      payload: { to: '101' },
    });

    expect(row.id).toBe('cmd-1');
    expect(mockCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        sessionId: 'sess-1',
        commandType: 'DIAL',
        idempotencyKey: 'sess-1:DIAL:leg-1',
        status: 'PENDING',
      }),
    });
  });

  it('returns existing row on duplicate idempotency key', async () => {
    prisma.__setGetPrismaForTests(async () => ({
      v3CommandOutbox: {
        create: mockCreate,
        findUnique: mockFindUnique,
      },
    }));

    const existing = { id: 'cmd-existing', status: 'PENDING' };
    mockCreate.mockRejectedValue({ code: 'P2002' });
    mockFindUnique.mockResolvedValue(existing);

    const row = await outbox.enqueueCommand({
      sessionId: 'sess-1',
      commandType: 'DIAL',
      idempotencyKey: 'dup-key',
      payload: {},
    });

    expect(row.id).toBe('cmd-existing');
  });
});
