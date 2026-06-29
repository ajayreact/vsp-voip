/** Local telephony state mirrors — avoids loading Telnyx native module at app startup. */

export enum VspConnectionState {
  DISCONNECTED = 'DISCONNECTED',
  CONNECTING = 'CONNECTING',
  CONNECTED = 'CONNECTED',
  RECONNECTING = 'RECONNECTING',
  ERROR = 'ERROR',
}

export enum VspCallState {
  RINGING = 'RINGING',
  CONNECTING = 'CONNECTING',
  ACTIVE = 'ACTIVE',
  HELD = 'HELD',
  ENDED = 'ENDED',
  FAILED = 'FAILED',
  DROPPED = 'DROPPED',
}

export function canMakeCalls(state: VspConnectionState): boolean {
  return state === VspConnectionState.CONNECTED;
}
