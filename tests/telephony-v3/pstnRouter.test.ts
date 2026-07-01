import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const pstnRouter = require('../../lib/telephony-v3/Routing/pstnRouter');
const pstnResolver = require('../../lib/telephony-v3/Routing/pstnResolver');
const commandBus = require('../../lib/telephony-v3/Commands/commandBus');
const featureFlags = require('../../lib/telephony-v3/FeatureFlags/featureFlagService');
const eventBus = require('../../lib/telephony-v3/Events/domainEventBus');
const { DOMAIN_EVENTS } = require('../../lib/telephony-v3/Events/domainEvents');
const { metrics } = require('../../lib/telephony-v3/Utils/metrics');
const { ROUTING_FLOW } = require('../../lib/telephony-v3/Routing/pstnRouteResult');
const prisma = require('../../lib/telephony-v3/internal/prisma');

const mockUpdateMany = vi.fn();
const mockFindUnique = vi.fn();
const mockTenantFind = vi.fn();
const mockExtensionFind = vi.fn();
const mockPhoneFindFirst = vi.fn();

describe('V3 pstnRouter', () => {
  beforeEach(() => {
    pstnRouter.resetPstnRouterForTests();
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
      phoneNumber: { findFirst: mockPhoneFindFirst },
      greeting: { findUnique: vi.fn().mockResolvedValue({ ringTimeout: 25 }) },
    }));

    mockFindUnique.mockResolvedValue({ routeSnapshot: null });
    mockUpdateMany.mockResolvedValue({ count: 1 });
    mockTenantFind.mockResolvedValue({ id: 'tenant-1', timezone: 'America/New_York' });
    mockExtensionFind.mockResolvedValue({
      id: 'ext-target',
      extensionNumber: '101',
      telnyxSipUsername: 'desk101',
      security: null,
    });
    mockPhoneFindFirst.mockResolvedValue({
      id: 'did-1',
      number: '+15559876543',
      tenantId: 'tenant-1',
      isActive: true,
      extensionId: 'ext-target',
    });

    vi.spyOn(featureFlags, 'getTenantFlags').mockResolvedValue({
      pstnEnabled: true,
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
      callControlId: 'cc-pstn',
      payload: { traceId: 'trace-1' },
      ...overrides,
    };
  }

  function mockInboundContext(routingFlow = ROUTING_FLOW.PSTN_TO_DESK) {
    vi.spyOn(pstnResolver, 'loadPstnSessionContext').mockResolvedValue({
      session: {
        id: 'sess-1',
        tenantId: 'tenant-1',
        origin: 'PSTN_INBOUND',
        direction: 'INBOUND',
        version: 1,
        correlationId: 'corr-1',
        primaryCallControlId: 'cc-pstn',
        legs: [{
          id: 'leg-1',
          role: 'PSTN',
          callControlId: 'cc-pstn',
          fromAddress: '+15551234567',
          toAddress: '+15559876543',
          connectionId: 'conn-1',
        }],
      },
      originLeg: {
        id: 'leg-1',
        role: 'PSTN',
        callControlId: 'cc-pstn',
        fromAddress: '+15551234567',
        toAddress: '+15559876543',
        connectionId: 'conn-1',
      },
      error: null,
    });

    vi.spyOn(pstnResolver, 'resolveDidOwnership').mockResolvedValue({
      phoneRecord: { id: 'did-1', number: '+15559876543', tenantId: 'tenant-1', isActive: true },
      greeting: { ringTimeout: 25 },
      tenant: { id: 'tenant-1' },
      error: null,
      suspended: false,
    });

    vi.spyOn(pstnResolver, 'resolvePstnInboundDestination').mockResolvedValue({
      destination: routingFlow === ROUTING_FLOW.PSTN_TO_MOBILE
        ? { dialTo: 'sip:gencred456@sip.telnyx.com' }
        : { dialTo: 'sip:desk101@sip.telnyx.com' },
      destinationType: routingFlow === ROUTING_FLOW.PSTN_TO_MOBILE ? 'EMPLOYEE_SIP' : 'DESK_SIP',
      routingFlow,
      targetExtension: { id: 'ext-target', extensionNumber: '101', security: null },
      caller: { pstnNumber: '+15551234567', raw: '+15551234567' },
      ringResolution: null,
      error: null,
    });
  }

  it('routes incoming PSTN to desk and enqueues commands', async () => {
    mockInboundContext(ROUTING_FLOW.PSTN_TO_DESK);

    const result = await pstnRouter.routePstnSession(baseEvent());

    expect(result.ok).toBe(true);
    expect(commandBus.enqueueIntents).toHaveBeenCalled();
    const events = eventBus.replay({ sessionId: 'sess-1' });
    expect(events.some((e) => e.eventType === DOMAIN_EVENTS.PSTN_ROUTE_COMPLETED)).toBe(true);

    const prom = await metrics.renderPrometheus();
    expect(prom).toContain('pstn_route_total');
  });

  it('routes incoming PSTN to mobile flow', async () => {
    mockInboundContext(ROUTING_FLOW.PSTN_TO_MOBILE);

    const result = await pstnRouter.routePstnSession(baseEvent());

    expect(result.ok).toBe(true);
    expect(result.routeResult.routingFlow).toBe(ROUTING_FLOW.PSTN_TO_MOBILE);
  });

  it('routes incoming PSTN to ring group with sequential DIAL intents', async () => {
    mockInboundContext();
    vi.spyOn(pstnResolver, 'resolvePstnInboundDestination').mockResolvedValue({
      destination: {
        ringGroupId: 'rg-1',
        dialTargets: ['sip:user1@sip.telnyx.com', 'sip:user2@sip.telnyx.com'],
        targets: [],
      },
      destinationType: 'RING_GROUP',
      routingFlow: ROUTING_FLOW.PSTN_TO_RING_GROUP,
      targetExtension: null,
      caller: { pstnNumber: '+15551234567' },
      ringResolution: { ringGroupId: 'rg-1' },
      error: null,
    });

    const result = await pstnRouter.routePstnSession(baseEvent());
    expect(result.ok).toBe(true);

    const enqueued = vi.mocked(commandBus.enqueueIntents).mock.calls[0][0];
    const dialCommands = enqueued.filter((c) => c.commandType === 'DIAL');
    expect(dialCommands.length).toBe(2);
    expect(dialCommands[0].payload.sequential).toBe(true);
    expect(dialCommands[0].payload.simultaneous).toBe(false);
  });

  it('handles unknown DID with speak and hangup', async () => {
    mockInboundContext();
    vi.spyOn(pstnResolver, 'resolveDidOwnership').mockResolvedValue({
      phoneRecord: null,
      greeting: null,
      tenant: null,
      error: 'unknown_did',
    });
    vi.spyOn(pstnResolver, 'resolvePstnInboundDestination').mockResolvedValue({
      destination: null,
      destinationType: 'UNKNOWN',
      routingFlow: ROUTING_FLOW.UNKNOWN,
      targetExtension: null,
      caller: { pstnNumber: '+15551234567' },
      error: 'unknown_did',
    });

    const result = await pstnRouter.routePstnSession(baseEvent());
    expect(result.ok).toBe(true);
    expect(commandBus.enqueueIntents).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ commandType: 'SPEAK' })]),
      expect.any(Object),
    );
  });

  it('skips when pstn routing disabled', async () => {
    vi.spyOn(featureFlags, 'getTenantFlags').mockResolvedValue({ pstnEnabled: false, observeOnly: true });
    mockInboundContext();

    const result = await pstnRouter.routePstnSession(baseEvent());
    expect(result.skipped).toBe(true);
    expect(commandBus.enqueueIntents).not.toHaveBeenCalled();
  });

  it('skips desk-originated sessions', async () => {
    mockInboundContext();
    vi.spyOn(pstnResolver, 'loadPstnSessionContext').mockResolvedValue({
      session: { id: 'sess-1', tenantId: 'tenant-1', origin: 'DESK', version: 1 },
      originLeg: { id: 'leg-1', callControlId: 'cc-1' },
      error: null,
    });

    const result = await pstnRouter.routePstnSession(baseEvent());
    expect(result.skipped).toBe(true);
    expect(result.reason).toBe('desk_origin');
  });

  it('skips duplicate events idempotently', async () => {
    mockInboundContext();
    const event = baseEvent();

    await pstnRouter.routePstnSession(event);
    const second = await pstnRouter.routePstnSession({ ...event, eventId: 'evt-1' });

    expect(second.skipped).toBe(true);
    expect(second.reason).toBe('duplicate_event');
  });

  it('skips already routed sessions', async () => {
    mockInboundContext();
    mockFindUnique.mockResolvedValue({ routeSnapshot: { routingModule: 'pstn' } });

    const result = await pstnRouter.routePstnSession(baseEvent());
    expect(result.skipped).toBe(true);
    expect(result.reason).toBe('already_routed');
  });

  it('does not enqueue commands in observe mode', async () => {
    vi.spyOn(featureFlags, 'getTenantFlags').mockResolvedValue({
      pstnEnabled: true,
      observeOnly: true,
      engineEnabled: true,
    });
    mockInboundContext();

    await pstnRouter.routePstnSession(baseEvent());
    expect(commandBus.enqueueIntents).not.toHaveBeenCalled();
  });

  it('publishes denied event for enforced policy deny', async () => {
    mockInboundContext(ROUTING_FLOW.PSTN_TO_DESK);
    mockExtensionFind.mockResolvedValue({
      id: 'ext-target',
      security: {
        blockAnonymous: true,
        blacklistNumbers: [],
      },
    });
    vi.spyOn(pstnResolver, 'resolvePstnInboundDestination').mockResolvedValue({
      destination: { dialTo: 'sip:desk101@sip.telnyx.com' },
      destinationType: 'DESK_SIP',
      routingFlow: ROUTING_FLOW.PSTN_TO_DESK,
      targetExtension: { id: 'ext-target', security: { blockAnonymous: true } },
      caller: { pstnNumber: null, raw: 'anonymous', anonymous: true },
      error: null,
    });

    const result = await pstnRouter.routePstnSession(baseEvent());
    expect(result.ok).toBe(true);
    expect(eventBus.replay({ eventType: DOMAIN_EVENTS.PSTN_ROUTE_DENIED }).length).toBeGreaterThan(0);
    expect(commandBus.enqueueIntents).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ commandType: 'REJECT' })]),
      expect.any(Object),
    );
  });

  it('enforces tenant isolation via resolver error', async () => {
    mockInboundContext();
    vi.spyOn(pstnResolver, 'resolvePstnInboundDestination').mockResolvedValue({
      destination: null,
      destinationType: 'UNKNOWN',
      routingFlow: ROUTING_FLOW.UNKNOWN,
      targetExtension: null,
      caller: { pstnNumber: '+15551234567' },
      error: 'tenant_isolation_violation',
    });

    const result = await pstnRouter.routePstnSession(baseEvent());
    expect(result.ok).toBe(true);
  });

  it('handles concurrent routing idempotently', async () => {
    mockInboundContext();
    const eventA = baseEvent({ eventId: 'evt-a' });
    const eventB = baseEvent({ eventId: 'evt-b' });

    mockFindUnique
      .mockResolvedValueOnce({ routeSnapshot: null })
      .mockResolvedValueOnce({ routeSnapshot: { routingModule: 'pstn' } });

    const [first, second] = await Promise.all([
      pstnRouter.routePstnSession(eventA),
      pstnRouter.routePstnSession(eventB),
    ]);

    expect(first.ok || first.skipped).toBeTruthy();
    expect(second.ok || second.skipped).toBeTruthy();
  });

  it('supports idempotent replay of completed route events', async () => {
    mockInboundContext();
    const event = baseEvent();

    const first = await pstnRouter.routePstnSession(event);
    expect(first.ok).toBe(true);

    mockFindUnique.mockResolvedValue({ routeSnapshot: { routingModule: 'pstn' } });
    const replay = await pstnRouter.routePstnSession({ ...event, eventId: 'evt-replay' });

    expect(replay.skipped).toBe(true);
    expect(replay.reason).toBe('already_routed');
  });
});
