import { describe, expect, it } from 'vitest';
import {
  createInitialTelephonySnapshot,
  reduceCallEvent,
  reduceConnectionEvent,
  tickDuration,
} from '@/lib/telephony/call-fsm';
import {
  selectDurationSeconds,
  selectHasLiveCall,
  selectIsConnected,
  selectUiCallState,
} from '@/lib/telephony/selectors';

describe('telephony call FSM', () => {
  it('starts idle', () => {
    const snap = createInitialTelephonySnapshot();
    expect(snap.callPhase).toBe('idle');
    expect(snap.session).toBeNull();
  });

  it('outbound dial → calling → remote ringing → connected', () => {
    let snap = createInitialTelephonySnapshot();
    snap = reduceConnectionEvent(snap, { type: 'CONN_READY' });
    snap = reduceCallEvent(snap, {
      type: 'DIAL_REQUESTED',
      destination: '101',
      kind: 'internal_extension',
    });
    expect(snap.callPhase).toBe('dialing');
    expect(snap.session?.kind).toBe('internal_extension');

    snap = reduceCallEvent(snap, {
      type: 'DIAL_ACCEPTED',
      callId: 'webrtc-1',
    });
    expect(snap.callPhase).toBe('calling');

    snap = reduceCallEvent(snap, { type: 'SDK_RINGING' });
    expect(snap.callPhase).toBe('remote_ringing');
    expect(snap.session?.remoteRingSeen).toBe(true);

    snap = reduceCallEvent(snap, {
      type: 'REMOTE_ANSWER_CONFIRMED',
      callId: 'webrtc-1',
      source: 'pstn_second_active',
    });
    expect(snap.callPhase).toBe('connected');
    expect(snap.session?.connectedAt).toBeTypeOf('number');
  });

  it('inbound received stays ringing until confirmed', () => {
    let snap = createInitialTelephonySnapshot();
    snap = reduceCallEvent(snap, {
      type: 'INBOUND_RECEIVED',
      callId: 'in-1',
      remoteLabel: '+13135551212',
      logFrom: '+13135551212',
      logTo: '+13135559999',
    });
    expect(snap.callPhase).toBe('remote_ringing');
    expect(snap.session?.direction).toBe('inbound');

    snap = reduceCallEvent(snap, {
      type: 'REMOTE_ANSWER_CONFIRMED',
      callId: 'in-1',
      source: 'inbound_user_answer',
    });
    expect(snap.callPhase).toBe('connected');
  });

  it('SESSION_LABEL does not overwrite known caller with Unknown', () => {
    let snap = createInitialTelephonySnapshot();
    snap = reduceCallEvent(snap, {
      type: 'INBOUND_RECEIVED',
      callId: 'in-1',
      remoteLabel: '+13135551212',
      logFrom: '+13135551212',
      logTo: '+13135559999',
      callerNameHint: 'Jane Doe',
    });
    snap = reduceCallEvent(snap, {
      type: 'SESSION_LABEL',
      remoteLabel: 'Unknown',
      callerNameHint: '',
    });
    expect(snap.session?.remoteLabel).toBe('+13135551212');
    expect(snap.session?.callerNameHint).toBe('Jane Doe');
  });

  it('ignores duplicate inbound received while session is live', () => {
    let snap = createInitialTelephonySnapshot();
    snap = reduceCallEvent(snap, {
      type: 'INBOUND_RECEIVED',
      callId: 'in-1',
      remoteLabel: '+13135551212',
      logFrom: '+13135551212',
      logTo: '+13135559999',
    });
    snap = reduceCallEvent(snap, {
      type: 'REMOTE_ANSWER_CONFIRMED',
      callId: 'in-1',
      source: 'inbound_user_answer',
    });

    snap = reduceCallEvent(snap, {
      type: 'INBOUND_RECEIVED',
      callId: 'in-2',
      remoteLabel: '+13135551212',
      logFrom: '+13135551212',
      logTo: '+13135559999',
    });
    expect(snap.callPhase).toBe('connected');
    expect(snap.session?.callId).toBe('in-1');
  });

  it('does not downgrade connected inbound on duplicate SDK ringing', () => {
    let snap = createInitialTelephonySnapshot();
    snap = reduceCallEvent(snap, {
      type: 'INBOUND_RECEIVED',
      callId: 'in-1',
      remoteLabel: '+13135551212',
      logFrom: '+13135551212',
      logTo: '+13135559999',
    });
    snap = reduceCallEvent(snap, {
      type: 'REMOTE_ANSWER_CONFIRMED',
      callId: 'in-1',
      source: 'inbound_user_answer',
    });
    snap = reduceCallEvent(snap, { type: 'SDK_RINGING' });
    expect(snap.callPhase).toBe('connected');
  });

  it('hold and resume', () => {
    let snap = createInitialTelephonySnapshot();
    snap = reduceCallEvent(snap, {
      type: 'DIAL_REQUESTED',
      destination: '+13135551212',
      kind: 'pstn',
    });
    snap = reduceCallEvent(snap, {
      type: 'DIAL_ACCEPTED',
      callId: 'pstn-1',
    });
    snap = reduceCallEvent(snap, {
      type: 'REMOTE_ANSWER_CONFIRMED',
      callId: 'pstn-1',
      source: 'pstn_active',
    });
    snap = reduceCallEvent(snap, { type: 'HOLD_STARTED' });
    expect(snap.callPhase).toBe('hold');

    snap = reduceCallEvent(snap, { type: 'HOLD_ENDED' });
    expect(snap.callPhase).toBe('connected');
  });

  it('transfer and recording phases return to connected', () => {
    let snap = createInitialTelephonySnapshot();
    snap = reduceCallEvent(snap, {
      type: 'DIAL_REQUESTED',
      destination: '101',
      kind: 'pstn',
    });
    snap = reduceCallEvent(snap, {
      type: 'REMOTE_ANSWER_CONFIRMED',
      callId: 'x',
      source: 'pstn_active',
    });
    snap = reduceCallEvent(snap, { type: 'TRANSFER_STARTED' });
    expect(snap.callPhase).toBe('transferring');
    snap = reduceCallEvent(snap, { type: 'TRANSFER_ENDED' });
    expect(snap.callPhase).toBe('connected');

    snap = reduceCallEvent(snap, { type: 'RECORDING_STARTED' });
    expect(snap.callPhase).toBe('recording');
    snap = reduceCallEvent(snap, { type: 'RECORDING_STOPPED' });
    expect(snap.callPhase).toBe('connected');
  });

  it('terminal ends call and records reason', () => {
    let snap = createInitialTelephonySnapshot();
    snap = reduceCallEvent(snap, {
      type: 'DIAL_REQUESTED',
      destination: '+13135551212',
      kind: 'pstn',
    });
    snap = reduceCallEvent(snap, { type: 'SDK_TERMINAL', reason: 'busy' });
    expect(snap.callPhase).toBe('ended');
    expect(snap.session?.terminationReason).toBe('busy');
  });

  it('failed dial moves to failed', () => {
    let snap = createInitialTelephonySnapshot();
    snap = reduceCallEvent(snap, {
      type: 'DIAL_REQUESTED',
      destination: '101',
      kind: 'internal_extension',
    });
    snap = reduceCallEvent(snap, { type: 'DIAL_FAILED', reason: 'api_error' });
    expect(snap.callPhase).toBe('failed');
    expect(snap.session).toBeNull();
  });

  it('duration ticks only while connected', () => {
    const now = Date.now();
    let snap = createInitialTelephonySnapshot();
    snap = reduceCallEvent(snap, {
      type: 'DIAL_REQUESTED',
      destination: '+1',
      kind: 'pstn',
    });
    snap = reduceCallEvent(snap, {
      type: 'REMOTE_ANSWER_CONFIRMED',
      callId: '1',
      source: 'pstn_active',
    });
    snap = {
      ...snap,
      session: snap.session
        ? { ...snap.session, connectedAt: now - 5000 }
        : snap.session,
    };
    snap = tickDuration(snap, now);
    expect(selectDurationSeconds(snap)).toBe(5);

    snap = reduceCallEvent(snap, { type: 'SDK_TERMINAL', reason: 'hangup' });
    snap = tickDuration(snap, now + 10_000);
    expect(selectDurationSeconds(snap)).toBe(5);
  });
});

