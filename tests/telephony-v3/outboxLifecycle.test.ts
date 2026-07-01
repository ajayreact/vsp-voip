import { afterEach, describe, expect, it, vi } from 'vitest';

const mockUpdate = vi.fn();
const mockUpdateMany = vi.fn();
const mockFindUnique = vi.fn();
const mockFindFirst = vi.fn();
const mockQueryRaw = vi.fn();

const prisma = require('../../lib/telephony-v3/internal/prisma');
const outbox = require('../../lib/telephony-v3/Outbox/commandOutbox');

function mockPrismaClient() {
  prisma.__setGetPrismaForTests(async () => ({
    v3CommandOutbox: {
      update: mockUpdate,
      updateMany: mockUpdateMany,
      findUnique: mockFindUnique,
      findFirst: mockFindFirst,
    },
    $queryRaw: mockQueryRaw,
    $transaction: async (fn) => fn({
      $queryRaw: mockQueryRaw,
    }),
  }));
}

describe('V3 CommandOutbox lifecycle (integration)', () => {
  afterEach(() => {
    prisma.__resetGetPrismaForTests();
    vi.clearAllMocks();
  });

  it('claims pending commands with PROCESSING status and worker lease', async () => {
    mockPrismaClient();
    const rows = [{ id: 'cmd-1', commandType: 'DIAL', status: 'PROCESSING', claimOwner: 'worker-a' }];
    mockQueryRaw.mockResolvedValue(rows);

    const claimed = await outbox.claimPendingCommands('worker-a', 10);

    expect(claimed).toEqual(rows);
    expect(mockQueryRaw).toHaveBeenCalled();
  });

  it('requires workerId to claim', async () => {
    mockPrismaClient();
    await expect(outbox.claimPendingCommands('', 10)).rejects.toThrow('workerId is required');
  });

  it('marks command sent only for owning worker', async () => {
    mockPrismaClient();
    mockUpdateMany.mockResolvedValue({ count: 1 });
    mockFindUnique.mockResolvedValue({ id: 'cmd-1', commandType: 'DIAL', status: 'SENT' });

    const sent = await outbox.markCommandSent('cmd-1', 'worker-a', { telnyxRequestId: 'stub-1' });

    expect(sent?.status).toBe('SENT');
    expect(mockUpdateMany).toHaveBeenCalledWith({
      where: { id: 'cmd-1', claimOwner: 'worker-a', status: 'PROCESSING' },
      data: expect.objectContaining({ status: 'SENT' }),
    });
  });

  it('acknowledges sent command and clears lease', async () => {
    mockPrismaClient();
    mockUpdateMany.mockResolvedValue({ count: 1 });
    mockFindUnique.mockResolvedValue({ id: 'cmd-1', status: 'ACKED' });

    const acked = await outbox.acknowledgeCommand('cmd-1', 'worker-a');

    expect(acked?.status).toBe('ACKED');
    expect(mockUpdateMany).toHaveBeenCalledWith({
      where: { id: 'cmd-1', status: 'SENT', claimOwner: 'worker-a' },
      data: expect.objectContaining({
        status: 'ACKED',
        claimOwner: null,
        claimedUntil: null,
      }),
    });
  });

  it('retries failed commands with exponential backoff', async () => {
    mockPrismaClient();
    mockFindFirst.mockResolvedValue({
      id: 'cmd-1',
      commandType: 'DIAL',
      attempts: 1,
      maxAttempts: 5,
      nextAttemptAt: new Date(),
    });
    mockUpdate.mockResolvedValue({ id: 'cmd-1', status: 'FAILED', commandType: 'DIAL' });

    const row = await outbox.markCommandFailed('cmd-1', 'transient error', 'worker-a');

    expect(row.status).toBe('FAILED');
    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: 'cmd-1' },
      data: expect.objectContaining({
        status: 'FAILED',
        attempts: 2,
        claimOwner: null,
        lastError: 'transient error',
      }),
    });
  });

  it('dead-letters command after max attempts', async () => {
    mockPrismaClient();
    mockFindFirst.mockResolvedValue({
      id: 'cmd-1',
      commandType: 'HANGUP',
      attempts: 4,
      maxAttempts: 5,
      nextAttemptAt: new Date(),
    });
    mockUpdate.mockResolvedValue({ id: 'cmd-1', status: 'DEAD', commandType: 'HANGUP' });

    const row = await outbox.markCommandFailed('cmd-1', 'permanent failure', 'worker-a');

    expect(row.status).toBe('DEAD');
  });

  it('completes command with execution metadata in payload', async () => {
    mockPrismaClient();
    mockFindFirst.mockResolvedValue({
      id: 'cmd-1',
      commandType: 'HANGUP',
      attempts: 0,
      payload: { phase: 2 },
      status: 'PROCESSING',
      claimOwner: 'worker-a',
    });
    mockUpdateMany.mockResolvedValue({ count: 1 });
    mockFindUnique.mockResolvedValue({ id: 'cmd-1', status: 'ACKED' });

    const row = await outbox.completeCommand('cmd-1', 'worker-a', {
      telnyxRequestId: 'req-1',
      result: { ok: true },
      execution: {
        startedAt: '2026-06-24T00:00:00.000Z',
        workerId: 'worker-a',
        executionTimeMs: 12,
      },
    });

    expect(row?.status).toBe('ACKED');
    expect(mockUpdateMany).toHaveBeenCalledWith({
      where: { id: 'cmd-1', claimOwner: 'worker-a', status: 'PROCESSING' },
      data: expect.objectContaining({
        status: 'ACKED',
        telnyxRequestId: 'req-1',
        payload: expect.objectContaining({
          execution: expect.objectContaining({
            status: 'completed',
            workerId: 'worker-a',
          }),
        }),
      }),
    });
  });

  it('marks permanent execution failure as DEAD immediately', async () => {
    mockPrismaClient();
    mockFindFirst.mockResolvedValue({
      id: 'cmd-1',
      commandType: 'HANGUP',
      attempts: 0,
      maxAttempts: 5,
      payload: {},
      nextAttemptAt: new Date(),
    });
    mockUpdate.mockResolvedValue({ id: 'cmd-1', status: 'DEAD', commandType: 'HANGUP' });

    const row = await outbox.markCommandExecutionFailed('cmd-1', 'worker-a', {
      errorMessage: 'validation failed',
      failureClass: 'Validation',
      retryable: false,
      execution: { workerId: 'worker-a' },
    });

    expect(row.status).toBe('DEAD');
    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: 'cmd-1' },
      data: expect.objectContaining({
        status: 'DEAD',
        attempts: 1,
        lastError: 'validation failed',
      }),
    });
  });
});
