import { describe, expect, it, vi } from 'vitest';

vi.mock('../../lib/telephony-v3/Redis/streams', () => ({
  claimStaleMessages: vi.fn(async () => []),
  readIngressBatch: vi.fn(async () => []),
  ackIngressJob: vi.fn(async () => {}),
  getMessageDeliveryCount: vi.fn(async () => 1),
  moveToDlq: vi.fn(async () => {}),
}));

vi.mock('../../lib/telephony-v3/Redis/heartbeat', () => ({
  recordWorkerHeartbeat: vi.fn(async () => {}),
}));

vi.mock('../../lib/telephony-v3/Maintenance/retention', () => ({
  purgeProcessedTelnyxEvents: vi.fn(async () => ({ deleted: 0 })),
}));

const ingressWorker = require('../../lib/telephony-v3/Workers/ingressWorker');

describe('V3 Worker shutdown', () => {
  it('tracks in-flight ingress jobs', () => {
    expect(typeof ingressWorker.getInFlightIngressCount).toBe('function');
    expect(ingressWorker.getInFlightIngressCount()).toBe(0);
  });

  it('skips overlapping outbox ticks', async () => {
    const prisma = require('../../lib/telephony-v3/internal/prisma');
    let resolveClaim;
    const claimPromise = new Promise((resolve) => {
      resolveClaim = resolve;
    });

    prisma.__setGetPrismaForTests(async () => ({
      $queryRaw: () => claimPromise,
      $transaction: async (fn) => fn({ $queryRaw: () => claimPromise }),
      v3CommandOutbox: {
        updateMany: vi.fn(async () => ({ count: 1 })),
        findUnique: vi.fn(async () => ({ id: 'cmd-1', commandType: 'DIAL' })),
      },
    }));

    const first = ingressWorker.runOutboxWorkerTick('worker-a');
    const second = await ingressWorker.runOutboxWorkerTick('worker-a');
    expect(second.skipped).toBe(true);

    resolveClaim([]);
    await first;

    prisma.__resetGetPrismaForTests();
  });
});
