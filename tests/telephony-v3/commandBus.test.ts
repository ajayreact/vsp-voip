import { afterEach, describe, expect, it, vi } from 'vitest';

const commandOutbox = require('../../lib/telephony-v3/Outbox/commandOutbox');
const eventBus = require('../../lib/telephony-v3/Events/domainEventBus');
const commandBus = require('../../lib/telephony-v3/Commands/commandBus');

describe('V3 CommandBus', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    eventBus.resetForTests();
  });

  it('enqueues command intent to outbox with idempotency key', async () => {
    vi.spyOn(commandOutbox, 'enqueueCommand').mockResolvedValue({
      id: 'cmd-1',
      commandType: 'BRIDGE',
    });
    vi.spyOn(eventBus, 'publish').mockResolvedValue(undefined);

    const row = await commandBus.enqueueIntent({
      sessionId: 'sess-1',
      legId: 'leg-1',
      commandType: 'BRIDGE',
      targetCallControlId: 'cc-1',
      reason: 'fsm_bridge_pending',
      payload: { stub: true },
      sequence: 0,
    });

    expect(row.id).toBe('cmd-1');
    expect(commandOutbox.enqueueCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: 'sess-1',
        commandType: 'BRIDGE',
        idempotencyKey: 'sess-1:BRIDGE:cc-1:0',
      }),
    );
    expect(eventBus.publish).toHaveBeenCalled();
  });
});
