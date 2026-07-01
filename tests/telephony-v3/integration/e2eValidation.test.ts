import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  resetIntegrationHarness,
  baseDomainEvent,
  simulateCanonicalSessionLifecycle,
  assertObservability,
  DOMAIN_EVENTS,
} from './harness';

const deskRouter = require('../../../lib/telephony-v3/Routing/deskRouter');
const deskResolver = require('../../../lib/telephony-v3/Routing/deskResolver');
const mobileRouter = require('../../../lib/telephony-v3/Routing/mobileRouter');
const mobileResolver = require('../../../lib/telephony-v3/Routing/mobileResolver');
const pstnRouter = require('../../../lib/telephony-v3/Routing/pstnRouter');
const pstnResolver = require('../../../lib/telephony-v3/Routing/pstnResolver');
const commandBus = require('../../../lib/telephony-v3/Commands/commandBus');
const commandOutbox = require('../../../lib/telephony-v3/Outbox/commandOutbox');
const commandExecutor = require('../../../lib/telephony-v3/Executor/commandExecutor');
const eventBus = require('../../../lib/telephony-v3/Events/domainEventBus');
const featureFlags = require('../../../lib/telephony-v3/FeatureFlags/featureFlagService');
const stateMachine = require('../../../lib/telephony-v3/StateMachine/stateMachine');
const { metrics } = require('../../../lib/telephony-v3/Utils/metrics');
const { ROUTING_FLOW: DESK_FLOW } = require('../../../lib/telephony-v3/Routing/deskRouteResult');
const { ROUTING_FLOW: MOBILE_FLOW } = require('../../../lib/telephony-v3/Routing/mobileRouteResult');
const { ROUTING_FLOW: PSTN_FLOW } = require('../../../lib/telephony-v3/Routing/pstnRouteResult');
const prisma = require('../../../lib/telephony-v3/internal/prisma');
const locks = require('../../../lib/telephony-v3/Redis/locks');

const mockUpdateMany = vi.fn();
const mockFindUnique = vi.fn();
const mockTenantFind = vi.fn();
const mockExtensionFind = vi.fn();
const mockPhoneFindFirst = vi.fn();
const mockOutboxCreate = vi.fn();
const mockOutboxFindUnique = vi.fn();
const mockFindLeg = vi.fn();
const mockFindSession = vi.fn();

/** In-memory outbox for pipeline integration */
const outboxStore = new Map<string, Record<string, unknown>>();

function setupPrismaMocks() {
  prisma.__setGetPrismaForTests(async () => ({
    v3CallSession: {
      findUnique: mockFindUnique,
      updateMany: mockUpdateMany,
    },
    v3CallLeg: { findUnique: mockFindLeg },
    tenant: { findUnique: mockTenantFind },
    extension: {
      findFirst: mockExtensionFind,
      findMany: vi.fn().mockResolvedValue([]),
    },
    phoneNumber: { findFirst: mockPhoneFindFirst },
    greeting: { findUnique: vi.fn().mockResolvedValue({ ringTimeout: 25 }) },
    v3CommandOutbox: {
      create: mockOutboxCreate,
      findUnique: mockOutboxFindUnique,
    },
  }));
}

function setupOutboxPipeline() {
  vi.spyOn(locks, 'withSessionLock').mockImplementation(async (_id, fn) => fn());
  outboxStore.clear();
  mockOutboxCreate.mockImplementation(async ({ data }) => {
    if (outboxStore.has(data.idempotencyKey)) {
      const err = Object.assign(new Error('duplicate'), { code: 'P2002' });
      throw err;
    }
    const row = {
      id: `cmd-${outboxStore.size + 1}`,
      ...data,
      attempts: 0,
      maxAttempts: 5,
      status: 'PENDING',
    };
    outboxStore.set(data.idempotencyKey, row);
    return row;
  });
  mockOutboxFindUnique.mockImplementation(async ({ where }) => {
    if (where.idempotencyKey) return outboxStore.get(where.idempotencyKey) || null;
    return null;
  });
}

