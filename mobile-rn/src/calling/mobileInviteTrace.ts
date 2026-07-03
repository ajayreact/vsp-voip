/**
 * TEMPORARY client-only diagnostic trace — no routing/backend logic.
 *
 * Captures mobile dial → client.newCall() → Telnyx SDK → WebSocket telnyx_rtc.invite
 * frames. Observes only; does not change what is sent.
 *
 * Enable (once per install):
 *   await AsyncStorage.setItem('VSP_DESK_DESK_TRACE', '1')
 * Disable:
 *   await AsyncStorage.removeItem('VSP_DESK_DESK_TRACE')
 *
 * Grep device logs: [TRACE]
 * Grep API logs: [softphone-telemetry] event mobile_desk_desk_trace
 *
 * Remove this file + call sites once the investigation is complete.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Call } from '@telnyx/react-voice-commons-sdk';
import type { TelnyxVoipClient } from '@telnyx/react-voice-commons-sdk';
import { postSoftphoneTelemetry } from './softphoneService';
import { useCallingStore } from '../store/callingStore';

const TRACE_KEY = 'VSP_DESK_DESK_TRACE';

type JsonRpcFrame = {
  id?: string | number;
  method?: string;
  params?: Record<string, unknown>;
  result?: unknown;
  error?: unknown;
};

type ConnectionLike = {
  send: (msg: unknown) => void;
  on: (event: string, handler: (...args: unknown[]) => void) => void;
  off?: (event: string, handler: (...args: unknown[]) => void) => void;
  removeListener?: (event: string, handler: (...args: unknown[]) => void) => void;
  __vspTapped?: boolean;
};

const TAP_FLAG = '__vspTapped';

let traceEnabledCache: boolean | null = null;
// Track the exact Connection object we last tapped. The SDK creates a brand new
// Connection on every connect()/reconnect(), so a boolean guard would leave the
// tap on a dead socket. We re-tap whenever the live object identity changes.
let tappedConnection: ConnectionLike | null = null;
let connectionTapCleanup: (() => void) | null = null;

export async function initMobileTraceFlag(): Promise<boolean> {
  try {
    const value = await AsyncStorage.getItem(TRACE_KEY);
    traceEnabledCache = value === '1';
  } catch {
    traceEnabledCache = false;
  }
  if (traceEnabledCache) {
    console.log('[TRACE] Mobile desk-desk trace ENABLED');
  }
  return traceEnabledCache === true;
}

export function isMobileTraceEnabled(): boolean {
  return traceEnabledCache === true;
}

function emitTrace(stage: string, detail: Record<string, unknown>): void {
  const payload = {
    stage,
    at: new Date().toISOString(),
    ...detail,
  };
  console.log('[TRACE]', stage, payload);
  void postSoftphoneTelemetry('mobile_desk_desk_trace', payload).catch(() => {});
}

function safeParseFrame(msg: unknown): JsonRpcFrame | null {
  if (!msg || typeof msg !== 'object') return null;
  return msg as JsonRpcFrame;
}

function logWsFrame(direction: 'OUT' | 'IN', frame: JsonRpcFrame): void {
  if (frame.method === 'telnyx_rtc.invite') {
    const dialogParams = (frame.params?.dialogParams ?? {}) as Record<string, unknown>;
    const sdp = typeof frame.params?.sdp === 'string' ? (frame.params.sdp as string) : '';
    emitTrace(`telnyx_rtc.invite (WS ${direction})`, {
      direction,
      destination_number: dialogParams.destination_number ?? null,
      caller_id_number: dialogParams.caller_id_number ?? null,
      remote_caller_id_number: dialogParams.remote_caller_id_number ?? null,
      remote_caller_id_name: dialogParams.remote_caller_id_name ?? null,
      callID: dialogParams.callID ?? null,
      hasSdp: sdp.length > 0,
      sdpLength: sdp.length,
      fullDialogParams: dialogParams,
      fullFrame: frame,
    });
    return;
  }

  if (frame.error) {
    emitTrace(`telnyx WS error frame (${direction})`, {
      direction,
      id: frame.id ?? null,
      error: frame.error,
      fullFrame: frame,
    });
    return;
  }

  if (frame.result && typeof frame.result === 'object') {
    const result = frame.result as { message?: string; callID?: string; params?: { state?: string } };
    if (result.message || result.callID || result.params?.state) {
      emitTrace(`telnyx WS result frame (${direction})`, {
        direction,
        id: frame.id ?? null,
        result,
        fullFrame: frame,
      });
    }
  }
}

function resolveTelnyxConnection(client: TelnyxVoipClient): ConnectionLike | null {
  const internal = client as unknown as {
    _sessionManager?: { telnyxClient?: { connection?: ConnectionLike } };
  };
  return internal._sessionManager?.telnyxClient?.connection ?? null;
}

/**
 * Tap the live Telnyx signaling Connection for exact JSON-RPC frames and
 * socket lifecycle. Observes only — never alters what is sent.
 *
 * Safe to call repeatedly (registration, and again at dial time). Re-taps
 * automatically when the SDK swaps in a new Connection after a reconnect.
 */
