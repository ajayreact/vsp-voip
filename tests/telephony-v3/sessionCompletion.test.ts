import { describe, expect, it } from 'vitest';

const stateMachine = require('../../lib/telephony-v3/StateMachine/stateMachine');

describe('V3 Session completion (Phase 2.6)', () => {
  it('resolves session.closed when all legs are terminal and session is ENDING', () => {
    const session = {
      id: 'sess-1',
      tenantId: 't1',
      state: 'ENDING',
      correlationId: 'c1',
      version: 2,
    };
    const legs = [
      { id: 'leg-1', sessionId: 'sess-1', callControlId: 'cc-1', role: 'ORIGIN', state: 'ENDED', version: 2 },
    ];

    const completion = stateMachine.resolveSessionCompletion(session, legs, 'evt-hangup');
    expect(completion?.toState).toBe('ENDED');
    expect(completion?.triggerEvent).toBe('session.closed');
  });

  it('applyWithCompletion closes session on hangup path', () => {
    const result = stateMachine.applyWithCompletion(
      {
        session: {
          id: 'sess-1',
          tenantId: 't1',
          state: 'RINGING',
          correlationId: 'c1',
          version: 1,
          legs: [{ id: 'leg-1', sessionId: 'sess-1', callControlId: 'cc-1', role: 'ORIGIN', state: 'RINGING', version: 1 }],
        },
        leg: {
          id: 'leg-1',
          sessionId: 'sess-1',
          callControlId: 'cc-1',
          role: 'ORIGIN',
          state: 'RINGING',
          version: 1,
        },
      },
      { sessionTrigger: 'leg.ended', legTrigger: 'leg.hangup', eventId: 'evt-hangup' },
    );

    expect(result.sessionTransition?.toState).toBe('ENDING');
    expect(result.legTransition?.toState).toBe('ENDED');
    expect(result.sessionCompletionTransition?.toState).toBe('ENDED');
    expect(result.session?.state).toBe('ENDED');
  });
});
