import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const locks = require('../../lib/telephony-v3/Redis/locks');
const sessionManager = require('../../lib/telephony-v3/Sessions/sessionManager');
const legManager = require('../../lib/telephony-v3/Sessions/legManager');
const callPersistence = require('../../lib/telephony-v3/Sessions/callPersistence');
const policyEngine = require('../../lib/telephony-v3/Policy/policyEngine');
const commandBus = require('../../lib/telephony-v3/Commands/commandBus');
const eventBus = require('../../lib/telephony-v3/Events/domainEventBus');
const callManager = require('../../lib/telephony-v3/CallManager/callManager');

describe('V3 CallManager', () => {
  beforeEach(() => {
    vi.spyOn(locks, 'withSessionLock').mockImplementation(async (_id, fn) => fn());
    vi.spyOn(locks, 'withBootstrapLock').mockImplementation(async (_id, fn) => fn());
    vi.spyOn(policyEngine, 'evaluate').mockResolvedValue({ allowed: true, observeOnly: true, rules: [] });
    vi.spyOn(commandBus, 'publishEnqueuedCommands').mockResolvedValue(undefined);
    vi.spyOn(eventBus, 'publish').mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    eventBus.resetForTests();
  });

  it('creates session and leg on call.initiated', async () => {
    let legLookups = 0;
    vi.spyOn(legManager, 'findLegByCallControlId').mockImplementation(async () => {
      legLookups += 1;
      if (legLookups <= 2) return null;
      return {
        id: 'leg-new',
        sessionId: 'sess-new',
        callControlId: 'cc-1',
        role: 'ORIGIN',
        state: 'NEW',
        version: 0,
      };
    });
    vi.spyOn(sessionManager, 'findOrCreateSession').mockResolvedValue({
      session: {
        id: 'sess-new',
        tenantId: 'tenant-a',
        state: 'NEW',
        correlationId: 'corr-1',
        version: 0,
        legs: [],
      },
      created: true,
    });
    vi.spyOn(legManager, 'findOrCreateLeg').mockResolvedValue({
      leg: {
        id: 'leg-new',
        sessionId: 'sess-new',
        callControlId: 'cc-1',
        role: 'ORIGIN',
        state: 'NEW',
        version: 0,
      },
      created: true,
    });
    vi.spyOn(sessionManager, 'loadSession').mockResolvedValue({
      id: 'sess-new',
      tenantId: 'tenant-a',
      state: 'NEW',
      correlationId: 'corr-1',
      version: 0,
      legs: [],
    });
    vi.spyOn(callPersistence, 'persistCallFsmResult').mockResolvedValue({
      session: {
        id: 'sess-new',
        tenantId: 'tenant-a',
        state: 'ORIGIN_PARKED',
        correlationId: 'corr-1',
        version: 1,
      },
      leg: {
        id: 'leg-new',
        sessionId: 'sess-new',
        callControlId: 'cc-1',
        role: 'ORIGIN',
        state: 'DIALING',
        version: 1,
      },
      commandRows: [],
      duplicate: false,
    });

    const result = await callManager.processIngressEvent({
      normalized: {
        telnyxEventId: 'evt-init',
        eventType: 'call.initiated',
        callControlId: 'cc-1',
        callSessionId: 'ts-1',
        direction: 'outgoing',
        state: 'parked',
        from: '+1',
        to: '+2',
        connectionId: 'conn-1',
        correlationId: 'corr-1',
        raw: { body: { data: { payload: { client_state: JSON.stringify({ tenantId: 'tenant-a' }) } } } },
      },
      workerId: 'worker-1',
      ingressId: 'ingress-1',
    });

    expect(sessionManager.findOrCreateSession).toHaveBeenCalled();
    expect(legManager.findOrCreateLeg).toHaveBeenCalled();
    expect(result.handled).toBe(true);
    expect(result.sessionId).toBe('sess-new');
  });

  it('applies FSM and enqueues bridge intent on call.answered', async () => {
    vi.spyOn(legManager, 'findLegByCallControlId').mockResolvedValue({
      id: 'leg-1',
      sessionId: 'sess-1',
      callControlId: 'cc-1',
      role: 'ORIGIN',
      state: 'RINGING',
      version: 1,
    });
    vi.spyOn(sessionManager, 'loadSession').mockResolvedValue({
      id: 'sess-1',
      tenantId: 'tenant-a',
      state: 'RINGING',
      correlationId: 'corr-1',
      version: 1,
      legs: [],
    });
    vi.spyOn(callPersistence, 'persistCallFsmResult').mockResolvedValue({
      session: {
        id: 'sess-1',
        tenantId: 'tenant-a',
        state: 'BRIDGING',
        correlationId: 'corr-1',
        version: 2,
      },
      leg: {
        id: 'leg-1',
        sessionId: 'sess-1',
        callControlId: 'cc-1',
        role: 'ORIGIN',
        state: 'ANSWERED',
        version: 2,
      },
      commandRows: [{ id: 'cmd-1', commandType: 'BRIDGE' }],
      duplicate: false,
    });

    const result = await callManager.processIngressEvent({
      normalized: {
        telnyxEventId: 'evt-ans',
        eventType: 'call.answered',
        callControlId: 'cc-1',
        callSessionId: 'ts-1',
        direction: 'outgoing',
        state: null,
        from: '+1',
        to: '+2',
        connectionId: null,
        correlationId: 'corr-1',
        raw: {},
      },
      workerId: 'worker-1',
      ingressId: 'ingress-2',
    });

    expect(result.handled).toBe(true);
    expect(result.sessionState).toBe('BRIDGING');
    expect(result.legState).toBe('ANSWERED');
    expect(callPersistence.persistCallFsmResult).toHaveBeenCalledWith(
      expect.objectContaining({
        commandIntents: expect.arrayContaining([expect.objectContaining({ commandType: 'BRIDGE' })]),
      }),
    );
    expect(commandBus.publishEnqueuedCommands).toHaveBeenCalled();
  });

  it('returns unhandled when no session exists for non-initiated event', async () => {
    vi.spyOn(legManager, 'findLegByCallControlId').mockResolvedValue(null);

    const result = await callManager.processIngressEvent({
      normalized: {
        telnyxEventId: 'evt-miss',
        eventType: 'call.answered',
        callControlId: 'cc-unknown',
        callSessionId: null,
        direction: null,
        state: null,
        from: null,
        to: null,
        connectionId: null,
        correlationId: 'corr-1',
        raw: {},
      },
      workerId: 'worker-1',
      ingressId: 'ingress-3',
    });

    expect(result.handled).toBe(false);
    expect(result.reason).toBe('no_session_or_leg');
  });

  it('extracts tenantId from client_state', () => {
    const tenantId = callManager.extractTenantId({
      raw: { body: { data: { payload: { client_state: JSON.stringify({ tenant_id: 't-99' }) } } } },
    });
    expect(tenantId).toBe('t-99');
  });
});