export function installMobileConnectionTap(client: TelnyxVoipClient): void {
  if (!isMobileTraceEnabled()) return;

  const connection = resolveTelnyxConnection(client);
  if (!connection) {
    emitTrace('connection_tap_skipped', { reason: 'telnyx connection not available yet' });
    return;
  }

  // Already tapping this exact object — nothing to do.
  if (connection === tappedConnection && connection[TAP_FLAG]) return;

  // A new Connection replaced the old one (reconnect). Drop the stale tap.
  if (connectionTapCleanup) {
    connectionTapCleanup();
    connectionTapCleanup = null;
  }

  const onMessage = (msg: unknown) => {
    const frame = safeParseFrame(msg);
    if (frame) logWsFrame('IN', frame);
  };
  const onClose = (...args: unknown[]) => {
    emitTrace('socket_closed', { args });
  };
  const onError = (...args: unknown[]) => {
    emitTrace('socket_error', { args });
  };
  const onOpen = () => {
    emitTrace('socket_open', {});
  };

  const originalSend = connection.send.bind(connection);
  connection.send = (msg: unknown) => {
    const frame = safeParseFrame(msg);
    if (frame) logWsFrame('OUT', frame);
    originalSend(msg);
  };

  connection.on('telnyx.socket.message', onMessage);
  connection.on('telnyx.socket.close', onClose);
  connection.on('telnyx.socket.error', onError);
  connection.on('telnyx.socket.open', onOpen);
  connection[TAP_FLAG] = true;
  tappedConnection = connection;

  const removeListener = connection.off?.bind(connection)
    ?? connection.removeListener?.bind(connection);

  connectionTapCleanup = () => {
    connection.send = originalSend;
    if (removeListener) {
      removeListener('telnyx.socket.message', onMessage);
      removeListener('telnyx.socket.close', onClose);
      removeListener('telnyx.socket.error', onError);
      removeListener('telnyx.socket.open', onOpen);
    }
    connection[TAP_FLAG] = false;
    if (tappedConnection === connection) tappedConnection = null;
    connectionTapCleanup = null;
  };

  emitTrace('connection_tap_installed', { ok: true, retapped: Boolean(tappedConnection) });
}

export function uninstallMobileConnectionTap(): void {
  connectionTapCleanup?.();
}

/** Log the UI handler entry (handlePlaceCall) BEFORE any guard runs. */
export function traceUiDialPressed(input: {
  source: string;
  digits: string;
  canPlace: boolean;
}): void {
  if (!isMobileTraceEnabled()) return;
  emitTrace('handlePlaceCall() entered', {
    source: input.source,
    digits: input.digits,
    digitsLength: input.digits.length,
    canPlace: input.canPlace,
  });
}

/** Log dial button / placeOutboundCall entry. */
export function traceDialButtonPressed(input: {
  destination: string;
  canPlace: boolean;
  connectionState: string;
  isRegistering: boolean;
}): void {
  if (!isMobileTraceEnabled()) return;
  const { defaultCallerId, tenantNumbers } = useCallingStore.getState();
  emitTrace('Dial Button Pressed', {
    destination: input.destination,
    canPlace: input.canPlace,
    connectionState: input.connectionState,
    isRegistering: input.isRegistering,
    defaultCallerId,
    tenantNumbers,
  });
}

/** Log exact arguments passed into TelnyxVoipClient.newCall(). */
export function traceNewCallPayload(input: {
  dialTarget: string;
  callerNumber: string | undefined;
  isExtension: boolean;
  normalized: string;
  rawDestination: string;
}): void {
  if (!isMobileTraceEnabled()) return;
  emitTrace('client.newCall() payload', {
    dialTarget: input.dialTarget,
    callerNumber: input.callerNumber ?? null,
    callerName: undefined,
    isExtension: input.isExtension,
    normalized: input.normalized,
    rawDestination: input.rawDestination,
  });
}

/** Log client.newCall() result or thrown error (raw, before friendly mapping). */
export function traceNewCallResult(
  call: Call | null | undefined,
  error?: unknown,
): void {
  if (!isMobileTraceEnabled()) return;

  if (error) {
    emitTrace('client.newCall() threw', {
      name: error instanceof Error ? error.name : 'UnknownError',
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      raw: error,
    });
    return;
  }

  const telnyxCall = (call as Call & { telnyxCall?: { state?: string; telnyxIds?: unknown } })?.telnyxCall;

  emitTrace('client.newCall() returned', {
    callId: call?.callId ?? null,
    state: call?.currentState ?? null,
    destination: call?.destination ?? null,
    telnyxCallState: telnyxCall?.state ?? null,
    telnyxIds: telnyxCall?.telnyxIds ?? null,
    isNullOrUndefined: call == null,
  });
}

/** Subscribe to call state for ~15s after outbound dial; logs terminal/failed transitions. */
export function startMobileOutboundCallWatch(call: Call): () => void {
  if (!isMobileTraceEnabled()) return () => {};

  let lastState = call.currentState;
  emitTrace('call_state_watch_started', { callId: call.callId, state: lastState });

  const sub = call.callState$.subscribe((state) => {
    if (state === lastState) return;
    emitTrace('call_state_changed', { callId: call.callId, from: lastState, to: state });
    lastState = state;
  });

  const timer = setTimeout(() => {
    emitTrace('call_state_watch_ended', { callId: call.callId, finalState: lastState });
    sub.unsubscribe();
  }, 15_000);

  return () => {
    clearTimeout(timer);
    sub.unsubscribe();
  };
}

/** Log raw error before friendlyError mapping in UI. */
export function tracePlaceCallError(error: unknown): void {
  if (!isMobileTraceEnabled()) return;
  emitTrace('placeOutboundCall error (raw)', {
    name: error instanceof Error ? error.name : 'UnknownError',
    message: error instanceof Error ? error.message : String(error),
    status: (error as { status?: number })?.status ?? null,
    body: (error as { body?: unknown })?.body ?? null,
    raw: error,
  });
}
