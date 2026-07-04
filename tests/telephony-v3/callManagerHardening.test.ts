import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const locks = require('../../lib/telephony-v3/Redis/locks');
const sessionManager = require('../../lib/telephony-v3/Sessions/sessionManager');
const legManager = require('../../lib/telephony-v3/Sessions/legManager');
const callPersistence = require('../../lib/telephony-v3/Sessions/callPersistence');
const policyEngine = require('../../lib/telephony-v3/Policy/policyEngine');
const commandBus = require('../../lib/telephony-v3/Commands/commandBus');
const eventBus = require('../../lib/telephony-v3/Events/domainEventBus');
const callManager = require('../../lib/telephony-v3/CallManager/callManager');
const { V3ConflictError } = require('../../lib/telephony-v3/errors');

describe('V3 CallManager hardening (Phase 2.6)', () => {
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

  it('uses findOrCreate under bootstrap lock for concurrent call.initiated', async () => {
    let legLookups = 0;
    vi.spyOn(legManager, 'findLegByCallControlId').mockImplementation(async () => {
      legLookups += 1;
      if (legLookups <= 2) return null;
      return {
        id: 'leg-1',
        sessionId: 'sess-1',
        callControlId: 'cc-1',
        role: 'ORIGIN',
        state: 'NEW',
        version: 0,
      };
    });
    vi.spyOn(sessionManager, 'findOrCreateSession').mockResolvedValue({
      session: {
        id: 'sess-1',
        tenantId: 't1',
        state: 'NEW',
        correlationId: 'c1',
        version: 0,
        legs: [],
      },
      created: true,
    });
    vi.spyOn(legManager, 'findOrCreateLeg').mockResolvedValue({
      leg: {
        id: 'leg-1',
        sessionId: 'sess-1',
        callControlId: 'cc-1',
        role: 'ORIGIN',
        state: 'NEW',
        version: 0,
      },
      created: true,
    });
    vi.spyOn(sessionManager, 'loadSession').mockResolvedValue({
      id: 'sess-1',
      tenantId: 't1',
      state: 'NEW',
      correlationId: 'c1',
      version: 0,
      legs: [{ id: 'leg-1', sessionId: 'sess-1', callControlId: 'cc-1', role: 'ORIGIN', state: 'NEW', version: 0 }],
    });
    vi.spyOn(callPersistence, 'persistCallFsmResult').mockResolvedValue({
      session: { id: 'sess-1', tenantId: 't1', state: 'ORIGIN_PARKED', correlationId: 'c1', version: 1 },
      leg: { id: 'leg-1', sessionId: 'sess-1', callControlId: 'cc-1', role: 'ORIGIN', state: 'DIALING', version: 1 },
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
        correlationId: 'c1',
        raw: {
          body: {
            data: {
              payload: {
                client_state: JSON.stringify({ tenantId: 't1' }),
              },
            },
          },
        },
      },
      workerId: 'worker-1',
      ingressId: 'ingress-1',
    });

    expect(locks.withBootstrapLock).toHaveBeenCalled();
    expect(sessionManager.findOrCreateSession).toHaveBeenCalled();
    expect(legManager.findOrCreateLeg).toHaveBeenCalled();
    expect(result.handled).toBe(true);
  });

  it('reloads existing leg on duplicate leg creation (H6)', async () => {
    let legLookups = 0;
    vi.spyOn(legManager, 'findLegByCallControlId').mockImplementation(async () => {
      legLookups += 1;
      if (legLookups <= 2) return null;
      return {
        id: 'leg-existing',
        sessionId: 'sess-existing',
        callControlId: 'cc-dup',
        role: 'ORIGIN',
        state: 'NEW',
        version: 0,
      };
    });
    vi.spyOn(sessionManager, 'findOrCreateSession').mockResolvedValue({
      session: {
        id: 'sess-existing',
        tenantId: 't1',
        state: 'NEW',
        correlationId: 'c1',
        version: 0,
        legs: [],
      },
      created: false,
    });
    vi.spyOn(legManager, 'findOrCreateLeg').mockResolvedValue({
      leg: {
        id: 'leg-existing',
        sessionId: 'sess-existing',
        callControlId: 'cc-dup',
        role: 'ORIGIN',
        state: 'NEW',
        version: 0,
      },
      created: false,
    });
    vi.spyOn(sessionManager, 'loadSession').mockResolvedValue({
      id: 'sess-existing',
      tenantId: 't1',
      state: 'NEW',
      correlationId: 'c1',
      version: 0,
      legs: [],
    });
    vi.spyOn(callPersistence, 'persistCallFsmResult').mockResolvedValue({
      session: { id: 'sess-existing', state: 'ORIGIN_PARKED', version: 1 },
      leg: { id: 'leg-existing', state: 'DIALING', version: 1 },
      commandRows: [],
      duplicate: false,
    });

    await callManager.processIngressEvent({
      normalized: {
        telnyxEventId: 'evt-dup',
        eventType: 'call.initiated',
        callControlId: 'cc-dup',
        callSessionId: 'ts-dup',
        direction: 'outgoing',
        state: 'parked',
        from: null,
        to: null,
        connectionId: null,
        correlationId: 'c1',
        raw: {
          body: {
            data: {
              payload: {
                client_state: JSON.stringify({ tenantId: 't1' }),
              },
            },
          },
        },
      },
      workerId: 'worker-1',
      ingressId: 'ingress-dup',
    });

    expect(legManager.findOrCreateLeg).toHaveBeenCalled();
  });

  it('retries on V3ConflictError and succeeds (H3)', async () => {
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
      tenantId: 't1',
      state: 'RINGING',
      correlationId: 'c1',
      version: 1,
      legs: [{ id: 'leg-1', sessionId: 'sess-1', callControlId: 'cc-1', role: 'ORIGIN', state: 'RINGING', version: 1 }],
    });

    vi.spyOn(callPersistence, 'persistCallFsmResult')
      .mockRejectedValueOnce(new V3ConflictError('Session version conflict'))
      .mockResolvedValueOnce({
        session: { id: 'sess-1', tenantId: 't1', state: 'BRIDGING', correlationId: 'c1', version: 2 },
        leg: { id: 'leg-1', sessionId: 'sess-1', callControlId: 'cc-1', role: 'ORIGIN', state: 'ANSWERED', version: 2 },
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
        from: null,
        to: null,
        connectionId: null,
        correlationId: 'c1',
        raw: {},
      },
      workerId: 'worker-1',
      ingressId: 'ingress-ans',
    });

    expect(callPersistence.persistCallFsmResult).toHaveBeenCalledTimes(2);
    expect(result.sessionState).toBe('BRIDGING');
  });

  it('session reaches ENDED after hangup via atomic persist (H1)', async () => {
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
      tenantId: 't1',
      state: 'RINGING',
      correlationId: 'c1',
      version: 1,
      legs: [{ id: 'leg-1', sessionId: 'sess-1', callControlId: 'cc-1', role: 'ORIGIN', state: 'RINGING', version: 1 }],
    });

    const persistSpy = vi.spyOn(callPersistence, 'persistCallFsmResult').mockImplementation(async (input) => {
      expect(input.sessionTransitions.some((t) => t.transition.toState === 'ENDING')).toBe(true);
      expect(input.sessionTransitions.some((t) => t.transition.toState === 'ENDED')).toBe(true);
      expect(input.legWrite?.transition.toState).toBe('ENDED');
      expect(input.commandIntents.some((i) => i.commandType === 'HANGUP')).toBe(true);
      return {
        session: { id: 'sess-1', tenantId: 't1', state: 'ENDED', correlationId: 'c1', version: 3 },
        leg: { id: 'leg-1', sessionId: 'sess-1', callControlId: 'cc-1', role: 'ORIGIN', state: 'ENDED', version: 2 },
        commandRows: [{ id: 'cmd-h', commandType: 'HANGUP', idempotencyKey: 'sess-1:HANGUP:evt-hang:cc-1:0' }],
        duplicate: false,
      };
    });

    const result = await callManager.processIngressEvent({
      normalized: {
        telnyxEventId: 'evt-hang',
        eventType: 'call.hangup',
        callControlId: 'cc-1',
        callSessionId: 'ts-1',
        direction: 'outgoing',
        state: null,
        from: null,
        to: null,
        connectionId: null,
        correlationId: 'c1',
        raw: {},
      },
      workerId: 'worker-1',
      ingressId: 'ingress-hang',
    });

    expect(persistSpy).toHaveBeenCalled();
    expect(result.sessionState).toBe('ENDED');
    expect(commandBus.publishEnqueuedCommands).toHaveBeenCalled();
  });

  it('skips duplicate domain events when persist returns duplicate flag', async () => {
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
      state: 'RINGING',
      version: 1,
      legs: [],
    });
    vi.spyOn(callPersistence, 'persistCallFsmResult').mockResolvedValue({
      session: { id: 'sess-1', state: 'BRIDGING', version: 2 },
      leg: { id: 'leg-1', state: 'ANSWERED', version: 2 },
      commandRows: [],
      duplicate: true,
    });

    await callManager.processIngressEvent({
      normalized: {
        telnyxEventId: 'evt-dup2',
        eventType: 'call.answered',
        callControlId: 'cc-1',
        callSessionId: null,
        direction: null,
        state: null,
        from: null,
        to: null,
        connectionId: null,
        correlationId: 'c1',
        raw: {},
      },
      workerId: 'worker-1',
      ingressId: 'ingress-dup2',
    });

    expect(eventBus.publish).not.toHaveBeenCalled();
  });
});
