import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const deskRouter = require('../../lib/telephony-v3/Routing/deskRouter');
const deskResolver = require('../../lib/telephony-v3/Routing/deskResolver');
const commandBus = require('../../lib/telephony-v3/Commands/commandBus');
const featureFlags = require('../../lib/telephony-v3/FeatureFlags/featureFlagService');
const eventBus = require('../../lib/telephony-v3/Events/domainEventBus');
const { DOMAIN_EVENTS } = require('../../lib/telephony-v3/Events/domainEvents');
const { metrics } = require('../../lib/telephony-v3/Utils/metrics');
const { ROUTING_FLOW } = require('../../lib/telephony-v3/Routing/deskRouteResult');
const prisma = require('../../lib/telephony-v3/internal/prisma');

const mockUpdateMany = vi.fn();
const mockFindUnique = vi.fn();
const mockTenantFind = vi.fn();
const mockExtensionFind = vi.fn();

describe('V3 deskRouter', () => {
  beforeEach(() => {
    deskRouter.resetDeskRouterForTests();
    eventBus.resetForTests();
    metrics.resetMetricsForTests();
    vi.clearAllMocks();

    prisma.__setGetPrismaForTests(async () => ({
      v3CallSession: {
        findUnique: mockFindUnique,
        updateMany: mockUpdateMany,
      },
      tenant: { findUnique: mockTenantFind },
      extension: { findFirst: mockExtensionFind },
    }));

    mockFindUnique.mockResolvedValue({ routeSnapshot: null });
    mockUpdateMany.mockResolvedValue({ count: 1 });
    mockTenantFind.mockResolvedValue({ id: 'tenant-1', timezone: 'America/New_York' });
    mockExtensionFind.mockResolvedValue({
      id: 'ext-caller',
      extensionNumber: '101',
      security: { internationalEnabled: true, callingPermissions: { international: true } },
    });

    vi.spyOn(featureFlags, 'getTenantFlags').mockResolvedValue({
      deskEnabled: true,
      observeOnly: false,
      engineEnabled: true,
    });
    vi.spyOn(commandBus, 'enqueueIntents').mockResolvedValue([]);
  });

  afterEach(() => {
    prisma.__resetGetPrismaForTests();
    vi.restoreAllMocks();
  });

  function baseEvent(overrides = {}) {
    return {
      eventId: 'evt-1',
      eventType: DOMAIN_EVENTS.SESSION_CREATED,
      occurredAt: new Date().toISOString(),
      sessionId: 'sess-1',
      tenantId: 'tenant-1',
      correlationId: 'corr-1',
      callControlId: 'cc-origin',
      payload: { traceId: 'trace-1' },
      ...overrides,
    };
  }

  function mockDeskContext(routingFlow = ROUTING_FLOW.DESK_TO_DESK) {
    vi.spyOn(deskResolver, 'loadDeskSessionContext').mockResolvedValue({
      session: {
        id: 'sess-1',
        tenantId: 'tenant-1',
        origin: 'DESK',
        version: 1,
        correlationId: 'corr-1',
        primaryCallControlId: 'cc-origin',
        legs: [{ id: 'leg-1', role: 'ORIGIN', callControlId: 'cc-origin', toAddress: '102', fromAddress: 'sip:101@' }],
      },
      originLeg: {
        id: 'leg-1',
        role: 'ORIGIN',
        callControlId: 'cc-origin',
        toAddress: '102',
        fromAddress: 'sip:101@',
        connectionId: 'conn-1',
      },
      error: null,
    });

    vi.spyOn(deskResolver, 'resolveDeskCaller').mockResolvedValue({
      caller: {
        tenantId: 'tenant-1',
        userId: 'user-1',
        extensionId: 'ext-caller',
        extensionNumber: '101',
      },
      error: null,
    });

    vi.spyOn(deskResolver, 'resolveDeskDestination').mockResolvedValue({
      destination: { extensionNumber: '102', dialTo: 'sip:gencred123@sip.telnyx.com' },
      destinationType: routingFlow === ROUTING_FLOW.DESK_TO_MOBILE ? 'EMPLOYEE_SIP' : 'EXTENSION',
      routingFlow,
      targetExtension: { id: 'ext-target', extensionNumber: '102', security: null },
      error: null,
    });
  }

  it('routes desk-to-desk and enqueues commands', async () => {
    mockDeskContext(ROUTING_FLOW.DESK_TO_DESK);

    const result = await deskRouter.routeDeskSession(baseEvent());

    expect(result.ok).toBe(true);
    expect(commandBus.enqueueIntents).toHaveBeenCalled();
    const events = eventBus.replay({ sessionId: 'sess-1' });
    expect(events.some((e) => e.eventType === DOMAIN_EVENTS.DESK_ROUTE_COMPLETED)).toBe(true);

    const prom = await metrics.renderPrometheus();
    expect(prom).toContain('desk_route_total');
  });

  it('routes desk-to-mobile flow', async () => {
    mockDeskContext(ROUTING_FLOW.DESK_TO_MOBILE);

    const result = await deskRouter.routeDeskSession(baseEvent());

    expect(result.ok).toBe(true);
    expect(result.routeResult.routingFlow).toBe(ROUTING_FLOW.DESK_TO_MOBILE);
  });

  it('routes desk-to-pstn flow', async () => {
    mockDeskContext();
    vi.spyOn(deskResolver, 'resolveDeskDestination').mockResolvedValue({
      destination: { pstnNumber: '+15551234567', dialTo: '+15551234567' },
      destinationType: 'PSTN',
      routingFlow: ROUTING_FLOW.DESK_TO_PSTN,
      targetExtension: null,
      error: null,
    });

    const result = await deskRouter.routeDeskSession(baseEvent());
    expect(result.ok).toBe(true);
    expect(result.routeResult.routingFlow).toBe(ROUTING_FLOW.DESK_TO_PSTN);
  });

  it('skips when desk routing disabled', async () => {
    vi.spyOn(featureFlags, 'getTenantFlags').mockResolvedValue({ deskEnabled: false, observeOnly: true });
    mockDeskContext();

    const result = await deskRouter.routeDeskSession(baseEvent());
    expect(result.skipped).toBe(true);
    expect(commandBus.enqueueIntents).not.toHaveBeenCalled();
  });

  it('skips duplicate events idempotently', async () => {
    mockDeskContext();
    const event = baseEvent();

    await deskRouter.routeDeskSession(event);
    const second = await deskRouter.routeDeskSession({ ...event, eventId: 'evt-1' });

    expect(second.skipped).toBe(true);
    expect(second.reason).toBe('duplicate_event');
  });

  it('skips already routed sessions', async () => {
    mockDeskContext();
    mockFindUnique.mockResolvedValue({ routeSnapshot: { routedAt: '2026-01-01T00:00:00.000Z' } });

    const result = await deskRouter.routeDeskSession(baseEvent());
    expect(result.skipped).toBe(true);
    expect(result.reason).toBe('already_routed');
  });

  it('routes when routeSnapshot only contains desk outbound bootstrap', async () => {
    mockDeskContext();
    mockFindUnique.mockResolvedValue({
      routeSnapshot: {
        callKind: 'DESK_OUTBOUND',
        deskBootstrap: { extensionNumber: '100', sipUsername: 'user100' },
      },
    });

    const result = await deskRouter.routeDeskSession(baseEvent());
    expect(result.ok).toBe(true);
    expect(commandBus.enqueueIntents).toHaveBeenCalled();
  });

  it('does not enqueue commands in observe mode', async () => {
    vi.spyOn(featureFlags, 'getTenantFlags').mockResolvedValue({
      deskEnabled: true,
      observeOnly: true,
      engineEnabled: true,
    });
    mockDeskContext();

    await deskRouter.routeDeskSession(baseEvent());
    expect(commandBus.enqueueIntents).not.toHaveBeenCalled();
  });

  it('enforces tenant isolation on caller resolution failure', async () => {
    mockDeskContext();
    vi.spyOn(deskResolver, 'resolveDeskCaller').mockResolvedValue({
      caller: null,
      error: 'tenant_isolation_violation',
    });

    const result = await deskRouter.routeDeskSession(baseEvent());
    expect(result.ok).toBe(false);
    expect(eventBus.replay({ eventType: DOMAIN_EVENTS.DESK_ROUTE_FAILED }).length).toBeGreaterThan(0);
  });

  it('publishes denied event for enforced policy deny', async () => {
    mockDeskContext(ROUTING_FLOW.DESK_TO_PSTN);
    vi.spyOn(deskResolver, 'resolveDeskDestination').mockResolvedValue({
      destination: { pstnNumber: '+442071234567', dialTo: '+442071234567' },
      destinationType: 'PSTN',
      routingFlow: ROUTING_FLOW.DESK_TO_PSTN,
      targetExtension: null,
      error: null,
    });
    mockExtensionFind.mockResolvedValue({
      id: 'ext-caller',
      security: { internationalEnabled: false, callingPermissions: { international: false } },
    });

    const result = await deskRouter.routeDeskSession(baseEvent());
    expect(result.ok).toBe(true);
    expect(eventBus.replay({ eventType: DOMAIN_EVENTS.DESK_ROUTE_DENIED }).length).toBeGreaterThan(0);
    expect(commandBus.enqueueIntents).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ commandType: 'REJECT' })]),
      expect.any(Object),
    );
  });
});
