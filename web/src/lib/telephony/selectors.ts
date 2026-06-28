import type { CallPhase, TelephonySnapshot } from './types';
import { LIVE_CALL_PHASES, TERMINAL_CALL_PHASES } from './types';

const CONNECTED_PHASES = new Set<CallPhase>(['connected', 'hold', 'recording', 'transferring']);

export function selectIsConnected(snapshot: TelephonySnapshot): boolean {
  return CONNECTED_PHASES.has(snapshot.callPhase);
}

export function selectIsOnHold(snapshot: TelephonySnapshot): boolean {
  return snapshot.callPhase === 'hold';
}

export function selectHasLiveCall(snapshot: TelephonySnapshot): boolean {
  return LIVE_CALL_PHASES.has(snapshot.callPhase);
}

export function selectIsTerminal(snapshot: TelephonySnapshot): boolean {
  return TERMINAL_CALL_PHASES.has(snapshot.callPhase);
}

export function selectDurationSeconds(snapshot: TelephonySnapshot): number {
  return snapshot.session?.durationSeconds ?? 0;
}

export function selectCallDirection(snapshot: TelephonySnapshot): 'inbound' | 'outbound' | '' {
  return snapshot.session?.direction ?? '';
}

export function selectDisplayNumber(snapshot: TelephonySnapshot): string {
  return snapshot.session?.remoteLabel ?? '';
}

export function selectCallerNameHint(snapshot: TelephonySnapshot): string {
  return snapshot.session?.callerNameHint ?? '';
}

export function selectIncomingReceivedAt(snapshot: TelephonySnapshot): string {
  const startedAt = snapshot.session?.startedAt;
  if (!startedAt || snapshot.session?.direction !== 'inbound') return '';
  return new Date(startedAt).toISOString();
}

export function selectIsMuted(snapshot: TelephonySnapshot): boolean {
  return snapshot.session?.isMuted ?? false;
}

/** Maps FSM phase to legacy UI call-state strings consumed by softphone-v2 screens. */
export function selectUiCallState(snapshot: TelephonySnapshot): string {
  const { callPhase, session } = snapshot;

  if (
    session?.direction === 'outbound'
    && !CONNECTED_PHASES.has(callPhase)
    && (callPhase === 'calling' || callPhase === 'remote_ringing')
  ) {
    return 'ringing';
  }

  switch (callPhase) {
    case 'idle':
      return '';
    case 'dialing':
    case 'calling':
      return 'requesting';
    case 'remote_ringing':
      return session?.direction === 'inbound' ? 'ringing' : 'ringing';
    case 'connected':
    case 'transferring':
    case 'recording':
      return 'active';
    case 'hold':
      return 'held';
    case 'ending':
      return 'hangup';
    case 'ended':
      return 'hangup';
    case 'failed':
      return 'failed';
    default:
      return '';
  }
}

export function selectShowIncomingOverlay(snapshot: TelephonySnapshot): boolean {
  return snapshot.session?.direction === 'inbound'
    && snapshot.callPhase === 'remote_ringing';
}

export function selectInCallMediaReady(snapshot: TelephonySnapshot): boolean {
  return selectIsConnected(snapshot) || snapshot.callPhase === 'hold';
}

export function selectTelnyxReady(snapshot: TelephonySnapshot): boolean {
  return snapshot.connection === 'ready' && snapshot.socketConnected;
}

export function selectReconnecting(snapshot: TelephonySnapshot): boolean {
  return snapshot.connection === 'reconnecting';
}

export function selectConnectionStatus(snapshot: TelephonySnapshot, bootStatus?: string): string {
  if (bootStatus?.trim()) return bootStatus;
  if (snapshot.connection === 'reconnecting') {
    return snapshot.reconnectAttempt > 0
      ? `Reconnecting… (attempt ${snapshot.reconnectAttempt})`
      : 'Reconnecting…';
  }
  if (snapshot.connectionMessage.trim()) return snapshot.connectionMessage;
  if (selectTelnyxReady(snapshot)) return 'Ready — open DevTools console for all Telnyx events';
  if (snapshot.connection === 'connecting') return 'Connecting…';
  if (snapshot.connection === 'auth_failed') return snapshot.lastTransitionReason || 'Authentication failed';
  if (snapshot.connection === 'disconnected') return 'Disconnected';
  return 'Initializing…';
}
