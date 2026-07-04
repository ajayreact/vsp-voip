import { afterEach, describe, expect, it, vi } from 'vitest';

const eventBus = require('../../lib/telephony-v3/Events/domainEventBus');
const policyEngine = require('../../lib/telephony-v3/Policy/policyEngine');

describe('V3 PolicyEngine observe mode', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    eventBus.resetForTests();
  });

  it('always allows in observe mode and publishes policy.evaluated', async () => {
    vi.spyOn(eventBus, 'publish').mockResolvedValue(undefined);

    const decision = await policyEngine.evaluate({
      eventId: 'evt-1',
      sessionId: 'sess-1',
      tenantId: 'tenant-a',
      telnyxEventType: 'call.initiated',
      sessionState: 'NEW',
      legState: 'NEW',
    });

    expect(decision.allowed).toBe(true);
    expect(decision.observeOnly).toBe(true);
    expect(eventBus.publish).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: 'policy.evaluated' }),
    );
  });

  it('warns when tenantId is missing but still allows', async () => {
    vi.spyOn(eventBus, 'publish').mockResolvedValue(undefined);

    const decision = await policyEngine.evaluate({
      eventId: 'evt-2',
      sessionId: 'sess-1',
      telnyxEventType: 'call.initiated',
      sessionState: 'NEW',
      legState: 'NEW',
    });

    expect(decision.allowed).toBe(true);
    expect(decision.rules.some((r) => r.rule === 'tenant.required')).toBe(true);
  });
});
