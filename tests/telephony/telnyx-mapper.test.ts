import { describe, expect, it } from 'vitest';
import type { Call } from '@telnyx/webrtc';
import { shouldConfirmRemoteAnswer } from '@/lib/telephony/telnyx-mapper';
import type { CallSessionContext } from '@/lib/telephony/types';

function mockCall(state: string, prevState?: string, id = 'call-1'): Call {
  return {
    id,
    state,
    prevState: prevState ?? '',
  } as Call;
}

function baseSession(overrides: Partial<CallSessionContext> = {}): CallSessionContext {
  return {
    callId: 'call-1',
    callControlId: null,
    direction: 'outbound',
    kind: 'pstn',
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
    ...overrides,
  };
}

describe('shouldConfirmRemoteAnswer', () => {
  it('defers inbound SDK active until user answers', () => {
    const result = shouldConfirmRemoteAnswer({
      call: mockCall('active', 'ringing'),
      session: baseSession({ direction: 'inbound', kind: 'inbound' }),
    });
    expect(result.confirmed).toBe(false);
    expect(result.source).toBe('inbound_deferred');
  });

  it('confirms inbound after explicit user answer', () => {
    const result = shouldConfirmRemoteAnswer({
      call: mockCall('active', 'ringing'),
      session: baseSession({ direction: 'inbound', kind: 'inbound' }),
      userAnswered: true,
    });
    expect(result.confirmed).toBe(true);
  });

  it('defers first outbound active after early media (Bug #2 guard)', () => {
    const result = shouldConfirmRemoteAnswer({
      call: mockCall('active', 'early'),
      session: baseSession({ remoteRingSeen: true, activeTransitionCount: 1 }),
    });
    expect(result.confirmed).toBe(false);
    expect(result.source).toBe('pstn_deferred');
  });

  it('confirms outbound PSTN on second active after early media without prevState=ringing', () => {
    const result = shouldConfirmRemoteAnswer({
      call: mockCall('active', 'active'),
      session: baseSession({ remoteRingSeen: true, activeTransitionCount: 2 }),
    });
    expect(result.confirmed).toBe(true);
    expect(result.source).toBe('pstn_second_active');
  });

  it('defers second active when remote ring was never seen', () => {
    const result = shouldConfirmRemoteAnswer({
      call: mockCall('active', 'active'),
      session: baseSession({ remoteRingSeen: false, activeTransitionCount: 2 }),
    });
    expect(result.confirmed).toBe(false);
    expect(result.source).toBe('pstn_deferred');
  });

  it('defers third outbound active — no repeat pstn_second_active', () => {
    const result = shouldConfirmRemoteAnswer({
      call: mockCall('active', 'active'),
      session: baseSession({ remoteRingSeen: true, activeTransitionCount: 3 }),
    });
    expect(result.confirmed).toBe(false);
    expect(result.source).toBe('pstn_deferred');
  });

  it('defers pstn_second_active when connectedAt is already set', () => {
    const result = shouldConfirmRemoteAnswer({
      call: mockCall('active', 'active'),
      session: baseSession({
        remoteRingSeen: true,
        activeTransitionCount: 2,
        connectedAt: Date.now(),
      }),
    });
    expect(result.confirmed).toBe(false);
    expect(result.source).toBe('pstn_deferred');
  });

  it('defers pstn_second_active when call id does not match session', () => {
    const result = shouldConfirmRemoteAnswer({
      call: mockCall('active', 'active', 'other-call'),
      session: baseSession({ remoteRingSeen: true, activeTransitionCount: 2, callId: 'call-1' }),
    });
    expect(result.confirmed).toBe(false);
    expect(result.source).toBe('pstn_deferred');
  });

  it('confirms outbound active after remote ringing', () => {
    const result = shouldConfirmRemoteAnswer({
      call: mockCall('active', 'ringing'),
      session: baseSession(),
    });
    expect(result.confirmed).toBe(true);
    expect(result.source).toBe('pstn_active');
  });

  it('defers internal extension first active after early media', () => {
    const result = shouldConfirmRemoteAnswer({
      call: mockCall('active', 'early'),
      session: baseSession({
        kind: 'internal_extension',
        remoteRingSeen: true,
        activeTransitionCount: 1,
      }),
    });
    expect(result.confirmed).toBe(false);
    expect(result.source).toBe('pstn_deferred');
  });

  it('confirms internal extension on second active after early media', () => {
    const result = shouldConfirmRemoteAnswer({
      call: mockCall('active', 'active'),
      session: baseSession({
        kind: 'internal_extension',
        remoteRingSeen: true,
        activeTransitionCount: 2,
      }),
    });
    expect(result.confirmed).toBe(true);
    expect(result.source).toBe('pstn_second_active');
  });
});