function mockDeskSession(flow = DESK_FLOW.DESK_TO_DESK) {
  vi.spyOn(deskResolver, 'loadDeskSessionContext').mockResolvedValue({
    session: {
      id: 'sess-desk',
      tenantId: 'tenant-1',
      origin: 'DESK',
      version: 1,
      correlationId: 'corr-integration',
      primaryCallControlId: 'cc-origin',
    },
    originLeg: {
      id: 'leg-1',
      role: 'ORIGIN',
      callControlId: 'cc-origin',
      toAddress: '102',
      fromAddress: 'sip:101@',
      connectionId: 'conn-desk',
    },
    error: null,
  });
  vi.spyOn(deskResolver, 'resolveDeskCaller').mockResolvedValue({
    caller: { tenantId: 'tenant-1', userId: 'u1', extensionId: 'ext-1', extensionNumber: '101' },
    error: null,
  });
  vi.spyOn(deskResolver, 'resolveDeskDestination').mockResolvedValue({
    destination: { dialTo: flow === DESK_FLOW.DESK_TO_PSTN ? '+15551234567' : 'sip:target@sip.telnyx.com' },
    destinationType: flow === DESK_FLOW.DESK_TO_PSTN ? 'PSTN' : 'EXTENSION',
    routingFlow: flow,
    targetExtension: { id: 'ext-t', extensionNumber: '102', security: null },
    error: null,
  });
}

function mockMobileSession(flow = MOBILE_FLOW.MOBILE_TO_MOBILE) {
  vi.spyOn(mobileResolver, 'loadMobileSessionContext').mockResolvedValue({
    session: {
      id: 'sess-mobile',
      tenantId: 'tenant-1',
      origin: 'PSTN_OUTBOUND',
      direction: 'OUTBOUND',
      version: 1,
      correlationId: 'corr-integration',
      primaryCallControlId: 'cc-origin',
    },
    originLeg: {
      id: 'leg-1',
      role: 'PSTN',
      callControlId: 'cc-origin',
      toAddress: '102',
      fromAddress: 'sip:gencred123@sip.telnyx.com',
      connectionId: 'cred-conn',
    },
    error: null,
  });
  vi.spyOn(mobileResolver, 'resolveMobileCaller').mockResolvedValue({
    caller: { tenantId: 'tenant-1', userId: 'u1', extensionId: 'ext-1', extensionNumber: '101', sipUsername: 'gencred123' },
    error: null,
  });
  vi.spyOn(mobileResolver, 'resolveMobileDestination').mockResolvedValue({
    destination: { dialTo: flow === MOBILE_FLOW.MOBILE_TO_PSTN ? '+15551234567' : 'sip:gencred456@sip.telnyx.com' },
    destinationType: flow === MOBILE_FLOW.MOBILE_TO_PSTN ? 'PSTN' : 'EMPLOYEE_SIP',
    routingFlow: flow,
    targetExtension: { id: 'ext-t', extensionNumber: '102', security: null },
    error: null,
  });
}

