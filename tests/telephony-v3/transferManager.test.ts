import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const transferManager = require('../../lib/telephony-v3/HoldTransfer/transferManager');
const transferPolicy = require('../../lib/telephony-v3/HoldTransfer/transferPolicy');
const sessionManager = require('../../lib/telephony-v3/Sessions/sessionManager');
const commandBus = require('../../lib/telephony-v3/Commands/commandBus');
const featureFlags = require('../../lib/telephony-v3/FeatureFlags/featureFlagService');
const eventBus = require('../../lib/telephony-v3/Events/domainEventBus');
const { DOMAIN_EVENTS } = require('../../lib/telephony-v3/Events/domainEvents');
const { metrics } = require('../../lib/telephony-v3/Utils/metrics');
const prisma = require('../../lib/telephony-v3/internal/prisma');

describe('V3 transferManager', () => {
  beforeEach(() => {
    transferManager.resetTransferManagerForTests();
    transferPolicy.resetTransferPolicyForTests();
    eventBus.resetForTests();
    metrics.resetMetricsForTests();
    vi.clearAllMocks();

    prisma.__setGetPrismaForTests(async () => ({
      v3CallSession: {
        findUnique: vi.fn().mockResolvedValue({ routeSnapshot: null }),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      tenant: { findUnique: vi.fn().mockResolvedValue({ id: 'tenant-1' }) },
    }));

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
      legs: [{ id: 'leg-1', callControlId: 'cc-1', state: 'BRIDGED', version: 1, connectionId: 'conn-1' }],
    });
    vi.spyOn(sessionManager, 'persistSessionTransition').mockImplementation(async (_id, _v, patch) => ({
      id: 'sess-1',
      tenantId: 'tenant-1',
      state: patch.state || 'TRANSFER_PENDING',
      version: 2,
      correlationId: 'corr-1',
      legs: [],
    }));
  });

  afterEach(() => {
    prisma.__resetGetPrismaForTests();
    vi.restoreAllMocks();
  });

  it('executes blind transfer', async () => {
    const result = await transferManager.blindTransfer({
      sessionId: 'sess-1',
      tenantId: 'tenant-1',
      target: '+15551234567',
      requestId: 'blind-1',
    });

    expect(result.ok).toBe(true);
    expect(commandBus.enqueueIntents).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ commandType: 'TRANSFER' })]),
      expect.any(Object),
    );
    expect(eventBus.replay({ eventType: DOMAIN_EVENTS.TRANSFER_COMPLETED }).length).toBeGreaterThan(0);
  });

  it('starts attended transfer with HOLD and DIAL', async () => {
    const result = await transferManager.startAttendedTransfer({
      sessionId: 'sess-1',
      tenantId: 'tenant-1',
      target: 'sip:consult@sip.telnyx.com',
      requestId: 'att-1',
    });

    expect(result.ok).toBe(true);
    const cmds = vi.mocked(commandBus.enqueueIntents).mock.calls[0][0] as Array<{ commandType: string }>;
    expect(cmds.map((c) => c.commandType)).toEqual(['HOLD', 'DIAL']);
    expect(eventBus.replay({ eventType: DOMAIN_EVENTS.TRANSFER_RINGING }).length).toBeGreaterThan(0);
  });

  it('cancels attended transfer', async () => {
    await transferManager.startAttendedTransfer({
      sessionId: 'sess-1',
      tenantId: 'tenant-1',
      target: 'sip:consult@sip.telnyx.com',
      requestId: 'att-cancel',
    });

    vi.spyOn(sessionManager, 'loadSession').mockResolvedValue({
      id: 'sess-1',
      tenantId: 'tenant-1',
      state: 'TRANSFER_PENDING',
      version: 2,
      correlationId: 'corr-1',
      primaryCallControlId: 'cc-1',
      legs: [{ id: 'leg-1', callControlId: 'cc-1', state: 'BRIDGED', version: 2 }],
    });

    const result = await transferManager.cancelTransfer({
      sessionId: 'sess-1',
      tenantId: 'tenant-1',
      consultCallControlId: 'cc-consult',
      requestId: 'cancel-1',
    });

    expect(result.ok).toBe(true);
    expect(eventBus.replay({ eventType: DOMAIN_EVENTS.TRANSFER_CANCELLED }).length).toBeGreaterThan(0);
  });

  it('blocks concurrent transfer attempts', async () => {
    await transferManager.blindTransfer({
      sessionId: 'sess-1',
      tenantId: 'tenant-1',
      target: '+15551234567',
      requestId: 't1',
    });
    const second = await transferManager.blindTransfer({
      sessionId: 'sess-1',
      tenantId: 'tenant-1',
      target: '+15559998888',
      requestId: 't2',
    });
    expect(second.skipped).toBe(true);
    expect(second.reason).toBe('transfer_in_progress');
  });

  it('skips when transfer disabled', async () => {
    vi.spyOn(featureFlags, 'getTenantFlags').mockResolvedValue({ transferEnabled: false, observeOnly: true });
    const result = await transferManager.blindTransfer({
      sessionId: 'sess-1',
      tenantId: 'tenant-1',
      target: '+15551234567',
    });
    expect(result.skipped).toBe(true);
  });

  it('fails transfer and publishes failed event', async () => {
    await transferManager.startAttendedTransfer({
      sessionId: 'sess-1',
      tenantId: 'tenant-1',
      target: 'sip:consult@sip.telnyx.com',
      requestId: 'fail-setup',
    });

    vi.spyOn(sessionManager, 'loadSession').mockResolvedValue({
      id: 'sess-1',
      tenantId: 'tenant-1',
      state: 'TRANSFER_PENDING',
      version: 2,
      correlationId: 'corr-1',
      primaryCallControlId: 'cc-1',
      legs: [{ id: 'leg-1', callControlId: 'cc-1', state: 'BRIDGED', version: 2 }],
    });

    const result = await transferManager.failTransfer({
      sessionId: 'sess-1',
      tenantId: 'tenant-1',
      consultCallControlId: 'cc-consult',
      reason: 'no_answer',
      requestId: 'fail-1',
    });

    expect(result.ok).toBe(true);
    expect(eventBus.replay({ eventType: DOMAIN_EVENTS.TRANSFER_FAILED }).length).toBeGreaterThan(0);
  });
});
