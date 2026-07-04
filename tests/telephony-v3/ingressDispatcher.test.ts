import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const sessionRepository = require('../../lib/telephony-v3/Session/sessionRepository');
const callManager = require('../../lib/telephony-v3/CallManager/callManager');
const streams = require('../../lib/telephony-v3/Redis/streams');
const { dispatchIngressJob } = require('../../lib/telephony-v3/Workers/ingressDispatcher');

describe('V3 IngressDispatcher (integration)', () => {
  beforeEach(() => {
    delete process.env.TELEPHONY_V3_CALLMANAGER_ENABLED;
    vi.spyOn(sessionRepository, 'loadSessionByCallControlId').mockResolvedValue({
      id: 'sess-abc',
      tenantId: 'tenant-1',
      state: 'NEW',
    });
  });

  afterEach(() => {
    delete process.env.TELEPHONY_V3_CALLMANAGER_ENABLED;
    vi.restoreAllMocks();
  });

  it('loads payload from payloadRef and resolves session', async () => {
    vi.spyOn(streams, 'loadIngressPayload').mockResolvedValue({
      data: {
        id: 'evt-1',
        event_type: 'call.initiated',
        payload: { call_control_id: 'leg-1', call_session_id: 'sess-abc' },
      },
    });

    const job = {
      id: '1700000000000-0',
      fields: {
        eventType: 'call.initiated',
        source: 'call-control',
        correlationId: 'corr-1',
        traceId: 'trace-1',
        payloadRef: 'abc123',
      },
    };

    const result = await dispatchIngressJob(job, { workerId: 'worker-test' });

    expect(result.sessionId).toBe('sess-abc');
    expect(streams.loadIngressPayload).toHaveBeenCalledWith('abc123');
  });

  it('rejects missing payloadRef payload', async () => {
    vi.spyOn(streams, 'loadIngressPayload').mockResolvedValue(null);

    const job = {
      id: '1700000000000-1',
      fields: { payloadRef: 'missing' },
    };

    await expect(dispatchIngressJob(job, { workerId: 'worker-test' })).rejects.toThrow(
      'Ingress payload missing',
    );
  });

  it('delegates to CallManager when TELEPHONY_V3_CALLMANAGER_ENABLED=true', async () => {
    process.env.TELEPHONY_V3_CALLMANAGER_ENABLED = 'true';
    vi.spyOn(callManager, 'isCallManagerEnabled').mockReturnValue(true);
    vi.spyOn(callManager, 'processIngressEvent').mockResolvedValue({
      handled: true,
      sessionId: 'sess-cm',
      legId: 'leg-cm',
    });
    vi.spyOn(streams, 'loadIngressPayload').mockResolvedValue({
      data: {
        id: 'evt-cm',
        event_type: 'call.answered',
        payload: { call_control_id: 'cc-1' },
      },
    });

    const job = {
      id: '1700000000000-2',
      fields: {
        eventType: 'call.answered',
        source: 'call-control',
        correlationId: 'corr-cm',
        payloadRef: 'ref-cm',
      },
    };

    const result = await dispatchIngressJob(job, { workerId: 'worker-cm' });

    expect(callManager.processIngressEvent).toHaveBeenCalled();
    expect(result.sessionId).toBe('sess-cm');
    expect(result.handled).toBe(true);
  });
});
