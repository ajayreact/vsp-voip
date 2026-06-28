import { describe, expect, it } from 'vitest';
import { createInitialTelephonySnapshot } from '@/lib/telephony/call-fsm';
import { selectUiCallState } from '@/lib/telephony/selectors';

describe('selectUiCallState outbound ringing labels', () => {
  it('maps calling phase to connecting (requesting)', () => {
    const snap = {
      ...createInitialTelephonySnapshot(),
      callPhase: 'calling' as const,
      session: {
        callId: 'call-1',
        callControlId: null,
        direction: 'outbound' as const,
        kind: 'pstn' as const,
        remoteLabel: '+13135551212',
        callerNameHint: null,
        logFrom: '',
        logTo: '+13135551212',
        startedAt: Date.now(),
        connectedAt: null,
        durationSeconds: 0,
        remoteRingSeen: false,
        activeTransitionCount: 0,
        isMuted: false,
        terminationReason: null,
      },
    };
    expect(selectUiCallState(snap)).toBe('requesting');
  });

  it('maps remote_ringing phase to ringing', () => {
    const snap = {
      ...createInitialTelephonySnapshot(),
      callPhase: 'remote_ringing' as const,
      session: {
        callId: 'call-1',
        callControlId: null,
        direction: 'outbound' as const,
        kind: 'pstn' as const,
        remoteLabel: '+13135551212',
        callerNameHint: null,
        logFrom: '',
        logTo: '+13135551212',
        startedAt: Date.now(),
        connectedAt: null,
        durationSeconds: 0,
        remoteRingSeen: true,
        activeTransitionCount: 0,
        isMuted: false,
        terminationReason: null,
      },
    };
    expect(selectUiCallState(snap)).toBe('ringing');
  });
});