function mockPstnSession(flow = PSTN_FLOW.PSTN_TO_DESK) {
  vi.spyOn(pstnResolver, 'loadPstnSessionContext').mockResolvedValue({
    session: {
      id: 'sess-pstn',
      tenantId: 'tenant-1',
      origin: 'PSTN_INBOUND',
      direction: 'INBOUND',
      version: 1,
      correlationId: 'corr-integration',
      primaryCallControlId: 'cc-pstn',
    },
    originLeg: {
      id: 'leg-1',
      role: 'PSTN',
      callControlId: 'cc-pstn',
      fromAddress: '+15551234567',
      toAddress: '+15559876543',
      connectionId: 'conn-pstn',
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
  if (flow === PSTN_FLOW.PSTN_TO_RING_GROUP) {
    vi.spyOn(pstnResolver, 'resolvePstnInboundDestination').mockResolvedValue({
      destination: { ringGroupId: 'rg-1', dialTargets: ['sip:a@sip.telnyx.com', 'sip:b@sip.telnyx.com'] },
      destinationType: 'RING_GROUP',
      routingFlow: flow,
      targetExtension: null,
      caller: { pstnNumber: '+15551234567' },
      error: null,
    });
  } else {
    vi.spyOn(pstnResolver, 'resolvePstnInboundDestination').mockResolvedValue({
      destination: { dialTo: flow === PSTN_FLOW.PSTN_TO_MOBILE ? 'sip:gencred@sip.telnyx.com' : 'sip:desk101@sip.telnyx.com' },
      destinationType: flow === PSTN_FLOW.PSTN_TO_MOBILE ? 'EMPLOYEE_SIP' : 'DESK_SIP',
      routingFlow: flow,
      targetExtension: { id: 'ext-t', extensionNumber: '101', security: null },
      caller: { pstnNumber: '+15551234567' },
      error: null,
    });
  }
}

describe('Phase 3.4.5 E2E Integration — Flow Matrix', () => {
  beforeEach(() => {
    resetIntegrationHarness();
    vi.clearAllMocks();
    setupPrismaMocks();
    setupOutboxPipeline();

    mockFindUnique.mockResolvedValue({ routeSnapshot: null });
    mockUpdateMany.mockResolvedValue({ count: 1 });
    mockTenantFind.mockResolvedValue({ id: 'tenant-1', timezone: 'America/New_York' });
    mockExtensionFind.mockResolvedValue({
      id: 'ext-1',
      extensionNumber: '101',
      security: { internationalEnabled: true, callingPermissions: { international: true } },
    });
    mockFindLeg.mockResolvedValue({ id: 'leg-1', callControlId: 'cc-origin' });
    mockFindSession.mockResolvedValue({
      id: 'sess-desk',
      tenantId: 'tenant-1',
      correlationId: 'corr-integration',
      primaryCallControlId: 'cc-origin',
    });

    vi.spyOn(featureFlags, 'getTenantFlags').mockResolvedValue({
      deskEnabled: true,
      mobileEnabled: true,
      pstnEnabled: true,
      observeOnly: false,
      engineEnabled: true,
    });
  });

  afterEach(() => {
    prisma.__resetGetPrismaForTests();
    vi.restoreAllMocks();
  });

  const flowCases: Array<{
    name: string;
    route: () => Promise<{ ok?: boolean; routeResult?: { routingFlow: string } }>;
    flow: string;
    completedEvent: string;
    sessionId: string;
  }> = [
    { name: 'Desk → Desk', route: () => { mockDeskSession(DESK_FLOW.DESK_TO_DESK); return deskRouter.routeDeskSession(baseDomainEvent('desk', DOMAIN_EVENTS.DESK_ROUTE_COMPLETED)); }, flow: DESK_FLOW.DESK_TO_DESK, completedEvent: DOMAIN_EVENTS.DESK_ROUTE_COMPLETED, sessionId: 'sess-desk' },
    { name: 'Desk → Mobile', route: () => { mockDeskSession(DESK_FLOW.DESK_TO_MOBILE); return deskRouter.routeDeskSession(baseDomainEvent('desk', DOMAIN_EVENTS.DESK_ROUTE_COMPLETED)); }, flow: DESK_FLOW.DESK_TO_MOBILE, completedEvent: DOMAIN_EVENTS.DESK_ROUTE_COMPLETED, sessionId: 'sess-desk' },
    { name: 'Desk → PSTN', route: () => { mockDeskSession(DESK_FLOW.DESK_TO_PSTN); return deskRouter.routeDeskSession(baseDomainEvent('desk', DOMAIN_EVENTS.DESK_ROUTE_COMPLETED)); }, flow: DESK_FLOW.DESK_TO_PSTN, completedEvent: DOMAIN_EVENTS.DESK_ROUTE_COMPLETED, sessionId: 'sess-desk' },
    { name: 'Mobile → Mobile', route: () => { mockMobileSession(MOBILE_FLOW.MOBILE_TO_MOBILE); return mobileRouter.routeMobileSession(baseDomainEvent('mobile', DOMAIN_EVENTS.MOBILE_ROUTE_COMPLETED)); }, flow: MOBILE_FLOW.MOBILE_TO_MOBILE, completedEvent: DOMAIN_EVENTS.MOBILE_ROUTE_COMPLETED, sessionId: 'sess-mobile' },
    { name: 'Mobile → Desk', route: () => { mockMobileSession(MOBILE_FLOW.MOBILE_TO_DESK); return mobileRouter.routeMobileSession(baseDomainEvent('mobile', DOMAIN_EVENTS.MOBILE_ROUTE_COMPLETED)); }, flow: MOBILE_FLOW.MOBILE_TO_DESK, completedEvent: DOMAIN_EVENTS.MOBILE_ROUTE_COMPLETED, sessionId: 'sess-mobile' },
    { name: 'Mobile → PSTN', route: () => { mockMobileSession(MOBILE_FLOW.MOBILE_TO_PSTN); return mobileRouter.routeMobileSession(baseDomainEvent('mobile', DOMAIN_EVENTS.MOBILE_ROUTE_COMPLETED)); }, flow: MOBILE_FLOW.MOBILE_TO_PSTN, completedEvent: DOMAIN_EVENTS.MOBILE_ROUTE_COMPLETED, sessionId: 'sess-mobile' },
    { name: 'Incoming PSTN → Desk', route: () => { mockPstnSession(PSTN_FLOW.PSTN_TO_DESK); return pstnRouter.routePstnSession(baseDomainEvent('pstn', DOMAIN_EVENTS.PSTN_ROUTE_COMPLETED)); }, flow: PSTN_FLOW.PSTN_TO_DESK, completedEvent: DOMAIN_EVENTS.PSTN_ROUTE_COMPLETED, sessionId: 'sess-pstn' },
    { name: 'Incoming PSTN → Mobile', route: () => { mockPstnSession(PSTN_FLOW.PSTN_TO_MOBILE); return pstnRouter.routePstnSession(baseDomainEvent('pstn', DOMAIN_EVENTS.PSTN_ROUTE_COMPLETED)); }, flow: PSTN_FLOW.PSTN_TO_MOBILE, completedEvent: DOMAIN_EVENTS.PSTN_ROUTE_COMPLETED, sessionId: 'sess-pstn' },
    { name: 'Incoming PSTN → Ring Group', route: () => { mockPstnSession(PSTN_FLOW.PSTN_TO_RING_GROUP); return pstnRouter.routePstnSession(baseDomainEvent('pstn', DOMAIN_EVENTS.PSTN_ROUTE_COMPLETED)); }, flow: PSTN_FLOW.PSTN_TO_RING_GROUP, completedEvent: DOMAIN_EVENTS.PSTN_ROUTE_COMPLETED, sessionId: 'sess-pstn' },
  ];

  it.each(flowCases)('$name completes routing and enqueues commands', async ({ route, flow, completedEvent, sessionId }) => {
    const enqueueSpy = vi.spyOn(commandBus, 'enqueueIntents').mockResolvedValue([]);

    const result = await route();

    expect(result.ok).toBe(true);
    expect(result.routeResult?.routingFlow).toBe(flow);
    expect(enqueueSpy).toHaveBeenCalled();

    const obs = assertObservability(eventBus.replay(), sessionId, completedEvent, `trace-${sessionId.split('-')[1]}`);
    expect(obs.hasStarted).toBe(true);
    expect(obs.hasCompleted).toBe(true);
    expect(obs.hasTrace).toBe(true);
  });

  it('Policy Deny enqueues REJECT exactly once', async () => {
    mockDeskSession(DESK_FLOW.DESK_TO_PSTN);
    mockExtensionFind.mockResolvedValue({
      id: 'ext-1',
      security: { internationalEnabled: false, callingPermissions: { international: false } },
    });
    vi.spyOn(deskResolver, 'resolveDeskDestination').mockResolvedValue({
      destination: { pstnNumber: '+442071234567', dialTo: '+442071234567' },
      destinationType: 'PSTN',
      routingFlow: DESK_FLOW.DESK_TO_PSTN,
      targetExtension: null,
      error: null,
    });

    const enqueueSpy = vi.spyOn(commandBus, 'enqueueIntents').mockResolvedValue([]);
    const result = await deskRouter.routeDeskSession(baseDomainEvent('desk', DOMAIN_EVENTS.DESK_ROUTE_COMPLETED));

    expect(result.ok).toBe(true);
    expect(eventBus.replay({ eventType: DOMAIN_EVENTS.DESK_ROUTE_DENIED }).length).toBeGreaterThan(0);
    const commands = enqueueSpy.mock.calls[0][0] as Array<{ commandType: string }>;
    expect(commands.filter((c) => c.commandType === 'REJECT')).toHaveLength(1);
  });

  it('Forward generates FORWARD intent when policy forwards', async () => {
    mockPstnSession(PSTN_FLOW.PSTN_TO_DESK);
    const pstnPolicy = require('../../../lib/telephony-v3/Routing/pstnPolicy');
    vi.spyOn(pstnPolicy, 'evaluatePstnPolicy').mockResolvedValue({
      action: 'FORWARD',
      effectiveAction: 'FORWARD',
      enforced: true,
      observeOnly: false,
      allowed: true,
      reason: 'call_forward',
      rules: [],
      targets: [{ phone: '+15559998888' }],
    });

    const enqueueSpy = vi.spyOn(commandBus, 'enqueueIntents').mockResolvedValue([]);
    await pstnRouter.routePstnSession(baseDomainEvent('pstn', DOMAIN_EVENTS.PSTN_ROUTE_COMPLETED));

    const commands = enqueueSpy.mock.calls[0]?.[0] as Array<{ commandType: string }> | undefined;
    expect(commands?.some((c) => c.commandType === 'FORWARD')).toBe(true);
  });

  it('Unknown destination generates SPEAK + HANGUP', async () => {
    mockDeskSession(DESK_FLOW.UNKNOWN);
    vi.spyOn(deskResolver, 'resolveDeskDestination').mockResolvedValue({
      destination: null,
      destinationType: 'UNKNOWN',
      routingFlow: DESK_FLOW.UNKNOWN,
      targetExtension: null,
      error: 'unknown_destination',
    });

    const enqueueSpy = vi.spyOn(commandBus, 'enqueueIntents').mockResolvedValue([]);
    await deskRouter.routeDeskSession(baseDomainEvent('desk', DOMAIN_EVENTS.DESK_ROUTE_COMPLETED));

    const commands = enqueueSpy.mock.calls[0][0] as Array<{ commandType: string }>;
    expect(commands.map((c) => c.commandType)).toEqual(['SPEAK', 'HANGUP']);
  });
});

describe('Phase 3.4.5 E2E Integration — FSM Lifecycle', () => {
  it('walks canonical session path to ENDED without orphan legs', () => {
    const { finalSession, finalLeg, history } = simulateCanonicalSessionLifecycle(stateMachine);

    expect(finalSession.state).toBe('ENDED');
    expect(finalLeg.state).toBe('ENDED');
    expect(history.some((h) => h.session === 'ORIGIN_PARKED')).toBe(true);
    expect(history.some((h) => h.session === 'ROUTING')).toBe(true);
    expect(history.some((h) => h.session === 'RINGING')).toBe(true);
    expect(history.some((h) => h.session === 'BRIDGING')).toBe(true);
    expect(history.some((h) => h.session === 'ACTIVE')).toBe(true);
    // ENDING may collapse into session.closed within the same applyWithCompletion step
    expect(history.some((h) => h.session === 'ENDING') || finalSession.state === 'ENDED').toBe(true);
  });

  it('does not leave session in non-terminal state after hangup completion', () => {
    const { finalSession } = simulateCanonicalSessionLifecycle(stateMachine);
    expect(['ENDED', 'FAILED']).toContain(finalSession.state);
  });
});

describe('Phase 3.4.5 E2E Integration — Command Pipeline', () => {
  beforeEach(() => {
    resetIntegrationHarness();
    metrics.resetMetricsForTests();
    vi.clearAllMocks();
    setupPrismaMocks();
    setupOutboxPipeline();
    mockFindLeg.mockResolvedValue({ id: 'leg-1', callControlId: 'cc-1' });
    mockFindSession.mockResolvedValue({
      id: 'sess-pipe',
      tenantId: 'tenant-1',
      correlationId: 'corr-pipe',
      primaryCallControlId: 'cc-1',
    });
    vi.spyOn(commandOutbox, 'recordCommandExecutionStarted').mockResolvedValue({});
    vi.spyOn(commandOutbox, 'completeCommand').mockResolvedValue({ id: 'cmd-1', status: 'ACKED' });
  });

  afterEach(() => {
    prisma.__resetGetPrismaForTests();
    vi.restoreAllMocks();
  });

  it('executes CommandBus → Outbox → Executor → Adapter exactly once per intent', async () => {
    eventBus.resetForTests();

    await commandBus.enqueueIntent({
      sessionId: 'sess-pipe',
      legId: 'leg-1',
      tenantId: 'tenant-1',
      correlationId: 'corr-pipe',
      commandType: 'HANGUP',
      targetCallControlId: 'cc-1',
      reason: 'integration_test',
      payload: { phase: '3.4.5' },
      sequence: 0,
    });

    expect(outboxStore.size).toBe(1);

    const duplicate = await commandBus.enqueueIntent({
      sessionId: 'sess-pipe',
      legId: 'leg-1',
      commandType: 'HANGUP',
      targetCallControlId: 'cc-1',
      reason: 'integration_test',
      payload: { phase: '3.4.5' },
      sequence: 0,
    });

    expect(outboxStore.size).toBe(1);
    expect(duplicate.id).toBe('cmd-1');

    const telnyx = {
      hangupCall: vi.fn().mockResolvedValue({ id: 'telnyx-req-1' }),
    };

    const row = outboxStore.get('sess-pipe:HANGUP:cc-1:0')!;
    const outcome = await commandExecutor.executeOneCommand(row, 'worker-integration', { telnyx });

    expect(outcome.ok).toBe(true);
    expect(telnyx.hangupCall).toHaveBeenCalledTimes(1);

    const events = eventBus.replay({ sessionId: 'sess-pipe' });
    expect(events.some((e) => e.eventType === DOMAIN_EVENTS.COMMAND_ENQUEUED)).toBe(true);
    expect(events.some((e) => e.eventType === DOMAIN_EVENTS.COMMAND_STARTED)).toBe(true);
    expect(events.some((e) => e.eventType === DOMAIN_EVENTS.COMMAND_COMPLETED)).toBe(true);
  });
});

describe('Phase 3.4.5 E2E Integration — Failure Recovery', () => {
  beforeEach(() => {
    resetIntegrationHarness();
    vi.clearAllMocks();
    setupPrismaMocks();
    mockFindUnique.mockResolvedValue({ routeSnapshot: null });
    mockUpdateMany.mockResolvedValue({ count: 1 });
    mockTenantFind.mockResolvedValue({ id: 'tenant-1', timezone: 'America/New_York' });
    mockExtensionFind.mockResolvedValue({ id: 'ext-1', security: null });
    vi.spyOn(featureFlags, 'getTenantFlags').mockResolvedValue({
      deskEnabled: true,
      mobileEnabled: true,
      pstnEnabled: true,
      observeOnly: false,
      engineEnabled: true,
    });
  });

  afterEach(() => {
    prisma.__resetGetPrismaForTests();
    vi.restoreAllMocks();
  });

  it('duplicate webhook event is idempotent at router layer', async () => {
    mockDeskSession(DESK_FLOW.DESK_TO_DESK);
    vi.spyOn(commandBus, 'enqueueIntents').mockResolvedValue([]);
    const event = baseDomainEvent('desk', DOMAIN_EVENTS.DESK_ROUTE_COMPLETED);

    await deskRouter.routeDeskSession(event);
    const dup = await deskRouter.routeDeskSession({ ...event, eventId: event.eventId });

    expect(dup.skipped).toBe(true);
    expect(dup.reason).toBe('duplicate_event');
  });

  it('executor retry marks retryable failures without duplicate Telnyx calls in one attempt', async () => {
    setupOutboxPipeline();
    mockFindLeg.mockResolvedValue({ id: 'leg-1', callControlId: 'cc-1' });
    mockFindSession.mockResolvedValue({ id: 'sess-1', tenantId: 'tenant-1', correlationId: 'c1', primaryCallControlId: 'cc-1' });
    vi.spyOn(commandOutbox, 'recordCommandExecutionStarted').mockResolvedValue({});
    vi.spyOn(commandOutbox, 'markCommandExecutionFailed').mockResolvedValue({ id: 'cmd-1', status: 'FAILED' });

    const telnyx = {
      hangupCall: vi.fn().mockRejectedValue(Object.assign(new Error('503'), { status: 503 })),
    };

    const outcome = await commandExecutor.executeOneCommand({
      id: 'cmd-1',
      sessionId: 'sess-1',
      legId: 'leg-1',
      commandType: 'HANGUP',
      attempts: 0,
      maxAttempts: 5,
      payload: {},
    }, 'worker-restart', { telnyx });

    expect(outcome.ok).toBe(false);
    expect(telnyx.hangupCall).toHaveBeenCalledTimes(1);
    expect(commandOutbox.markCommandExecutionFailed).toHaveBeenCalledWith('cmd-1', 'worker-restart', expect.objectContaining({ retryable: true }));
  });

  it('outbox replay returns same row for duplicate idempotency key', async () => {
    setupOutboxPipeline();
    const first = await commandOutbox.enqueueCommand({
      sessionId: 'sess-1',
      legId: 'leg-1',
      commandType: 'ANSWER',
      idempotencyKey: 'sess-1:ANSWER:cc-1:0',
      payload: {},
    });
    const second = await commandOutbox.enqueueCommand({
      sessionId: 'sess-1',
      legId: 'leg-1',
      commandType: 'ANSWER',
      idempotencyKey: 'sess-1:ANSWER:cc-1:0',
      payload: {},
    });

    expect(second.id).toBe(first.id);
    expect(outboxStore.size).toBe(1);
  });
});

describe('Phase 3.4.5 E2E Integration — Tenant Isolation', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('rejects cross-tenant routing at desk router layer', async () => {
    resetIntegrationHarness();
    setupPrismaMocks();
    mockFindUnique.mockResolvedValue({ routeSnapshot: null });
    mockUpdateMany.mockResolvedValue({ count: 1 });
    mockTenantFind.mockResolvedValue({ id: 'tenant-1', timezone: 'America/New_York' });
    vi.spyOn(featureFlags, 'getTenantFlags').mockResolvedValue({
      deskEnabled: true,
      observeOnly: false,
      engineEnabled: true,
    });
    vi.spyOn(commandBus, 'enqueueIntents').mockResolvedValue([]);

    mockDeskSession(DESK_FLOW.DESK_TO_DESK);
    vi.spyOn(deskResolver, 'resolveDeskCaller').mockResolvedValue({
      caller: null,
      error: 'tenant_isolation_violation',
    });

    const result = await deskRouter.routeDeskSession(baseDomainEvent('desk', DOMAIN_EVENTS.DESK_ROUTE_COMPLETED));
    expect(result.ok).toBe(false);
    expect(eventBus.replay({ eventType: DOMAIN_EVENTS.DESK_ROUTE_FAILED }).length).toBeGreaterThan(0);

    prisma.__resetGetPrismaForTests();
    vi.restoreAllMocks();
  });

  it('pstn resolver scopes DID lookup to tenant', async () => {
    const mockFind = vi.fn().mockResolvedValue(null);
    const mockPrisma = {
      phoneNumber: { findFirst: mockFind },
      tenant: { findUnique: vi.fn().mockResolvedValue(null) },
      greeting: { findUnique: vi.fn().mockResolvedValue(null) },
    };
    prisma.__setGetPrismaForTests(async () => mockPrisma);

    const { resolveDidOwnership } = require('../../../lib/telephony-v3/Routing/pstnResolver');
    const result = await resolveDidOwnership(mockPrisma, 'tenant-1', '+15559876543');

    expect(result.error).toBe('unknown_did');
    expect(mockFind).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenantId: 'tenant-1' }),
      }),
    );

    prisma.__resetGetPrismaForTests();
  });
});

