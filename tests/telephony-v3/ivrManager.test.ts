import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const ivrManager = require('../../lib/telephony-v3/IVR/ivrManager');
const sessionManager = require('../../lib/telephony-v3/Sessions/sessionManager');
const commandBus = require('../../lib/telephony-v3/Commands/commandBus');
const featureFlags = require('../../lib/telephony-v3/FeatureFlags/featureFlagService');
const eventBus = require('../../lib/telephony-v3/Events/domainEventBus');
const { DOMAIN_EVENTS } = require('../../lib/telephony-v3/Events/domainEvents');
const { DESTINATION_TYPE } = require('../../lib/telephony-v3/IVR/ivrConstants');
const prisma = require('../../lib/telephony-v3/internal/prisma');

const mockUpdateMany = vi.fn();
let routeSnapshotState: Record<string, unknown> | null = null;

const menuTree = {
  root: {
    greeting: { text: 'Welcome' },
    invalidPrompt: { text: 'Invalid option' },
    timeoutPrompt: { text: 'Timeout' },
    digits: {
      '1': { destination: DESTINATION_TYPE.EXTENSION, extensionId: 'ext-1' },
      '2': { destination: DESTINATION_TYPE.QUEUE, queueId: 'q-1' },
      '3': { destination: DESTINATION_TYPE.RING_GROUP, ringGroupId: 'rg-1' },
      '4': { destination: DESTINATION_TYPE.VOICEMAIL, extensionId: 'ext-vm' },
      '5': { destination: DESTINATION_TYPE.OPERATOR, extensionId: 'ext-op' },
      '6': { destination: DESTINATION_TYPE.SUBMENU, menuId: 'sales' },
      '*': { destination: DESTINATION_TYPE.REPEAT },
    },
  },
  sales: {
    greeting: { text: 'Sales menu' },
    digits: {
      '1': { destination: DESTINATION_TYPE.EXTENSION, extensionId: 'ext-sales' },
    },
  },
};

function setupPrisma() {
  prisma.__setGetPrismaForTests(async () => ({
    v3CallSession: {
      findUnique: vi.fn().mockImplementation(async () => ({ routeSnapshot: routeSnapshotState })),
      updateMany: mockUpdateMany.mockImplementation(async (args) => {
        if (args?.data?.routeSnapshot) {
          routeSnapshotState = args.data.routeSnapshot as Record<string, unknown>;
        }
        return { count: 1 };
      }),
    },
    tenant: {
      findUnique: vi.fn().mockResolvedValue({
        id: 'tenant-1',
        timezone: 'America/New_York',
        greeting: { businessHoursEnabled: false, ivrOptions: { menus: menuTree } },
      }),
    },
    extension: {
      findFirst: vi.fn().mockImplementation(async ({ where }) => ({
        id: where.id,
        telnyxSipUsername: `user-${where.id}`,
        displayName: 'Agent',
      })),
    },
    ringGroupMember: {
      findMany: vi.fn().mockResolvedValue([
        { extension: { telnyxSipUsername: 'rg-agent' } },
      ]),
    },
  }));
}

