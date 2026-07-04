import { describe, expect, it } from 'vitest';

const { resolveLegTransition, isTerminalLegState } = require('../../lib/telephony-v3/StateMachine/legTransitions');

describe('V3 Leg FSM', () => {
  it('transitions NEW to DIALING on leg.created', () => {
    expect(resolveLegTransition('NEW', 'leg.created')).toBe('DIALING');
  });

  it('transitions DIALING to RINGING on call.ringing', () => {
    expect(resolveLegTransition('DIALING', 'call.ringing')).toBe('RINGING');
  });

  it('transitions RINGING to ANSWERED on call.answered', () => {
    expect(resolveLegTransition('RINGING', 'call.answered')).toBe('ANSWERED');
  });

  it('transitions ANSWERED to BRIDGED on bridge.completed', () => {
    expect(resolveLegTransition('ANSWERED', 'bridge.completed')).toBe('BRIDGED');
  });

  it('transitions to ENDED on leg.hangup', () => {
    expect(resolveLegTransition('RINGING', 'leg.hangup')).toBe('ENDED');
  });

  it('terminal states block further transitions', () => {
    expect(isTerminalLegState('FAILED')).toBe(true);
    expect(resolveLegTransition('FAILED', 'call.answered')).toBeNull();
  });
});
