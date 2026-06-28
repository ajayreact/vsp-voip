import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Call } from '@telnyx/webrtc';
import { createTelephonyOrchestrator } from '@/lib/telephony/orchestrator';
import { setTelephonyLogSink, type TelephonyLogEntry } from '@/lib/telephony/logger';

vi.mock('@/lib/call-sounds', () => ({
  primeCallAudioForDial: vi.fn(async () => true),
  startLocalRingback: vi.fn(async () => undefined),
  stopLocalRingback: vi.fn(),
  getActiveLocalToneSourceForDiagnostics: () => 'none',
}));

function mockCall(input: {
  id: string;
  state: string;
  prevState?: string;
}): Call {
  return {
    id: input.id,
    state: input.state,
    prevState: input.prevState ?? '',
  } as Call;
}

describe('orchestrator answer-gate replay (Bug #7 live log sequence)', () => {
  let events: TelephonyLogEntry[];

  beforeEach(() => {
    events = [];
    setTelephonyLogSink((entry) => events.push(entry));
  });

  it('PSTN early media: deferred first active, pstn_second_active on second active', () => {
    const orchestrator = createTelephonyOrchestrator();
    const callId = 'pstn-webrtc-1';

    orchestrator.dispatchCall({ type: 'DIAL_REQUESTED', destination: '+13135551212', kind: 'pstn' });
    orchestrator.dispatchCall({ type: 'DIAL_ACCEPTED', callId });

    orchestrator.dispatchSdkNotification(mockCall({ id: callId, state: 'ringing' }), 'callUpdate');
    orchestrator.dispatchSdkNotification(mockCall({ id: callId, state: 'early' }), 'callUpdate');
    orchestrator.dispatchSdkNotification(
      mockCall({ id: callId, state: 'active', prevState: 'early' }),
      'callUpdate',
    );

    expect(events.some((e) => e.event === 'answer.shouldConfirmRemoteAnswer'
      && e.detail?.source === 'pstn_deferred'
      && e.detail?.activeTransitionCount === 1)).toBe(true);

    orchestrator.dispatchSdkNotification(
      mockCall({ id: callId, state: 'active', prevState: 'active' }),
      'callUpdate',
    );

    expect(events.some((e) => e.event === 'answer.shouldConfirmRemoteAnswer'
      && e.detail?.source === 'pstn_second_active'
      && e.detail?.activeTransitionCount === 2)).toBe(true);
    expect(events.some((e) => e.event === 'answer.REMOTE_ANSWER_CONFIRMED.dispatch'
      && e.detail?.source === 'pstn_second_active')).toBe(true);
    expect(events.some((e) => e.event === 'state.transition'
      && e.detail?.toPhase === 'connected')).toBe(true);
    expect(events.some((e) => e.event === 'timer.connectedAt.assigned')).toBe(true);
    expect(events.some((e) => e.event === 'ringback.stop')).toBe(true);
    expect(orchestrator.getSnapshot().callPhase).toBe('connected');
    expect(orchestrator.getSnapshot().session?.connectedAt).not.toBeNull();
  });

  it('internal bridge: second active confirms without pstn_second_active', () => {
    const orchestrator = createTelephonyOrchestrator();
    const callId = 'bridge-webrtc-1';

    orchestrator.dispatchCall({ type: 'DIAL_REQUESTED', destination: '101', kind: 'internal_extension' });
    orchestrator.dispatchCall({ type: 'DIAL_ACCEPTED', callId, callControlId: 'cc-1' });
    orchestrator.dispatchCall({ type: 'BRIDGE_AUTO_ANSWERED', callId });

    orchestrator.dispatchSdkNotification(
      mockCall({ id: callId, state: 'active', prevState: 'answering' }),
      'callUpdate',
    );
    orchestrator.dispatchSdkNotification(
      mockCall({ id: callId, state: 'active', prevState: 'active' }),
      'callUpdate',
    );

    expect(events.some((e) => e.event === 'answer.REMOTE_ANSWER_CONFIRMED.dispatch'
      && e.detail?.source === 'internal_bridge_second_active')).toBe(true);
    expect(events.some((e) => e.event === 'answer.REMOTE_ANSWER_CONFIRMED.dispatch'
      && e.detail?.source === 'pstn_second_active')).toBe(false);
  });

  it('hold/resume: no second REMOTE_ANSWER_CONFIRMED.dispatch after connected', () => {
    const orchestrator = createTelephonyOrchestrator();
    const callId = 'pstn-hold-1';

    orchestrator.dispatchCall({ type: 'DIAL_REQUESTED', destination: '+13135551212', kind: 'pstn' });
    orchestrator.dispatchCall({ type: 'DIAL_ACCEPTED', callId });
    orchestrator.dispatchSdkNotification(mockCall({ id: callId, state: 'ringing' }), 'callUpdate');
    orchestrator.dispatchSdkNotification(
      mockCall({ id: callId, state: 'active', prevState: 'ringing' }),
      'callUpdate',
    );

    const confirmsBeforeHold = events.filter((e) => e.event === 'answer.REMOTE_ANSWER_CONFIRMED.dispatch').length;
    expect(confirmsBeforeHold).toBe(1);

    orchestrator.holdStarted();
    orchestrator.dispatchSdkNotification(mockCall({ id: callId, state: 'held', prevState: 'active' }), 'callUpdate');
    orchestrator.holdEnded();
    orchestrator.dispatchSdkNotification(
      mockCall({ id: callId, state: 'active', prevState: 'held' }),
      'callUpdate',
    );

    const confirmsAfterResume = events.filter((e) => e.event === 'answer.REMOTE_ANSWER_CONFIRMED.dispatch').length;
    expect(confirmsAfterResume).toBe(1);
    expect(events.some((e) => e.event === 'answer.REMOTE_ANSWER_CONFIRMED.skipped')).toBe(false);
  });

  it('reconnect-style third active: no repeat pstn_second_active confirm', () => {
    const orchestrator = createTelephonyOrchestrator();
    const callId = 'pstn-reconnect-1';

    orchestrator.dispatchCall({ type: 'DIAL_REQUESTED', destination: '+13135551212', kind: 'pstn' });
    orchestrator.dispatchCall({ type: 'DIAL_ACCEPTED', callId });
    orchestrator.dispatchSdkNotification(mockCall({ id: callId, state: 'early' }), 'callUpdate');
    orchestrator.dispatchSdkNotification(
      mockCall({ id: callId, state: 'active', prevState: 'early' }),
      'callUpdate',
    );
    orchestrator.dispatchSdkNotification(
      mockCall({ id: callId, state: 'active', prevState: 'active' }),
      'callUpdate',
    );

    const confirms = events.filter((e) => e.event === 'answer.REMOTE_ANSWER_CONFIRMED.dispatch');
    expect(confirms).toHaveLength(1);
    expect(confirms[0]?.detail?.source).toBe('pstn_second_active');

    orchestrator.dispatchSdkNotification(
      mockCall({ id: callId, state: 'active', prevState: 'active' }),
      'callUpdate',
    );

    expect(events.filter((e) => e.event === 'answer.REMOTE_ANSWER_CONFIRMED.dispatch')).toHaveLength(1);
    expect(events.some((e) => e.event === 'answer.shouldConfirmRemoteAnswer'
      && e.detail?.source === 'pstn_deferred'
      && e.detail?.activeTransitionCount === 3)).toBe(true);
  });
});
