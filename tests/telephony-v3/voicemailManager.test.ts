import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const voicemailManager = require('../../lib/telephony-v3/Voicemail/voicemailManager');
const sessionManager = require('../../lib/telephony-v3/Sessions/sessionManager');
const commandBus = require('../../lib/telephony-v3/Commands/commandBus');
const featureFlags = require('../../lib/telephony-v3/FeatureFlags/featureFlagService');
const eventBus = require('../../lib/telephony-v3/Events/domainEventBus');
const { DOMAIN_EVENTS } = require('../../lib/telephony-v3/Events/domainEvents');
const { metrics } = require('../../lib/telephony-v3/Utils/metrics');
const prisma = require('../../lib/telephony-v3/internal/prisma');

const mockUpdateMany = vi.fn();

describe('V3 voicemailManager', () => {
  beforeEach(() => {
    voicemailManager.resetVoicemailManagerForTests();
    eventBus.resetForTests();
    metrics.resetMetricsForTests();
    vi.clearAllMocks();

    prisma.__setGetPrismaForTests(async () => ({
      v3CallSession: {
        findUnique: vi.fn().mockResolvedValue({ routeSnapshot: null }),
        updateMany: mockUpdateMany,
      },
      tenant: { findUnique: vi.fn().mockResolvedValue({ id: 'tenant-1' }) },
      extensionVoicemailSettings: { findUnique: vi.fn().mockResolvedValue(null) },
      greeting: { findUnique: vi.fn().mockResolvedValue({ greetingAudioUrl: 'https://example.com/greeting.mp3' }) },
    }));
    mockUpdateMany.mockResolvedValue({ count: 1 });

    vi.spyOn(featureFlags, 'getTenantFlags').mockResolvedValue({
      voicemailEnabled: true,
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
      legs: [{ id: 'leg-1', callControlId: 'cc-1', state: 'BRIDGED', version: 1 }],
    });
  });

  afterEach(() => {
    prisma.__resetGetPrismaForTests();
    vi.restoreAllMocks();
  });

  it('starts no-answer voicemail with greeting and record commands', async () => {
    const result = await voicemailManager.startNoAnswerVoicemail({
      sessionId: 'sess-1',
      tenantId: 'tenant-1',
      requestId: 'vm-1',
    });

    expect(result.ok).toBe(true);
    expect(commandBus.enqueueIntents).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ commandType: 'PLAY_GREETING' }),
        expect.objectContaining({ commandType: 'START_VOICEMAIL' }),
      ]),
      expect.any(Object),
    );
    expect(eventBus.replay({ eventType: DOMAIN_EVENTS.VOICEMAIL_STARTED }).length).toBeGreaterThan(0);
  });

  it('starts busy voicemail', async () => {
    const result = await voicemailManager.startBusyVoicemail({
      sessionId: 'sess-1',
      tenantId: 'tenant-1',
      requestId: 'busy-1',
    });
    expect(result.ok).toBe(true);
  });

  it('starts DND voicemail', async () => {
    const result = await voicemailManager.startDndVoicemail({
      sessionId: 'sess-1',
      tenantId: 'tenant-1',
      extensionId: 'ext-1',
      requestId: 'dnd-1',
    });
    expect(result.ok).toBe(true);
  });

  it('saves voicemail metadata', async () => {
    await voicemailManager.startNoAnswerVoicemail({
      sessionId: 'sess-1',
      tenantId: 'tenant-1',
      requestId: 'save-setup',
    });

    const result = await voicemailManager.saveVoicemail({
      sessionId: 'sess-1',
      tenantId: 'tenant-1',
      recordingUrl: 'https://example.com/vm.mp3',
      durationSeconds: 45,
      requestId: 'save-1',
    });

    expect(result.ok).toBe(true);
    expect(eventBus.replay({ eventType: DOMAIN_EVENTS.VOICEMAIL_SAVED }).length).toBeGreaterThan(0);
  });

  it('skips duplicate voicemail requests', async () => {
    await voicemailManager.startVoicemail({ sessionId: 'sess-1', tenantId: 'tenant-1', reason: 'POLICY', requestId: 'dup' });
    const second = await voicemailManager.startVoicemail({ sessionId: 'sess-1', tenantId: 'tenant-1', reason: 'POLICY', requestId: 'dup' });
    expect(second.skipped).toBe(true);
  });

  it('skips when voicemail disabled', async () => {
    vi.spyOn(featureFlags, 'getTenantFlags').mockResolvedValue({ voicemailEnabled: false, observeOnly: true });
    const result = await voicemailManager.startVoicemail({ sessionId: 'sess-1', tenantId: 'tenant-1', reason: 'POLICY' });
    expect(result.skipped).toBe(true);
  });

  it('does not enqueue in observe mode', async () => {
    vi.spyOn(featureFlags, 'getTenantFlags').mockResolvedValue({
      voicemailEnabled: true,
      observeOnly: true,
      engineEnabled: true,
    });
    await voicemailManager.startNoAnswerVoicemail({ sessionId: 'sess-1', tenantId: 'tenant-1', requestId: 'obs' });
    expect(commandBus.enqueueIntents).not.toHaveBeenCalled();
  });

  it('blocks concurrent voicemail attempts', async () => {
    await voicemailManager.startNoAnswerVoicemail({ sessionId: 'sess-1', tenantId: 'tenant-1', requestId: 'first' });
    const second = await voicemailManager.startBusyVoicemail({ sessionId: 'sess-1', tenantId: 'tenant-1', requestId: 'second' });
    expect(second.skipped).toBe(true);
    expect(second.reason).toBe('voicemail_in_progress');
  });
});
