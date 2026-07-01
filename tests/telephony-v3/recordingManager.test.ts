import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const recordingManager = require('../../lib/telephony-v3/Recording/recordingManager');
const sessionManager = require('../../lib/telephony-v3/Sessions/sessionManager');
const commandBus = require('../../lib/telephony-v3/Commands/commandBus');
const featureFlags = require('../../lib/telephony-v3/FeatureFlags/featureFlagService');
const eventBus = require('../../lib/telephony-v3/Events/domainEventBus');
const { DOMAIN_EVENTS } = require('../../lib/telephony-v3/Events/domainEvents');
const { metrics } = require('../../lib/telephony-v3/Utils/metrics');
const prisma = require('../../lib/telephony-v3/internal/prisma');

const mockUpdateMany = vi.fn();

describe('V3 recordingManager', () => {
  beforeEach(() => {
    recordingManager.resetRecordingManagerForTests();
    eventBus.resetForTests();
    metrics.resetMetricsForTests();
    vi.clearAllMocks();

    prisma.__setGetPrismaForTests(async () => ({
      v3CallSession: {
        findUnique: vi.fn().mockResolvedValue({ routeSnapshot: null }),
        updateMany: mockUpdateMany,
      },
      tenantSecuritySettings: {
        findUnique: vi.fn().mockResolvedValue({ recordingPolicy: 'ALWAYS' }),
      },
    }));
    mockUpdateMany.mockResolvedValue({ count: 1 });

    vi.spyOn(featureFlags, 'getTenantFlags').mockResolvedValue({
      recordingEnabled: true,
      observeOnly: false,
      engineEnabled: true,
    });
    vi.spyOn(commandBus, 'enqueueIntents').mockResolvedValue([]);
    vi.spyOn(sessionManager, 'loadSession').mockResolvedValue({
      id: 'sess-1',
      tenantId: 'tenant-1',
      state: 'ACTIVE',
      version: 1,
      direction: 'inbound',
      correlationId: 'corr-1',
      primaryCallControlId: 'cc-1',
      legs: [{ id: 'leg-1', callControlId: 'cc-1', state: 'BRIDGED', version: 1, role: 'ORIGIN' }],
    });
  });

  afterEach(() => {
    prisma.__resetGetPrismaForTests();
    vi.restoreAllMocks();
  });

  it('starts manual recording and enqueues START_RECORDING', async () => {
    const result = await recordingManager.startRecording({
      sessionId: 'sess-1',
      tenantId: 'tenant-1',
      requestId: 'req-1',
    });

    expect(result.ok).toBe(true);
    expect(commandBus.enqueueIntents).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ commandType: 'START_RECORDING' })]),
      expect.any(Object),
    );
    expect(eventBus.replay({ eventType: DOMAIN_EVENTS.RECORDING_COMPLETED }).length).toBeGreaterThan(0);
  });

  it('starts automatic recording', async () => {
    const result = await recordingManager.startAutomaticRecording({
      sessionId: 'sess-1',
      tenantId: 'tenant-1',
      requestId: 'auto-1',
    });
    expect(result.ok).toBe(true);
  });

  it('stops recording and enqueues STOP_RECORDING', async () => {
    await recordingManager.startRecording({
      sessionId: 'sess-1',
      tenantId: 'tenant-1',
      requestId: 'start-first',
    });

    vi.spyOn(sessionManager, 'loadSession').mockResolvedValue({
      id: 'sess-1',
      tenantId: 'tenant-1',
      state: 'ACTIVE',
      version: 2,
      correlationId: 'corr-1',
      primaryCallControlId: 'cc-1',
      legs: [{ id: 'leg-1', callControlId: 'cc-1', state: 'BRIDGED', version: 2 }],
    });

    const result = await recordingManager.stopRecording({
      sessionId: 'sess-1',
      tenantId: 'tenant-1',
      requestId: 'stop-1',
      recordingUrl: 'https://example.com/rec.mp3',
    });

    expect(result.ok).toBe(true);
    expect(eventBus.replay({ eventType: DOMAIN_EVENTS.RECORDING_STOPPED }).length).toBeGreaterThan(0);
  });

  it('skips duplicate recording requests', async () => {
    await recordingManager.startRecording({ sessionId: 'sess-1', tenantId: 'tenant-1', requestId: 'dup' });
    const second = await recordingManager.startRecording({ sessionId: 'sess-1', tenantId: 'tenant-1', requestId: 'dup' });
    expect(second.skipped).toBe(true);
  });

  it('skips when recording disabled', async () => {
    vi.spyOn(featureFlags, 'getTenantFlags').mockResolvedValue({ recordingEnabled: false, observeOnly: true });
    const result = await recordingManager.startRecording({ sessionId: 'sess-1', tenantId: 'tenant-1' });
    expect(result.skipped).toBe(true);
  });

  it('does not enqueue in observe mode', async () => {
    vi.spyOn(featureFlags, 'getTenantFlags').mockResolvedValue({
      recordingEnabled: true,
      observeOnly: true,
      engineEnabled: true,
    });
    await recordingManager.startRecording({ sessionId: 'sess-1', tenantId: 'tenant-1', requestId: 'obs' });
    expect(commandBus.enqueueIntents).not.toHaveBeenCalled();
  });

  it('blocks duplicate active recording', async () => {
    await recordingManager.startRecording({ sessionId: 'sess-1', tenantId: 'tenant-1', requestId: 'first' });
    const second = await recordingManager.startRecording({ sessionId: 'sess-1', tenantId: 'tenant-1', requestId: 'second' });
    expect(second.skipped).toBe(true);
    expect(second.reason).toBe('recording_in_progress');
  });
});
