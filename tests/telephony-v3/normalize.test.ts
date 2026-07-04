import { describe, expect, it } from 'vitest';

const { normalizeTelnyxWebhook, validateWebhookPayload } = require('../../lib/telephony-v3/WebhookGateway/normalize');

describe('V3 webhook normalize', () => {
  it('normalizes Telnyx call.initiated payload', () => {
    const body = {
      data: {
        id: 'evt-123',
        event_type: 'call.initiated',
        payload: {
          call_control_id: 'v3:leg-a',
          call_session_id: 'sess-1',
          direction: 'outgoing',
          state: 'parked',
          from: 'sip:alice@sip.telnyx.com',
          to: '101',
          connection_id: 'conn-1',
        },
      },
    };
    const n = normalizeTelnyxWebhook(body, { source: 'test' });
    expect(n.telnyxEventId).toBe('evt-123');
    expect(n.eventType).toBe('call.initiated');
    expect(n.callControlId).toBe('v3:leg-a');
    expect(n.callSessionId).toBe('sess-1');
    expect(n.correlationId).toBe('sess-1');
    expect(n.direction).toBe('outgoing');
    expect(n.state).toBe('parked');
  });

  it('validates minimum webhook shape', () => {
    expect(validateWebhookPayload(null).valid).toBe(false);
    expect(validateWebhookPayload({ data: {} }).valid).toBe(true);
    expect(validateWebhookPayload({}).valid).toBe(false);
  });
});
