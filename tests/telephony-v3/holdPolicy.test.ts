import { afterEach, describe, expect, it } from 'vitest';

const { evaluateHoldPolicy, isHoldEligibleState, isResumeEligibleState } = require('../../lib/telephony-v3/HoldTransfer/holdPolicy');
const { POLICY_ACTION, HOLD_ACTION } = require('../../lib/telephony-v3/HoldTransfer/holdTransferConstants');

describe('V3 holdPolicy', () => {
  it('allows hold when enabled and session ACTIVE', () => {
    const decision = evaluateHoldPolicy({
      tenantId: 'tenant-1',
      sessionState: 'ACTIVE',
      holdEnabled: true,
      observeOnly: false,
      action: HOLD_ACTION.START,
    });
    expect(decision.effectiveAction).toBe(POLICY_ACTION.ALLOW);
  });

  it('denies hold when disabled', () => {
    const decision = evaluateHoldPolicy({
      tenantId: 'tenant-1',
      sessionState: 'ACTIVE',
      holdEnabled: false,
      observeOnly: false,
      action: HOLD_ACTION.START,
    });
    expect(decision.effectiveAction).toBe(POLICY_ACTION.DENY);
  });

  it('allows resume in HELD state', () => {
    expect(isResumeEligibleState('HELD')).toBe(true);
    const decision = evaluateHoldPolicy({
      tenantId: 'tenant-1',
      sessionState: 'HELD',
      holdEnabled: true,
      observeOnly: false,
      action: HOLD_ACTION.RESUME,
    });
    expect(decision.effectiveAction).toBe(POLICY_ACTION.ALLOW);
  });

  it('observe mode keeps effective allow on deny', () => {
    const decision = evaluateHoldPolicy({
      tenantId: 'tenant-1',
      sessionState: 'HELD',
      holdEnabled: false,
      observeOnly: true,
      action: HOLD_ACTION.START,
    });
    expect(decision.action).toBe(POLICY_ACTION.DENY);
    expect(decision.effectiveAction).toBe(POLICY_ACTION.ALLOW);
  });

  it('rejects hold from non-eligible states', () => {
    expect(isHoldEligibleState('RINGING')).toBe(false);
  });
});