describe('Phase 3.4.5 E2E Integration — Rollback Validation', () => {
  beforeEach(() => {
    resetIntegrationHarness();
    vi.clearAllMocks();
    setupPrismaMocks();
    mockFindUnique.mockResolvedValue({ routeSnapshot: null });
    mockUpdateMany.mockResolvedValue({ count: 1 });
    mockTenantFind.mockResolvedValue({ id: 'tenant-1', timezone: 'America/New_York' });
    mockExtensionFind.mockResolvedValue({ id: 'ext-1', security: null });
    vi.spyOn(commandBus, 'enqueueIntents').mockResolvedValue([]);
  });

  afterEach(() => {
    prisma.__resetGetPrismaForTests();
    vi.restoreAllMocks();
    delete process.env.TELEPHONY_V3_EXECUTOR_ENABLED;
    delete process.env.TELEPHONY_V3_CALLMANAGER_ENABLED;
  });

  it('deskEnabled=false skips desk routing', async () => {
    vi.spyOn(featureFlags, 'getTenantFlags').mockResolvedValue({
      deskEnabled: false,
      mobileEnabled: true,
      pstnEnabled: true,
      observeOnly: true,
      engineEnabled: true,
    });
    mockDeskSession(DESK_FLOW.DESK_TO_DESK);

    const result = await deskRouter.routeDeskSession(baseDomainEvent('desk', DOMAIN_EVENTS.DESK_ROUTE_COMPLETED));
    expect(result.skipped).toBe(true);
    expect(result.reason).toBe('desk_disabled');
    expect(commandBus.enqueueIntents).not.toHaveBeenCalled();
  });

  it('mobileEnabled=false skips mobile routing', async () => {
    vi.spyOn(featureFlags, 'getTenantFlags').mockResolvedValue({
      deskEnabled: true,
      mobileEnabled: false,
      pstnEnabled: true,
      observeOnly: true,
      engineEnabled: true,
    });
    mockMobileSession(MOBILE_FLOW.MOBILE_TO_MOBILE);

    const result = await mobileRouter.routeMobileSession(baseDomainEvent('mobile', DOMAIN_EVENTS.MOBILE_ROUTE_COMPLETED));
    expect(result.skipped).toBe(true);
    expect(result.reason).toBe('mobile_disabled');
  });

  it('pstnEnabled=false skips pstn routing', async () => {
    vi.spyOn(featureFlags, 'getTenantFlags').mockResolvedValue({
      deskEnabled: true,
      mobileEnabled: true,
      pstnEnabled: false,
      observeOnly: true,
      engineEnabled: true,
    });
    mockPstnSession(PSTN_FLOW.PSTN_TO_DESK);

    const result = await pstnRouter.routePstnSession(baseDomainEvent('pstn', DOMAIN_EVENTS.PSTN_ROUTE_COMPLETED));
    expect(result.skipped).toBe(true);
    expect(result.reason).toBe('pstn_disabled');
  });

  it('observeOnly=true evaluates policy but does not enqueue commands', async () => {
    vi.spyOn(featureFlags, 'getTenantFlags').mockResolvedValue({
      deskEnabled: true,
      mobileEnabled: true,
      pstnEnabled: true,
      observeOnly: true,
      engineEnabled: true,
    });
    mockDeskSession(DESK_FLOW.DESK_TO_DESK);

    await deskRouter.routeDeskSession(baseDomainEvent('desk', DOMAIN_EVENTS.DESK_ROUTE_COMPLETED));
    expect(commandBus.enqueueIntents).not.toHaveBeenCalled();
  });

  it('TELEPHONY_V3_EXECUTOR_ENABLED=false uses stub outbox tick path', async () => {
    process.env.TELEPHONY_V3_EXECUTOR_ENABLED = 'false';
    const { runOutboxWorkerTick } = require('../../../lib/telephony-v3/Workers/ingressWorker');
    vi.spyOn(commandOutbox, 'claimPendingCommands').mockResolvedValue([{ id: 'cmd-1', commandType: 'HANGUP' }]);
    vi.spyOn(commandOutbox, 'markCommandSent').mockResolvedValue({ id: 'cmd-1' });
    vi.spyOn(commandOutbox, 'acknowledgeCommand').mockResolvedValue({ id: 'cmd-1', status: 'ACKED' });
    vi.spyOn(commandExecutor, 'processCommandBatch').mockResolvedValue({ processed: 0 });

    const result = await runOutboxWorkerTick('worker-rollback');
    expect(result.processed).toBe(1);
    expect(commandExecutor.processCommandBatch).not.toHaveBeenCalled();
  });
});

