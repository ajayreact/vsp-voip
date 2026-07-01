import { describe, expect, it } from 'vitest';

const { resolveSessionTransition, isTerminalSessionState } = require('../../lib/telephony-v3/StateMachine/sessionTransitions');

describe('V3 Session FSM', () => {
  it('transitions NEW to ORIGIN_PARKED on origin.parked', () => {
    expect(resolveSessionTransition('NEW', 'origin.parked')).toBe('ORIGIN_PARKED');
  });

  it('transitions ORIGIN_PARKED to ROUTING on route.decided', () => {
    expect(resolveSessionTransition('ORIGIN_PARKED', 'route.decided')).toBe('ROUTING');
  });

  it('transitions RINGING to BRIDGING on call.answered', () => {
    expect(resolveSessionTransition('RINGING', 'call.answered')).toBe('BRIDGING');
  });

  it('transitions BRIDGING to ACTIVE on bridge.completed', () => {
    expect(resolveSessionTransition('BRIDGING', 'bridge.completed')).toBe('ACTIVE');
  });

  it('rejects invalid transition', () => {
    expect(resolveSessionTransition('NEW', 'bridge.completed')).toBeNull();
  });

  it('terminal states have no exits', () => {
    expect(isTerminalSessionState('ENDED')).toBe(true);
    expect(resolveSessionTransition('ENDED', 'call.answered')).toBeNull();
  });
});
