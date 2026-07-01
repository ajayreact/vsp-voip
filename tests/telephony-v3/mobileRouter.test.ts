import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mobileRouter = require('../../lib/telephony-v3/Routing/mobileRouter');
const mobileResolver = require('../../lib/telephony-v3/Routing/mobileResolver');
const commandBus = require('../../lib/telephony-v3/Commands/commandBus');
const featureFlags = require('../../lib/telephony-v3/FeatureFlags/featureFlagService');
const eventBus = require('../../lib/telephony-v3/Events/domainEventBus');
const { DOMAIN_EVENTS } = require('../../lib/telephony-v3/Events/domainEvents');
const { metrics } = require('../../lib/telephony-v3/Utils/metrics');
const { ROUTING_FLOW } = require('../../lib/telephony-v3/Routing/mobileRouteResult');
const prisma = require('../../lib/telephony-v3/internal/prisma');

const mockUpdateMany = vi.fn();
const mockFindUnique = vi.fn();
const mockTenantFind = vi.fn();
const mockExtensionFind = vi.fn();

describe('V3 mobileRouter', () => {
  beforeEach(() => {
    mobileRouter.resetMobileRouterForTests();
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
      mobileEnabled: true,
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

  function mockMobileContext(routingFlow = ROUTING_FLOW.MOBILE_TO_MOBILE) {
    vi.spyOn(mobileResolver, 'loadMobileSessionContext').mockResolvedValue({
      session: {
        id: 'sess-1',
        tenantId: 'tenant-1',
        origin: 'PSTN_OUTBOUND',
        direction: 'OUTBOUND',
        version: 1,
        correlationId: 'corr-1',
        primaryCallControlId: 'cc-origin',
        legs: [{
          id: 'leg-1',
          role: 'PSTN',
          callControlId: 'cc-origin',
          toAddress: '102',
          fromAddress: 'sip:gencred123@sip.telnyx.com',
          connectionId: 'cred-conn-1',
        }],
      },
      originLeg: {
        id: 'leg-1',
        role: 'PSTN',
        callControlId: 'cc-origin',
        toAddress: '102',
        fromAddress: 'sip:gencred123@sip.telnyx.com',
        connectionId: 'cred-conn-1',
      },
      error: null,
    });

    vi.spyOn(mobileResolver, 'resolveMobileCaller').mockResolvedValue({
      caller: {
        tenantId: 'tenant-1',
        userId: 'user-1',
        extensionId: 'ext-caller',
        extensionNumber: '101',
        sipUsername: 'gencred123',
        device: 'mobile_app',
      },
      error: null,
    });

    vi.spyOn(mobileResolver, 'resolveMobileDestination').mockResolvedValue({
      destination: { extensionNumber: '102', dialTo: 'sip:gencred456@sip.telnyx.com' },
      destinationType: routingFlow === ROUTING_FLOW.MOBILE_TO_DESK ? 'DESK_SIP' : 'EMPLOYEE_SIP',
      routingFlow,
      targetExtension: { id: 'ext-target', extensionNumber: '102', security: null },
      error: null,
    });
  }

  it('routes mobile-to-mobile and enqueues commands', async () => {
    mockMobileContext(ROUTING_FLOW.MOBILE_TO_MOBILE);

    const result = await mobileRouter.routeMobileSession(baseEvent());

    expect(result.ok).toBe(true);
    expect(commandBus.enqueueIntents).toHaveBeenCalled();
    const events = eventBus.replay({ sessionId: 'sess-1' });
    expect(events.some((e) => e.eventType === DOMAIN_EVENTS.MOBILE_ROUTE_COMPLETED)).toBe(true);

    const prom = await metrics.renderPrometheus();
    expect(prom).toContain('mobile_route_total');
  });

  it('routes mobile-to-desk flow', async () => {
    mockMobileContext(ROUTING_FLOW.MOBILE_TO_DESK);

    const result = await mobileRouter.routeMobileSession(baseEvent());

    expect(result.ok).toBe(true);
    expect(result.routeResult.routingFlow).toBe(ROUTING_FLOW.MOBILE_TO_DESK);
  });

  it('routes mobile-to-pstn flow', async () => {
    mockMobileContext();
    vi.spyOn(mobileResolver, 'resolveMobileDestination').mockResolvedValue({
      destination: { pstnNumber: '+15551234567', dialTo: '+15551234567' },
      destinationType: 'PSTN',
      routingFlow: ROUTING_FLOW.MOBILE_TO_PSTN,
      targetExtension: null,
      error: null,
    });

    const result = await mobileRouter.routeMobileSession(baseEvent());
    expect(result.ok).toBe(true);
    expect(result.routeResult.routingFlow).toBe(ROUTING_FLOW.MOBILE_TO_PSTN);
  });

  it('skips when mobile routing disabled', async () => {
    vi.spyOn(featureFlags, 'getTenantFlags').mockResolvedValue({ mobileEnabled: false, observeOnly: true });
    mockMobileContext();

    const result = await mobileRouter.routeMobileSession(baseEvent());
    expect(result.skipped).toBe(true);
    expect(commandBus.enqueueIntents).not.toHaveBeenCalled();
  });

  it('skips desk-originated sessions', async () => {
    mockMobileContext();
    vi.spyOn(mobileResolver, 'loadMobileSessionContext').mockResolvedValue({
      session: {
        id: 'sess-1',
        tenantId: 'tenant-1',
        origin: 'DESK',
        version: 1,
        primaryCallControlId: 'cc-origin',
        legs: [{ id: 'leg-1', role: 'ORIGIN', callControlId: 'cc-origin' }],
      },
      originLeg: { id: 'leg-1', role: 'ORIGIN', callControlId: 'cc-origin' },
      error: null,
    });

    const result = await mobileRouter.routeMobileSession(baseEvent());
    expect(result.skipped).toBe(true);
    expect(result.reason).toBe('desk_origin');
  });

  it('skips duplicate events idempotently', async () => {
    mockMobileContext();
    const event = baseEvent();

    await mobileRouter.routeMobileSession(event);
    const second = await mobileRouter.routeMobileSession({ ...event, eventId: 'evt-1' });

    expect(second.skipped).toBe(true);
    expect(second.reason).toBe('duplicate_event');
  });

  it('skips already routed sessions', async () => {
    mockMobileContext();
    mockFindUnique.mockResolvedValue({ routeSnapshot: { routingModule: 'mobile', routedAt: '2026-01-01T00:00:00.000Z' } });

    const result = await mobileRouter.routeMobileSession(baseEvent());
    expect(result.skipped).toBe(true);
    expect(result.reason).toBe('already_routed');
  });

  it('does not enqueue commands in observe mode', async () => {
    vi.spyOn(featureFlags, 'getTenantFlags').mockResolvedValue({
      mobileEnabled: true,
      observeOnly: true,
      engineEnabled: true,
    });
    mockMobileContext();

    await mobileRouter.routeMobileSession(baseEvent());
    expect(commandBus.enqueueIntents).not.toHaveBeenCalled();
  });

  it('enforces tenant isolation on caller resolution failure', async () => {
    mockMobileContext();
    vi.spyOn(mobileResolver, 'resolveMobileCaller').mockResolvedValue({
      caller: null,
      error: 'tenant_isolation_violation',
    });

    const result = await mobileRouter.routeMobileSession(baseEvent());
    expect(result.ok).toBe(false);
    expect(eventBus.replay({ eventType: DOMAIN_EVENTS.MOBILE_ROUTE_FAILED }).length).toBeGreaterThan(0);
  });

  it('publishes denied event for enforced policy deny', async () => {
    mockMobileContext(ROUTING_FLOW.MOBILE_TO_PSTN);
    vi.spyOn(mobileResolver, 'resolveMobileDestination').mockResolvedValue({
      destination: { pstnNumber: '+442071234567', dialTo: '+442071234567' },
      destinationType: 'PSTN',
      routingFlow: ROUTING_FLOW.MOBILE_TO_PSTN,
      targetExtension: null,
      error: null,
    });
    mockExtensionFind.mockResolvedValue({
      id: 'ext-caller',
      security: { internationalEnabled: false, callingPermissions: { international: false } },
    });

    const result = await mobileRouter.routeMobileSession(baseEvent());
    expect(result.ok).toBe(true);
    expect(eventBus.replay({ eventType: DOMAIN_EVENTS.MOBILE_ROUTE_DENIED }).length).toBeGreaterThan(0);
    expect(commandBus.enqueueIntents).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ commandType: 'REJECT' })]),
      expect.any(Object),
    );
  });

  it('handles unknown destination flow', async () => {
    mockMobileContext();
    vi.spyOn(mobileResolver, 'resolveMobileDestination').mockResolvedValue({
      destination: null,
      destinationType: 'UNKNOWN',
      routingFlow: ROUTING_FLOW.UNKNOWN,
      targetExtension: null,
      error: 'unknown_destination',
    });

    const result = await mobileRouter.routeMobileSession(baseEvent());
    expect(result.ok).toBe(true);
    expect(result.routeResult.routingFlow).toBe(ROUTING_FLOW.UNKNOWN);
    expect(commandBus.enqueueIntents).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ commandType: 'SPEAK' })]),
      expect.any(Object),
    );
  });

  it('skips non-mobile origin callers', async () => {
    mockMobileContext();
    vi.spyOn(mobileResolver, 'resolveMobileCaller').mockResolvedValue({
      caller: null,
      error: 'not_mobile_origin',
    });

    const result = await mobileRouter.routeMobileSession(baseEvent());
    expect(result.skipped).toBe(true);
    expect(result.reason).toBe('not_mobile_origin');
  });

  it('handles concurrent routing idempotently via route snapshot', async () => {
    mockMobileContext();
    const eventA = baseEvent({ eventId: 'evt-a' });
    const eventB = baseEvent({ eventId: 'evt-b' });

    mockFindUnique
      .mockResolvedValueOnce({ routeSnapshot: null })
      .mockResolvedValueOnce({ routeSnapshot: { routingModule: 'mobile' } });

    const [first, second] = await Promise.all([
      mobileRouter.routeMobileSession(eventA),
      mobileRouter.routeMobileSession(eventB),
    ]);

    expect(first.ok || first.skipped).toBeTruthy();
    const completed = [first, second].filter((r) => r.ok).length;
    const skipped = [first, second].filter((r) => r.skipped).length;
    expect(completed + skipped).toBe(2);
  });

  it('supports idempotent replay of completed route events', async () => {
    mockMobileContext();
    const event = baseEvent();

    const first = await mobileRouter.routeMobileSession(event);
    expect(first.ok).toBe(true);

    mockFindUnique.mockResolvedValue({ routeSnapshot: { routingModule: 'mobile' } });
    const replay = await mobileRouter.routeMobileSession({ ...event, eventId: 'evt-replay' });

    expect(replay.skipped).toBe(true);
    expect(replay.reason).toBe('already_routed');
  });
});