describe('Phase 3.4.5 E2E Integration — Observability', () => {
  beforeEach(() => {
    resetIntegrationHarness();
    metrics.resetMetricsForTests();
    vi.clearAllMocks();
    setupPrismaMocks();
    mockFindUnique.mockResolvedValue({ routeSnapshot: null });
    mockUpdateMany.mockResolvedValue({ count: 1 });
    mockTenantFind.mockResolvedValue({ id: 'tenant-1', timezone: 'America/New_York' });
    mockExtensionFind.mockResolvedValue({ id: 'ext-1', security: null });
    vi.spyOn(featureFlags, 'getTenantFlags').mockResolvedValue({
      deskEnabled: true,
      mobileEnabled: true,
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

  it('records routing metrics for all three modules', async () => {
    mockDeskSession(DESK_FLOW.DESK_TO_DESK);
    mockMobileSession(MOBILE_FLOW.MOBILE_TO_MOBILE);
    mockPstnSession(PSTN_FLOW.PSTN_TO_DESK);

    await deskRouter.routeDeskSession(baseDomainEvent('desk', DOMAIN_EVENTS.DESK_ROUTE_COMPLETED));
    await mobileRouter.routeMobileSession(baseDomainEvent('mobile', DOMAIN_EVENTS.MOBILE_ROUTE_COMPLETED));
    await pstnRouter.routePstnSession(baseDomainEvent('pstn', DOMAIN_EVENTS.PSTN_ROUTE_COMPLETED));

    const prom = await metrics.renderPrometheus();
    expect(prom).toContain('desk_route_total');
    expect(prom).toContain('mobile_route_total');
    expect(prom).toContain('pstn_route_total');
    expect(prom).toContain('domain_event_published_total');
  });

  it('propagates correlationId through domain events', async () => {
    mockDeskSession(DESK_FLOW.DESK_TO_DESK);
    await deskRouter.routeDeskSession(baseDomainEvent('desk', DOMAIN_EVENTS.DESK_ROUTE_COMPLETED));

    const events = eventBus.replay({ sessionId: 'sess-desk' });
    expect(events.length).toBeGreaterThan(0);
    expect(events.every((e) => e.correlationId === 'corr-integration')).toBe(true);
  });
});