describe('telephony connection FSM', () => {
  it('connecting → ready → reconnecting → ready', () => {
    let snap = createInitialTelephonySnapshot();
    snap = reduceConnectionEvent(snap, { type: 'CONN_CONNECTING' });
    expect(snap.connection).toBe('connecting');
    snap = reduceConnectionEvent(snap, { type: 'CONN_READY' });
    expect(snap.connection).toBe('ready');
    snap = reduceConnectionEvent(snap, { type: 'CONN_SOCKET_CLOSE' });
    expect(snap.connection).toBe('ready');
    expect(snap.socketConnected).toBe(false);
    snap = reduceConnectionEvent(snap, { type: 'CONN_RECONNECTING', attempt: 2 });
    expect(snap.reconnectAttempt).toBe(2);
    snap = reduceConnectionEvent(snap, { type: 'CONN_READY' });
    expect(snap.connection).toBe('ready');
    expect(snap.reconnectAttempt).toBe(0);
  });

  it('auth failed', () => {
    let snap = createInitialTelephonySnapshot();
    snap = reduceConnectionEvent(snap, {
      type: 'CONN_AUTH_FAILED',
      reason: 'invalid token',
    });
    expect(snap.connection).toBe('auth_failed');
  });
});

describe('telephony selectors', () => {
  it('maps phases to UI labels', () => {
    let snap = createInitialTelephonySnapshot();
    expect(selectUiCallState(snap)).toBe('');
    snap = reduceCallEvent(snap, {
      type: 'DIAL_REQUESTED',
      destination: '101',
      kind: 'pstn',
    });
    expect(selectUiCallState(snap)).toBe('requesting');
    snap = reduceCallEvent(snap, { type: 'SDK_RINGING' });
    expect(selectUiCallState(snap)).toBe('ringing');
    snap = reduceCallEvent(snap, {
      type: 'REMOTE_ANSWER_CONFIRMED',
      callId: '1',
      source: 'pstn_active',
    });
    expect(selectUiCallState(snap)).toBe('active');
    expect(selectIsConnected(snap)).toBe(true);
    expect(selectHasLiveCall(snap)).toBe(true);
  });
});
