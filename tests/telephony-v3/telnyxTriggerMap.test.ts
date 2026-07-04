import { describe, expect, it } from 'vitest';

const { mapTelnyxToTriggers } = require('../../lib/telephony-v3/StateMachine/telnyxTriggerMap');

describe('V3 Telnyx trigger map', () => {
  it('maps parked call.initiated to origin.parked', () => {
    const triggers = mapTelnyxToTriggers({
      eventType: 'call.initiated',
      state: 'parked',
      direction: 'outgoing',
    });
    expect(triggers.sessionTrigger).toBe('origin.parked');
    expect(triggers.legTrigger).toBe('leg.created');
  });

  it('maps call.answered to FSM triggers', () => {
    const triggers = mapTelnyxToTriggers({ eventType: 'call.answered' });
    expect(triggers.sessionTrigger).toBe('call.answered');
    expect(triggers.legTrigger).toBe('call.answered');
  });

  it('maps hangup to leg.ended', () => {
    const triggers = mapTelnyxToTriggers({ eventType: 'call.hangup' });
    expect(triggers.sessionTrigger).toBe('leg.ended');
    expect(triggers.legTrigger).toBe('leg.hangup');
  });
});