describe('V3 ivrManager', () => {
  beforeEach(() => {
    ivrManager.resetIvrManagerForTests();
    eventBus.resetForTests();
    routeSnapshotState = null;
    vi.clearAllMocks();
    setupPrisma();
    mockUpdateMany.mockResolvedValue({ count: 1 });

    vi.spyOn(featureFlags, 'getTenantFlags').mockResolvedValue({
      ivrEnabled: true,
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
      legs: [{ id: 'leg-1', callControlId: 'cc-caller', state: 'ACTIVE', version: 1 }],
    });
  });

  afterEach(() => {
    prisma.__resetGetPrismaForTests();
    vi.restoreAllMocks();
  });

  it('starts IVR and publishes ivr.started', async () => {
    const result = await ivrManager.startIvr({
      sessionId: 'sess-1',
      tenantId: 'tenant-1',
      callControlId: 'cc-caller',
      menuTree,
      requestId: 'start-1',
    });

    expect(result.ok).toBe(true);
    expect(commandBus.enqueueIntents).toHaveBeenCalled();
    expect(eventBus.replay({ eventType: DOMAIN_EVENTS.IVR_STARTED }).length).toBeGreaterThan(0);
    expect(eventBus.replay({ eventType: DOMAIN_EVENTS.IVR_GREETING }).length).toBeGreaterThan(0);
    expect(ivrManager.isIvrActive('sess-1')).toBe(true);
  });

  it('routes extension destination', async () => {
    await ivrManager.startIvr({
      sessionId: 'sess-1',
      tenantId: 'tenant-1',
      menuTree,
      requestId: 'start-ext',
    });

    vi.spyOn(sessionManager, 'loadSession').mockResolvedValue({
      id: 'sess-1',
      tenantId: 'tenant-1',
      version: 2,
      correlationId: 'corr-1',
      primaryCallControlId: 'cc-caller',
      legs: [{ id: 'leg-1', callControlId: 'cc-caller', version: 2 }],
    });

    const result = await ivrManager.handleInput({
      sessionId: 'sess-1',
      tenantId: 'tenant-1',
      digits: '1',
      requestId: 'input-ext',
    });

    expect(result.ok).toBe(true);
    expect(eventBus.replay({ eventType: DOMAIN_EVENTS.IVR_ROUTE_SELECTED }).length).toBeGreaterThan(0);
    expect(eventBus.replay({ eventType: DOMAIN_EVENTS.IVR_COMPLETED }).length).toBeGreaterThan(0);
  });

  it('routes queue destination with ENQUEUE command', async () => {
    await ivrManager.startIvr({
      sessionId: 'sess-1',
      tenantId: 'tenant-1',
      menuTree,
      requestId: 'start-queue',
    });

    await ivrManager.handleInput({
      sessionId: 'sess-1',
      tenantId: 'tenant-1',
      digits: '2',
      requestId: 'input-queue',
    });

    expect(commandBus.enqueueIntents).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ commandType: 'ENQUEUE' })]),
      expect.any(Object),
    );
  });

  it('routes ring group destination with DIAL commands', async () => {
    await ivrManager.startIvr({
      sessionId: 'sess-1',
      tenantId: 'tenant-1',
      menuTree,
      requestId: 'start-rg',
    });

    await ivrManager.handleInput({
      sessionId: 'sess-1',
      tenantId: 'tenant-1',
      digits: '3',
      requestId: 'input-rg',
    });

    expect(commandBus.enqueueIntents).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ commandType: 'DIAL' })]),
      expect.any(Object),
    );
  });

  it('routes voicemail destination', async () => {
    await ivrManager.startIvr({
      sessionId: 'sess-1',
      tenantId: 'tenant-1',
      menuTree,
      requestId: 'start-vm',
    });

    await ivrManager.handleInput({
      sessionId: 'sess-1',
      tenantId: 'tenant-1',
      digits: '4',
      requestId: 'input-vm',
    });

    expect(commandBus.enqueueIntents).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ commandType: 'START_VOICEMAIL' })]),
      expect.any(Object),
    );
  });

  it('routes operator destination', async () => {
    await ivrManager.startIvr({
      sessionId: 'sess-1',
      tenantId: 'tenant-1',
      menuTree,
      requestId: 'start-op',
    });

    await ivrManager.handleInput({
      sessionId: 'sess-1',
      tenantId: 'tenant-1',
      digits: '5',
      requestId: 'input-op',
    });

    expect(commandBus.enqueueIntents).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ commandType: 'DIAL' })]),
      expect.any(Object),
    );
  });

  it('navigates multi-level submenu', async () => {
    await ivrManager.startIvr({
      sessionId: 'sess-1',
      tenantId: 'tenant-1',
      menuTree,
      requestId: 'start-sub',
    });

    await ivrManager.handleInput({
      sessionId: 'sess-1',
      tenantId: 'tenant-1',
      digits: '6',
      requestId: 'input-sub',
    });

    expect(eventBus.replay({ eventType: DOMAIN_EVENTS.IVR_GREETING }).length).toBeGreaterThan(1);
  });

  it('repeats menu on star', async () => {
    await ivrManager.startIvr({
      sessionId: 'sess-1',
      tenantId: 'tenant-1',
      menuTree,
      requestId: 'start-repeat',
    });

    const result = await ivrManager.repeatMenu({
      sessionId: 'sess-1',
      tenantId: 'tenant-1',
      requestId: 'repeat-1',
    });

    expect(result.ok).toBe(true);
    expect(result.repeated).toBe(true);
  });

  it('handles invalid digit with retry', async () => {
    await ivrManager.startIvr({
      sessionId: 'sess-1',
      tenantId: 'tenant-1',
      menuTree,
      requestId: 'start-invalid',
    });

    const result = await ivrManager.handleInput({
      sessionId: 'sess-1',
      tenantId: 'tenant-1',
      digits: '8',
      requestId: 'input-invalid',
    });

    expect(result.ok).toBe(true);
    expect(eventBus.replay({ eventType: DOMAIN_EVENTS.IVR_INVALID_INPUT }).length).toBeGreaterThan(0);
    expect(eventBus.replay({ eventType: DOMAIN_EVENTS.IVR_RETRY }).length).toBeGreaterThan(0);
  });

  it('handles timeout with retry', async () => {
    await ivrManager.startIvr({
      sessionId: 'sess-1',
      tenantId: 'tenant-1',
      menuTree,
      requestId: 'start-timeout',
    });

    const result = await ivrManager.handleTimeout({
      sessionId: 'sess-1',
      tenantId: 'tenant-1',
      requestId: 'timeout-1',
    });

    expect(result.ok).toBe(true);
    expect(eventBus.replay({ eventType: DOMAIN_EVENTS.IVR_TIMEOUT }).length).toBeGreaterThan(0);
  });

  it('skips duplicate requests', async () => {
    await ivrManager.startIvr({
      sessionId: 'sess-1',
      tenantId: 'tenant-1',
      menuTree,
      requestId: 'dup',
    });
    const second = await ivrManager.startIvr({
      sessionId: 'sess-1',
      tenantId: 'tenant-1',
      menuTree,
      requestId: 'dup',
    });
    expect(second.skipped).toBe(true);
  });

  it('skips when ivr disabled (rollback)', async () => {
    vi.spyOn(featureFlags, 'getTenantFlags').mockResolvedValue({
      ivrEnabled: false,
      observeOnly: false,
      engineEnabled: true,
    });
    const result = await ivrManager.startIvr({
      sessionId: 'sess-1',
      tenantId: 'tenant-1',
      requestId: 'disabled',
    });
    expect(result.skipped).toBe(true);
    expect(result.reason).toBe('ivr_disabled');
  });

  it('does not enqueue commands in observe mode', async () => {
    vi.spyOn(featureFlags, 'getTenantFlags').mockResolvedValue({
      ivrEnabled: true,
      observeOnly: true,
      engineEnabled: true,
    });

    await ivrManager.startIvr({
      sessionId: 'sess-1',
      tenantId: 'tenant-1',
      menuTree,
      requestId: 'observe',
    });

    expect(commandBus.enqueueIntents).not.toHaveBeenCalled();
  });

  it('routes holiday override on start', async () => {
    const today = new Date().toISOString().slice(0, 10);
    prisma.__setGetPrismaForTests(async () => ({
      v3CallSession: {
        findUnique: vi.fn().mockImplementation(async () => ({ routeSnapshot: routeSnapshotState })),
        updateMany: mockUpdateMany,
      },
      tenant: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'tenant-1',
          timezone: 'America/New_York',
          greeting: {
            businessHoursEnabled: false,
            holidaySchedule: [{
              date: today,
              route: { destination: DESTINATION_TYPE.VOICEMAIL, extensionId: 'ext-holiday' },
            }],
          },
        }),
      },
      extension: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'ext-holiday',
          telnyxSipUsername: 'holiday-vm',
        }),
      },
      ringGroupMember: { findMany: vi.fn().mockResolvedValue([]) },
    }));

    await ivrManager.startIvr({
      sessionId: 'sess-1',
      tenantId: 'tenant-1',
      requestId: 'holiday',
    });

    expect(eventBus.replay({ eventType: DOMAIN_EVENTS.IVR_ROUTE_SELECTED }).length).toBeGreaterThan(0);
  });
});
