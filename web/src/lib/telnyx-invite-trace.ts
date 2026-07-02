'use client';

/**
 * TEMPORARY client-only diagnostic trace — no routing/backend logic.
 *
 * Captures the exact payload passed to client.newCall() and the raw
 * telnyx_rtc.invite JSON-RPC frame sent over the Telnyx signaling WebSocket,
 * by wrapping the browser's native WebSocket send/receive for sockets that
 * connect to a Telnyx signaling host. Nothing here changes what is sent —
 * it only observes and logs.
 *
 * Enable: localStorage.setItem('VSP_DESK_DESK_TRACE', '1')
 * Disable: localStorage.removeItem('VSP_DESK_DESK_TRACE')
 * Grep: [TRACE]
 *
 * Remove this file + call sites once the investigation is complete.
 */

const TELNYX_WS_HOST_PATTERN = /telnyx\.com/i;

type NativeWebSocket = typeof WebSocket;

const wireTapState: { installed: boolean; original: NativeWebSocket | null } = {
  installed: false,
  original: null,
};

export function isClientTraceEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage?.getItem('VSP_DESK_DESK_TRACE') === '1';
  } catch {
    return false;
  }
}

type JsonRpcFrame = {
  id?: string | number;
  method?: string;
  params?: Record<string, unknown>;
  result?: unknown;
  error?: unknown;
};

function safeParseJson(raw: unknown): JsonRpcFrame | null {
  if (typeof raw !== 'string') return null;
  try {
    return JSON.parse(raw) as JsonRpcFrame;
  } catch {
    return null;
  }
}

function logInviteFrame(direction: 'OUT' | 'IN', frame: JsonRpcFrame) {
  if (frame.method === 'telnyx_rtc.invite') {
    const dialogParams = (frame.params?.dialogParams ?? {}) as Record<string, unknown>;
    const sdp = typeof frame.params?.sdp === 'string' ? (frame.params.sdp as string) : '';
    const destinationNumber = dialogParams.destination_number ?? null;

    console.log(`[TRACE] telnyx_rtc.invite (WS ${direction})`, {
      direction,
      destination_number: destinationNumber,
      caller_id_number: dialogParams.caller_id_number ?? null,
      remote_caller_id_number: dialogParams.remote_caller_id_number ?? null,
      remote_caller_id_name: dialogParams.remote_caller_id_name ?? null,
      callID: dialogParams.callID ?? null,
      generatedSipUri: destinationNumber ? `sip:${destinationNumber}@sip.telnyx.com` : null,
      hasSdp: sdp.length > 0,
      sdpLength: sdp.length,
      audioInSdp: sdp.includes('m=audio'),
      fullDialogParams: dialogParams,
    });
    return;
  }

  if (frame.error) {
    console.error(`[TRACE] telnyx WS error frame (${direction})`, {
      direction,
      id: frame.id ?? null,
      error: frame.error,
    });
    return;
  }

  if (frame.method === 'telnyx_rtc.bye' || frame.method === 'telnyx_rtc.attach') {
    console.log(`[TRACE] telnyx WS frame ${frame.method} (${direction})`, {
      direction,
      params: frame.params ?? null,
    });
    return;
  }

  if (frame.result && typeof frame.result === 'object') {
    const result = frame.result as { message?: string; callID?: string; params?: { state?: string } };
    if (result.message || result.callID || result.params?.state) {
      console.log(`[TRACE] telnyx WS result frame (${direction})`, {
        direction,
        id: frame.id ?? null,
        result,
      });
    }
  }
}

/**
 * Wraps window.WebSocket so any socket connecting to a Telnyx host has its
 * outgoing/incoming JSON-RPC frames logged. Installs once; safe to call
 * multiple times (idempotent). Only active when trace flag is set.
 */
