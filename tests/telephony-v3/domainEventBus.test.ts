import { afterEach, describe, expect, it, vi } from 'vitest';

const eventBus = require('../../lib/telephony-v3/Events/domainEventBus');
const { DOMAIN_EVENTS } = require('../../lib/telephony-v3/Events/domainEvents');

describe('V3 DomainEventBus', () => {
  afterEach(() => {
    eventBus.resetForTests();
  });

  it('publishes and notifies subscribers', async () => {
    const handler = vi.fn();
    eventBus.subscribe(DOMAIN_EVENTS.SESSION_CREATED, handler);

    await eventBus.publish({
      eventId: 'evt-1',
      eventType: DOMAIN_EVENTS.SESSION_CREATED,
      occurredAt: new Date().toISOString(),
      sessionId: 'sess-1',
      tenantId: 'tenant-a',
    });

    expect(handler).toHaveBeenCalledOnce();
  });

  it('supports replay by sessionId', async () => {
    await eventBus.publish({
      eventId: 'evt-1',
      eventType: DOMAIN_EVENTS.SESSION_CREATED,
      occurredAt: new Date().toISOString(),
      sessionId: 'sess-1',
    });
    await eventBus.publish({
      eventId: 'evt-2',
      eventType: DOMAIN_EVENTS.LEG_CREATED,
      occurredAt: new Date().toISOString(),
      sessionId: 'sess-2',
    });

    const replayed = eventBus.replay({ sessionId: 'sess-1' });
    expect(replayed).toHaveLength(1);
    expect(replayed[0].eventId).toBe('evt-1');
  });
});
