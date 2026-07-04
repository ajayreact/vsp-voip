import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const conferenceManager = require('../../lib/telephony-v3/Conference/conferenceManager');
const sessionManager = require('../../lib/telephony-v3/Sessions/sessionManager');
const commandBus = require('../../lib/telephony-v3/Commands/commandBus');
const featureFlags = require('../../lib/telephony-v3/FeatureFlags/featureFlagService');
const eventBus = require('../../lib/telephony-v3/Events/domainEventBus');
const { DOMAIN_EVENTS } = require('../../lib/telephony-v3/Events/domainEvents');
const { metrics } = require('../../lib/telephony-v3/Utils/metrics');
const prisma = require('../../lib/telephony-v3/internal/prisma');

const mockUpdateMany = vi.fn();

describe('V3 conferenceManager', () => {
  beforeEach(() => {
    conferenceManager.resetConferenceManagerForTests();
    eventBus.resetForTests();
    metrics.resetMetricsForTests();
    vi.clearAllMocks();

    prisma.__setGetPrismaForTests(async () => ({
      v3CallSession: {
        findUnique: vi.fn().mockResolvedValue({ routeSnapshot: null }),
        updateMany: mockUpdateMany,
      },
      tenant: { findUnique: vi.fn().mockResolvedValue({ id: 'tenant-1' }) },
    }));
    mockUpdateMany.mockResolvedValue({ count: 1 });

    vi.spyOn(featureFlags, 'getTenantFlags').mockResolvedValue({
      conferenceEnabled: true,
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
      primaryCallControlId: 'cc-host',
      legs: [
        { id: 'leg-host', callControlId: 'cc-host', state: 'BRIDGED', version: 1, role: 'ORIGIN' },
        { id: 'leg-p2', callControlId: 'cc-p2', state: 'BRIDGED', version: 1, role: 'PARTICIPANT' },
      ],
    });
  });

  afterEach(() => {
    prisma.__resetGetPrismaForTests();
    vi.restoreAllMocks();
  });

  it('creates conference and enqueues CREATE_CONFERENCE', async () => {
    const result = await conferenceManager.createConference({
      sessionId: 'sess-1',
      tenantId: 'tenant-1',
      hostCallControlId: 'cc-host',
      requestId: 'create-1',
    });

    expect(result.ok).toBe(true);
    expect(result.conferenceId).toBeDefined();
    expect(commandBus.enqueueIntents).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ commandType: 'CREATE_CONFERENCE' })]),
      expect.any(Object),
    );
    expect(eventBus.replay({ eventType: DOMAIN_EVENTS.CONFERENCE_STARTED }).length).toBeGreaterThan(0);
  });

  it('joins participant', async () => {
    await conferenceManager.createConference({
      sessionId: 'sess-1',
      tenantId: 'tenant-1',
      hostCallControlId: 'cc-host',
      requestId: 'create-for-join',
    });

    vi.spyOn(sessionManager, 'loadSession').mockResolvedValue({
      id: 'sess-1',
      tenantId: 'tenant-1',
      state: 'ACTIVE',
      version: 2,
      correlationId: 'corr-1',
      primaryCallControlId: 'cc-host',
      legs: [
        { id: 'leg-host', callControlId: 'cc-host', state: 'BRIDGED', version: 2 },
        { id: 'leg-p2', callControlId: 'cc-p2', state: 'BRIDGED', version: 2 },
      ],
    });

    prisma.__setGetPrismaForTests(async () => ({
      v3CallSession: {
        findUnique: vi.fn().mockResolvedValue({
          routeSnapshot: {
            conference: {
              conferenceId: 'conf-1',
              conferenceName: 'conf-1',
              hostCallControlId: 'cc-host',
              participants: [{ callControlId: 'cc-host', role: 'HOST' }],
            },
          },
        }),
        updateMany: mockUpdateMany,
      },
      tenant: { findUnique: vi.fn().mockResolvedValue({ id: 'tenant-1' }) },
    }));

    const result = await conferenceManager.joinParticipant({
      sessionId: 'sess-1',
      tenantId: 'tenant-1',
      callControlId: 'cc-p2',
      requestId: 'join-1',
    });

    expect(result.ok).toBe(true);
    expect(eventBus.replay({ eventType: DOMAIN_EVENTS.CONFERENCE_PARTICIPANT_JOINED }).length).toBeGreaterThan(0);
  });

  it('leaves participant', async () => {
    prisma.__setGetPrismaForTests(async () => ({
      v3CallSession: {
        findUnique: vi.fn().mockResolvedValue({
          routeSnapshot: {
            conference: {
              conferenceId: 'conf-1',
              hostCallControlId: 'cc-host',
              participants: [
                { callControlId: 'cc-host', role: 'HOST' },
                { callControlId: 'cc-p2', role: 'PARTICIPANT' },
              ],
            },
          },
        }),
        updateMany: mockUpdateMany,
      },
      tenant: { findUnique: vi.fn().mockResolvedValue({ id: 'tenant-1' }) },
    }));

    const result = await conferenceManager.leaveParticipant({
      sessionId: 'sess-1',
      tenantId: 'tenant-1',
      callControlId: 'cc-p2',
      requestId: 'leave-1',
    });

    expect(result.ok).toBe(true);
    expect(eventBus.replay({ eventType: DOMAIN_EVENTS.CONFERENCE_PARTICIPANT_LEFT }).length).toBeGreaterThan(0);
  });

  it('mutes and unmutes participant', async () => {
    prisma.__setGetPrismaForTests(async () => ({
      v3CallSession: {
        findUnique: vi.fn().mockResolvedValue({
          routeSnapshot: {
            conference: {
              conferenceId: 'conf-1',
              hostCallControlId: 'cc-host',
              participants: [{ callControlId: 'cc-p2', role: 'PARTICIPANT' }],
            },
          },
        }),
        updateMany: mockUpdateMany,
      },
      tenant: { findUnique: vi.fn().mockResolvedValue({ id: 'tenant-1' }) },
    }));

    await conferenceManager.muteParticipant({
      sessionId: 'sess-1',
      tenantId: 'tenant-1',
      callControlId: 'cc-p2',
      requestId: 'mute-1',
    });
    expect(eventBus.replay({ eventType: DOMAIN_EVENTS.CONFERENCE_PARTICIPANT_MUTED }).length).toBeGreaterThan(0);

    await conferenceManager.unmuteParticipant({
      sessionId: 'sess-1',
      tenantId: 'tenant-1',
      callControlId: 'cc-p2',
      requestId: 'unmute-1',
    });
    expect(eventBus.replay({ eventType: DOMAIN_EVENTS.CONFERENCE_PARTICIPANT_UNMUTED }).length).toBeGreaterThan(0);
  });

  it('starts and stops conference recording', async () => {
    prisma.__setGetPrismaForTests(async () => ({
      v3CallSession: {
        findUnique: vi.fn().mockResolvedValue({
          routeSnapshot: {
            conference: {
              conferenceId: 'conf-1',
              hostCallControlId: 'cc-host',
              participants: [{ callControlId: 'cc-host', role: 'HOST' }],
            },
          },
        }),
        updateMany: mockUpdateMany,
      },
      tenant: { findUnique: vi.fn().mockResolvedValue({ id: 'tenant-1' }) },
    }));

    await conferenceManager.startConferenceRecording({
      sessionId: 'sess-1',
      tenantId: 'tenant-1',
      requestId: 'rec-start',
    });
    expect(eventBus.replay({ eventType: DOMAIN_EVENTS.CONFERENCE_RECORDING_STARTED }).length).toBeGreaterThan(0);

    await conferenceManager.stopConferenceRecording({
      sessionId: 'sess-1',
      tenantId: 'tenant-1',
      requestId: 'rec-stop',
    });
    expect(eventBus.replay({ eventType: DOMAIN_EVENTS.CONFERENCE_RECORDING_STOPPED }).length).toBeGreaterThan(0);
  });

  it('destroys conference on host leave', async () => {
    prisma.__setGetPrismaForTests(async () => ({
      v3CallSession: {
        findUnique: vi.fn().mockResolvedValue({
          routeSnapshot: {
            conference: {
              conferenceId: 'conf-1',
              conferenceName: 'conf-1',
              hostCallControlId: 'cc-host',
              participants: [{ callControlId: 'cc-host', role: 'HOST' }],
            },
          },
        }),
        updateMany: mockUpdateMany,
      },
      tenant: { findUnique: vi.fn().mockResolvedValue({ id: 'tenant-1' }) },
    }));

    await conferenceManager.hostLeave({
      sessionId: 'sess-1',
      tenantId: 'tenant-1',
      hostCallControlId: 'cc-host',
      requestId: 'host-leave',
    });

    expect(eventBus.replay({ eventType: DOMAIN_EVENTS.CONFERENCE_PARTICIPANT_LEFT }).length).toBeGreaterThan(0);
    expect(eventBus.replay({ eventType: DOMAIN_EVENTS.CONFERENCE_COMPLETED }).length).toBeGreaterThan(0);
  });

  it('skips duplicate create requests', async () => {
    await conferenceManager.createConference({ sessionId: 'sess-1', tenantId: 'tenant-1', requestId: 'dup' });
    const second = await conferenceManager.createConference({ sessionId: 'sess-1', tenantId: 'tenant-1', requestId: 'dup' });
    expect(second.skipped).toBe(true);
  });

  it('skips when conference disabled', async () => {
    vi.spyOn(featureFlags, 'getTenantFlags').mockResolvedValue({ conferenceEnabled: false, observeOnly: true });
    const result = await conferenceManager.createConference({ sessionId: 'sess-1', tenantId: 'tenant-1' });
    expect(result.skipped).toBe(true);
  });

  it('does not enqueue in observe mode', async () => {
    vi.spyOn(featureFlags, 'getTenantFlags').mockResolvedValue({
      conferenceEnabled: true,
      observeOnly: true,
      engineEnabled: true,
    });
    await conferenceManager.createConference({ sessionId: 'sess-1', tenantId: 'tenant-1', requestId: 'obs' });
    expect(commandBus.enqueueIntents).not.toHaveBeenCalled();
  });
});
