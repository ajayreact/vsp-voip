/** Enterprise telephony phases — single source of truth for call UI and side effects. */
export type CallPhase =
  | 'idle'
  | 'dialing'
  | 'calling'
  | 'remote_ringing'
  | 'connected'
  | 'hold'
  | 'transferring'
  | 'recording'
  | 'ending'
  | 'ended'
  | 'failed';

export type ConnectionPhase =
  | 'disconnected'
  | 'connecting'
  | 'registering'
  | 'ready'
  | 'reconnecting'
  | 'auth_failed';

export type CallDirection = 'inbound' | 'outbound';

export type CallKind = 'pstn' | 'internal_extension' | 'inbound';

export type PendingInternalRequest = {
  targetNumber: string;
  targetDisplayName: string;
  callControlId: string | null;
  bridgeWebRtcCallId: string | null;
  startedAt: number;
};

export type CallSessionContext = {
  callId: string;
  callControlId: string | null;
  direction: CallDirection;
  kind: CallKind;
  remoteLabel: string;
  callerNameHint: string | null;
  logFrom: string;
  logTo: string;
  startedAt: number | null;
  connectedAt: number | null;
  durationSeconds: number;
  remoteRingSeen: boolean;
  activeTransitionCount: number;
  bridgeAutoAnswered: boolean;
  awaitingDeskBridge: boolean;
  isMuted: boolean;
  terminationReason: string | null;
};

export type TelephonySnapshot = {
  connection: ConnectionPhase;
  callPhase: CallPhase;
  session: CallSessionContext | null;
  pendingInternal: PendingInternalRequest | null;
  socketConnected: boolean;
  connectionMessage: string;
  reconnectAttempt: number;
  lastTransitionAt: number;
  lastTransitionReason: string;
};

export type TelephonyCallEvent =
  | { type: 'DIAL_REQUESTED'; destination: string; kind: CallKind }
  | { type: 'DIAL_ACCEPTED'; callId: string; callControlId?: string | null }
  | { type: 'DIAL_FAILED'; reason: string }
  | { type: 'SDK_TRYING' }
  | { type: 'SDK_RINGING' }
  | { type: 'SDK_EARLY' }
  | { type: 'SDK_ANSWERING' }
  | { type: 'SDK_ACTIVE'; callId: string; eventType?: string }
  | { type: 'SDK_HELD' }
  | { type: 'SDK_TERMINAL'; reason: string }
  | { type: 'REMOTE_ANSWER_CONFIRMED'; callId: string; source: string }
  | { type: 'BRIDGE_LEG_ARRIVED'; callId: string }
  | { type: 'BRIDGE_AUTO_ANSWERED'; callId: string }
  | { type: 'HOLD_STARTED' }
  | { type: 'HOLD_ENDED' }
  | { type: 'TRANSFER_STARTED' }
  | { type: 'TRANSFER_ENDED' }
  | { type: 'RECORDING_STARTED' }
  | { type: 'RECORDING_STOPPED' }
  | { type: 'HANGUP_REQUESTED' }
  | { type: 'INBOUND_RECEIVED'; callId: string; remoteLabel: string; logFrom: string; logTo: string; callerNameHint?: string | null }
  | { type: 'SESSION_LABEL'; remoteLabel: string; callerNameHint?: string | null }
  | { type: 'SESSION_LOG_PARTIES'; logFrom: string; logTo: string }
  | { type: 'MUTE_TOGGLED'; muted: boolean }
  | { type: 'RESET' };

export type TelephonyConnectionEvent =
  | { type: 'CONN_CONNECTING' }
  | { type: 'CONN_REGISTERING' }
  | { type: 'CONN_READY' }
  | { type: 'CONN_RECONNECTING'; attempt?: number }
  | { type: 'CONN_DISCONNECTED' }
  | { type: 'CONN_AUTH_FAILED'; reason: string }
  | { type: 'CONN_SOCKET_OPEN' }
  | { type: 'CONN_SOCKET_CLOSE' }
  | { type: 'CONN_STATUS'; message: string };

export const RINGBACK_PHASES = new Set<CallPhase>([
  'dialing',
  'calling',
  'remote_ringing',
]);

export const LIVE_CALL_PHASES = new Set<CallPhase>([
  'dialing',
  'calling',
  'remote_ringing',
  'connected',
  'hold',
  'transferring',
  'recording',
  'ending',
]);

export const TERMINAL_CALL_PHASES = new Set<CallPhase>(['ended', 'failed']);
