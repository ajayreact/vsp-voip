import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const holdManager = require('../../lib/telephony-v3/HoldTransfer/holdManager');
const sessionManager = require('../../lib/telephony-v3/Sessions/sessionManager');
const legManager = require('../../lib/telephony-v3/Sessions/legManager');
const commandBus = require('../../lib/telephony-v3/Commands/commandBus');
const featureFlags = require('../../lib/telephony-v3/FeatureFlags/featureFlagService');
const eventBus = require('../../lib/telephony-v3/Events/domainEventBus');
const { DOMAIN_EVENTS } = require('../../lib/telephony-v3/Events/domainEvents');
const { metrics } = require('../../lib/telephony-v3/Utils/metrics');
const prisma = require('../../lib/telephony-v3/internal/prisma');

const mockUpdateMany = vi.fn();

describe('V3 holdManager', () => {
  beforeEach(() => {
    holdManager.resetHoldManagerForTests();
    eventBus.resetForTests();
    metrics.resetMetricsForTests();
    vi.clearAllMocks();

    prisma.__setGetPrismaForTests(async () => ({
      v3CallSession: {
        findUnique: vi.fn().mockResolvedValue({ routeSnapshot: null }),
        updateMany: mockUpdateMany,
      },
    }));
    mockUpdateMany.mockResolvedValue({ count: 1 });

    vi.spyOn(featureFlags, 'getTenantFlags').mockResolvedValue({
      holdEnabled: true,
      transferEnabled: true,
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
      primaryCallControlId: 'cc-1',
      legs: [{ id: 'leg-1', callControlId: 'cc-1', state: 'BRIDGED', version: 1, role: 'ORIGIN' }],
    });
    vi.spyOn(sessionManager, 'persistSessionTransition').mockResolvedValue({
      id: 'sess-1',
      tenantId: 'tenant-1',
      state: 'HELD',
      version: 2,
      correlationId: 'corr-1',
      legs: [],
    });
    vi.spyOn(legManager, 'persistLegTransition').mockResolvedValue({
      id: 'leg-1',
      state: 'HELD',
      version: 2,
    });
  });

  afterEach(() => {
    prisma.__resetGetPrismaForTests();
    vi.restoreAllMocks();
  });

  it('starts hold and enqueues HOLD command', async () => {
    const result = await holdManager.startHold({
      sessionId: 'sess-1',
      tenantId: 'tenant-1',
      legId: 'leg-1',
      requestId: 'req-1',
    });

    expect(result.ok).toBe(true);
    expect(commandBus.enqueueIntents).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ commandType: 'HOLD' })]),
      expect.any(Object),
    );
    expect(eventBus.replay({ eventType: DOMAIN_EVENTS.HOLD_COMPLETED }).length).toBeGreaterThan(0);
  });

  it('resumes hold from HELD state', async () => {
    vi.spyOn(sessionManager, 'loadSession').mockResolvedValue({
      id: 'sess-1',
      tenantId: 'tenant-1',
      state: 'HELD',
      version: 2,
      correlationId: 'corr-1',
      primaryCallControlId: 'cc-1',
      legs: [{ id: 'leg-1', callControlId: 'cc-1', state: 'HELD', version: 2 }],
    });
    vi.spyOn(sessionManager, 'persistSessionTransition').mockResolvedValue({
      id: 'sess-1',
      state: 'ACTIVE',
      version: 3,
      tenantId: 'tenant-1',
      correlationId: 'corr-1',
      legs: [],
    });

    const result = await holdManager.resumeHold({
      sessionId: 'sess-1',
      tenantId: 'tenant-1',
      requestId: 'req-resume',
    });

    expect(result.ok).toBe(true);
    expect(eventBus.replay({ eventType: DOMAIN_EVENTS.HOLD_RESUMED }).length).toBeGreaterThan(0);
  });

  it('skips duplicate hold requests', async () => {
    await holdManager.startHold({ sessionId: 'sess-1', tenantId: 'tenant-1', requestId: 'dup' });
    const second = await holdManager.startHold({ sessionId: 'sess-1', tenantId: 'tenant-1', requestId: 'dup' });
    expect(second.skipped).toBe(true);
  });

  it('skips when hold disabled', async () => {
    vi.spyOn(featureFlags, 'getTenantFlags').mockResolvedValue({ holdEnabled: false, observeOnly: true });
    const result = await holdManager.startHold({ sessionId: 'sess-1', tenantId: 'tenant-1' });
    expect(result.skipped).toBe(true);
  });

  it('does not enqueue in observe mode', async () => {
    vi.spyOn(featureFlags, 'getTenantFlags').mockResolvedValue({
      holdEnabled: true,
      observeOnly: true,
      engineEnabled: true,
    });
    await holdManager.startHold({ sessionId: 'sess-1', tenantId: 'tenant-1', requestId: 'obs' });
    expect(commandBus.enqueueIntents).not.toHaveBeenCalled();
  });
});
