import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const queueManager = require('../../lib/telephony-v3/Queue/queueManager');
const sessionManager = require('../../lib/telephony-v3/Sessions/sessionManager');
const commandBus = require('../../lib/telephony-v3/Commands/commandBus');
const featureFlags = require('../../lib/telephony-v3/FeatureFlags/featureFlagService');
const eventBus = require('../../lib/telephony-v3/Events/domainEventBus');
const { DOMAIN_EVENTS } = require('../../lib/telephony-v3/Events/domainEvents');
const { metrics } = require('../../lib/telephony-v3/Utils/metrics');
const { RING_STRATEGY } = require('../../lib/telephony-v3/Queue/queueConstants');
const prisma = require('../../lib/telephony-v3/internal/prisma');

const mockUpdateMany = vi.fn();
let routeSnapshotState: Record<string, unknown> | null = null;

describe('V3 queueManager', () => {
  beforeEach(() => {
    queueManager.resetQueueManagerForTests();
    eventBus.resetForTests();
    metrics.resetMetricsForTests();
    routeSnapshotState = null;
    vi.clearAllMocks();

    prisma.__setGetPrismaForTests(async () => ({
      v3CallSession: {
        findUnique: vi.fn().mockImplementation(async () => ({ routeSnapshot: routeSnapshotState })),
        updateMany: mockUpdateMany.mockImplementation(async (_args) => {
          if (_args?.data?.routeSnapshot) {
            routeSnapshotState = _args.data.routeSnapshot as Record<string, unknown>;
          }
          return { count: 1 };
        }),
      },
      tenant: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'tenant-1',
          timezone: 'America/New_York',
          greeting: { businessHoursEnabled: false },
        }),
      },
      ringGroupMember: { findMany: vi.fn().mockResolvedValue([]) },
    }));
    mockUpdateMany.mockResolvedValue({ count: 1 });

    vi.spyOn(featureFlags, 'getTenantFlags').mockResolvedValue({
      queueEnabled: true,
      observeOnly: false,
      engineEnabled: true,
    });
    vi.spyOn(commandBus, 'enqueueIntents').mockResolvedValue([]);
    vi.spyOn(sessionManager, 'loadSession').mockResolvedValue({
      id: 'sess-1',
      tenantId: 'tenant-1',
      state: 'ACTIVE',
      version: 1,
      correlationId: 'corr-1',
      primaryCallControlId: 'cc-caller',
      legs: [{ id: 'leg-1', callControlId: 'cc-caller', state: 'BRIDGED', version: 1 }],
    });
  });

  afterEach(() => {
    prisma.__resetGetPrismaForTests();
    vi.restoreAllMocks();
  });

  it('creates queue and publishes queue.created', async () => {
    const result = await queueManager.createQueue({
      sessionId: 'sess-1',
      tenantId: 'tenant-1',
      ringStrategy: RING_STRATEGY.ROUND_ROBIN,
      agents: [{ extensionId: 'e1', available: true, priority: 0 }],
      requestId: 'create-1',
    });

    expect(result.ok).toBe(true);
    expect(result.queueId).toBeDefined();
    expect(eventBus.replay({ eventType: DOMAIN_EVENTS.QUEUE_CREATED }).length).toBeGreaterThan(0);
  });

  it('joins queue from PSTN with ENQUEUE and agent assign', async () => {
    const result = await queueManager.joinQueueFromPstn({
      sessionId: 'sess-1',
      tenantId: 'tenant-1',
      callerCallControlId: 'cc-caller',
      ringStrategy: RING_STRATEGY.ROUND_ROBIN,
      agents: [{ extensionId: 'e1', sipUsername: 'agent1', available: true, priority: 0 }],
      requestId: 'join-pstn',
    });

    expect(result.ok).toBe(true);
    expect(commandBus.enqueueIntents).toHaveBeenCalled();
    expect(eventBus.replay({ eventType: DOMAIN_EVENTS.QUEUE_ENTERED }).length).toBeGreaterThan(0);
    expect(eventBus.replay({ eventType: DOMAIN_EVENTS.QUEUE_WAITING }).length).toBeGreaterThan(0);
  });

  it('leaves queue', async () => {
    await queueManager.joinQueue({
      sessionId: 'sess-1',
      tenantId: 'tenant-1',
      callerCallControlId: 'cc-caller',
      agents: [{ extensionId: 'e1', available: true }],
      requestId: 'join-leave',
    });

    vi.spyOn(sessionManager, 'loadSession').mockResolvedValue({
      id: 'sess-1',
      tenantId: 'tenant-1',
      state: 'ACTIVE',
      version: 2,
      correlationId: 'corr-1',
      primaryCallControlId: 'cc-caller',
      legs: [{ id: 'leg-1', callControlId: 'cc-caller', state: 'BRIDGED', version: 2 }],
    });

    const result = await queueManager.leaveQueue({
      sessionId: 'sess-1',
      tenantId: 'tenant-1',
      requestId: 'leave-1',
    });

    expect(result.ok).toBe(true);
    expect(eventBus.replay({ eventType: DOMAIN_EVENTS.QUEUE_COMPLETED }).length).toBeGreaterThan(0);
  });

  it('handles agent timeout with retry', async () => {
    prisma.__setGetPrismaForTests(async () => ({
      v3CallSession: {
        findUnique: vi.fn().mockResolvedValue({
          routeSnapshot: {
            queue: {
              queueId: 'queue-1',
              callerCallControlId: 'cc-caller',
              ringStrategy: RING_STRATEGY.ROUND_ROBIN,
              retryCount: 0,
              agents: [{ extensionId: 'e1', sipUsername: 'a1', available: true, priority: 0 }],
            },
          },
        }),
        updateMany: mockUpdateMany,
      },
      tenant: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'tenant-1',
          greeting: { businessHoursEnabled: false },
        }),
      },
    }));

    await queueManager.handleAgentTimeout({
      sessionId: 'sess-1',
      tenantId: 'tenant-1',
      requestId: 'timeout-1',
    });

    expect(eventBus.replay({ eventType: DOMAIN_EVENTS.QUEUE_TIMEOUT }).length).toBeGreaterThan(0);
    expect(eventBus.replay({ eventType: DOMAIN_EVENTS.QUEUE_RETRY }).length).toBeGreaterThan(0);
  });

  it('overflows after max retries', async () => {
    prisma.__setGetPrismaForTests(async () => ({
      v3CallSession: {
        findUnique: vi.fn().mockResolvedValue({
          routeSnapshot: {
            queue: {
              queueId: 'queue-1',
              callerCallControlId: 'cc-caller',
              retryCount: 3,
              overflowDestination: '+15551234567',
              agents: [{ extensionId: 'e1', available: true }],
            },
          },
        }),
        updateMany: mockUpdateMany,
      },
      tenant: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'tenant-1',
          greeting: { businessHoursEnabled: false },
        }),
      },
    }));

    await queueManager.handleAgentTimeout({
      sessionId: 'sess-1',
      tenantId: 'tenant-1',
      requestId: 'overflow-1',
    });

    expect(eventBus.replay({ eventType: DOMAIN_EVENTS.QUEUE_OVERFLOW }).length).toBeGreaterThan(0);
  });

  it('starts queue recording', async () => {
    prisma.__setGetPrismaForTests(async () => ({
      v3CallSession: {
        findUnique: vi.fn().mockResolvedValue({
          routeSnapshot: {
            queue: { queueId: 'queue-1', callerCallControlId: 'cc-caller' },
          },
        }),
        updateMany: mockUpdateMany,
      },
      tenant: { findUnique: vi.fn().mockResolvedValue({ id: 'tenant-1', greeting: {} }) },
    }));

    const result = await queueManager.startQueueRecording({
      sessionId: 'sess-1',
      tenantId: 'tenant-1',
      requestId: 'rec-1',
    });

    expect(result.ok).toBe(true);
    expect(commandBus.enqueueIntents).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ commandType: 'START_RECORDING' })]),
      expect.any(Object),
    );
  });

  it('skips duplicate join requests', async () => {
    await queueManager.joinQueue({
      sessionId: 'sess-1',
      tenantId: 'tenant-1',
      agents: [{ extensionId: 'e1', available: true }],
      requestId: 'dup',
    });
    const second = await queueManager.joinQueue({
      sessionId: 'sess-1',
      tenantId: 'tenant-1',
      requestId: 'dup',
    });
    expect(second.skipped).toBe(true);
  });

  it('skips when queue disabled', async () => {
    vi.spyOn(featureFlags, 'getTenantFlags').mockResolvedValue({ queueEnabled: false, observeOnly: true });
    const result = await queueManager.createQueue({ sessionId: 'sess-1', tenantId: 'tenant-1' });
    expect(result.skipped).toBe(true);
  });

  it('does not enqueue in observe mode', async () => {
    vi.spyOn(featureFlags, 'getTenantFlags').mockResolvedValue({
      queueEnabled: true,
      observeOnly: true,
      engineEnabled: true,
    });
    await queueManager.joinQueue({
      sessionId: 'sess-1',
      tenantId: 'tenant-1',
      agents: [{ extensionId: 'e1', available: true }],
      requestId: 'obs',
    });
    expect(commandBus.enqueueIntents).not.toHaveBeenCalled();
  });
});