export function installTelnyxInviteWireTap(): void {
  if (typeof window === 'undefined') return;
  if (!isClientTraceEnabled()) return;
  if (wireTapState.installed) return;

  const OriginalWebSocket = window.WebSocket;
  wireTapState.original = OriginalWebSocket;

  class TracedWebSocket extends OriginalWebSocket {
    private readonly isTelnyxSocket: boolean;

    constructor(url: string | URL, protocols?: string | string[]) {
      super(url, protocols);
      const urlStr = String(url);
      this.isTelnyxSocket = TELNYX_WS_HOST_PATTERN.test(urlStr);

      if (this.isTelnyxSocket) {
        console.log('[TRACE] Telnyx signaling WebSocket connecting', { url: urlStr });

        this.addEventListener('open', () => {
          console.log('[TRACE] Telnyx signaling WebSocket open', { url: urlStr });
        });

        this.addEventListener('message', (event: MessageEvent) => {
          const frame = safeParseJson(event.data);
          if (frame) logInviteFrame('IN', frame);
        });

        this.addEventListener('close', (event: CloseEvent) => {
          console.log('[TRACE] Telnyx signaling WebSocket closed', {
            url: urlStr,
            code: event.code,
            reason: event.reason,
            wasClean: event.wasClean,
          });
        });

        this.addEventListener('error', () => {
          console.error('[TRACE] Telnyx signaling WebSocket error event', { url: urlStr });
        });
      }
    }

    send(data: string | ArrayBufferLike | Blob | ArrayBufferView): void {
      if (this.isTelnyxSocket) {
        const frame = safeParseJson(data);
        if (frame) logInviteFrame('OUT', frame);
      }
      super.send(data as never);
    }
  }

  window.WebSocket = TracedWebSocket as unknown as NativeWebSocket;
  wireTapState.installed = true;
  console.log('[TRACE] Telnyx WebSocket wire-tap installed (client-only, temporary)');
}

export function uninstallTelnyxInviteWireTap(): void {
  if (typeof window === 'undefined') return;
  if (!wireTapState.installed || !wireTapState.original) return;
  window.WebSocket = wireTapState.original;
  wireTapState.installed = false;
}

/** Log the exact object passed into client.newCall() before it is invoked. */
export function traceNewCallPayload(input: {
  destinationNumber: string;
  callerNumber: string;
  audio?: boolean;
  localStream?: MediaStream | null;
  remoteElement?: unknown;
}): void {
  if (!isClientTraceEnabled()) return;

  const audioTracks = input.localStream?.getAudioTracks() ?? [];

  console.log('[TRACE] client.newCall() payload', {
    destinationNumber: input.destinationNumber,
    callerNumber: input.callerNumber,
    audio: input.audio ?? null,
    localStreamPresent: Boolean(input.localStream),
    localStreamTrackCount: audioTracks.length,
    localStreamTracks: audioTracks.map((track) => ({
      id: track.id,
      label: track.label,
      enabled: track.enabled,
      readyState: track.readyState,
      muted: track.muted,
    })),
    remoteElement: typeof input.remoteElement === 'string' ? input.remoteElement : '[HTMLMediaElement]',
  });
}

/** Log what client.newCall() actually returned (or threw). */
export function traceNewCallResult(
  call: { id?: string; state?: string | number } | null | undefined,
  error?: unknown,
): void {
  if (!isClientTraceEnabled()) return;

  if (error) {
    console.error('[TRACE] client.newCall() threw', {
      name: error instanceof Error ? error.name : 'UnknownError',
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      raw: error,
    });
    return;
  }

  console.log('[TRACE] client.newCall() returned', {
    callId: call?.id ?? null,
    state: call?.state ?? null,
    isNullOrUndefined: call == null,
  });
}

/** Log SDK-level errors surfaced via the 'telnyx.error' client event. */
export function traceTelnyxSdkError(event: unknown): void {
  if (!isClientTraceEnabled()) return;
  console.error('[TRACE] telnyx.error (SDK event)', event);
}
