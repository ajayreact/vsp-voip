import { describe, expect, it, beforeEach } from 'vitest';

const {
  extractTelnyxEventId,
  evaluateTelnyxWebhookDedup,
  resetTelnyxWebhookDedupMemoryForTests,
  shouldDedupEventType,
} = require('../../lib/telnyxWebhookDedup');

function sampleBody(eventType: string, eventId: string) {
  return {
    data: {
      id: eventId,
      event_type: eventType,
      payload: { call_control_id: 'v3:test-call' },
    },
    meta: { attempt: 1, delivered_to: 'https://example.com/webhook/call-control' },
  };
}

describe('telnyx webhook deduplication', () => {
  beforeEach(() => {
    resetTelnyxWebhookDedupMemoryForTests();
  });

  it('extracts data.id as event identifier', () => {
    expect(extractTelnyxEventId(sampleBody('call.initiated', 'evt-1'))).toBe('evt-1');
    expect(extractTelnyxEventId({ data: { event_type: 'call.hangup' } })).toBeNull();
    expect(extractTelnyxEventId(null)).toBeNull();
  });

  it('deduplicates call lifecycle events by event id', async () => {
    const body = sampleBody('call.answered', 'evt-dup-1');
    const first = await evaluateTelnyxWebhookDedup(body, { source: 'call-control' });
    const second = await evaluateTelnyxWebhookDedup(body, { source: 'voice' });

    expect(first.process).toBe(true);
    expect(first.duplicate).toBe(false);
    expect(second.process).toBe(false);
    expect(second.duplicate).toBe(true);
    expect(second.reason).toBe('duplicate_event_id');
  });

  it('allows distinct event ids for the same call', async () => {
    const a = await evaluateTelnyxWebhookDedup(sampleBody('call.initiated', 'evt-a'), {
      source: 'call-control',
    });
    const b = await evaluateTelnyxWebhookDedup(sampleBody('call.answered', 'evt-b'), {
      source: 'call-control',
    });

    expect(a.process).toBe(true);
    expect(b.process).toBe(true);
  });

  it('passes through payloads without data.id', async () => {
    const body = { CallSid: 'legacy-texml', CallStatus: 'completed' };
    const first = await evaluateTelnyxWebhookDedup(body, { source: 'call-control' });
    const second = await evaluateTelnyxWebhookDedup(body, { source: 'call-control' });

    expect(first.process).toBe(true);
    expect(first.reason).toBe('no_event_id');
    expect(second.process).toBe(true);
  });

  it('covers related call.* lifecycle event types', () => {
    expect(shouldDedupEventType('call.initiated')).toBe(true);
    expect(shouldDedupEventType('call.bridged')).toBe(true);
    expect(shouldDedupEventType('call.hangup')).toBe(true);
    expect(shouldDedupEventType('message.received')).toBe(false);
  });
});
