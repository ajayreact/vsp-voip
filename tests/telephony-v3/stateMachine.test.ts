import { describe, expect, it } from 'vitest';

const stateMachine = require('../../lib/telephony-v3/StateMachine/stateMachine');

describe('V3 StateMachine.apply', () => {
  it('applies session and leg transitions for call.answered', () => {
    const result = stateMachine.apply(
      {
        session: {
          id: 'sess-1',
          tenantId: 't1',
          state: 'RINGING',
          correlationId: 'corr-1',
          version: 0,
        },
        leg: {
          id: 'leg-1',
          sessionId: 'sess-1',
          callControlId: 'cc-1',
          role: 'ORIGIN',
          state: 'RINGING',
          version: 0,
        },
      },
      { sessionTrigger: 'call.answered', legTrigger: 'call.answered', eventId: 'evt-1' },
    );

    expect(result.session?.state).toBe('BRIDGING');
    expect(result.leg?.state).toBe('ANSWERED');
    expect(result.commandIntents.some((i) => i.commandType === 'BRIDGE')).toBe(true);
  });

  it('records invalid transitions without throwing', () => {
    const result = stateMachine.apply(
      {
        session: {
          id: 'sess-1',
          tenantId: 't1',
          state: 'NEW',
          correlationId: 'corr-1',
          version: 0,
        },
        leg: {
          id: 'leg-1',
          sessionId: 'sess-1',
          callControlId: 'cc-1',
          role: 'ORIGIN',
          state: 'NEW',
          version: 0,
        },
      },
      { sessionTrigger: 'bridge.completed', legTrigger: null, eventId: 'evt-2' },
    );

    expect(result.invalidSessionTransition).toBe(true);
    expect(result.session?.state).toBe('NEW');
  });
});
