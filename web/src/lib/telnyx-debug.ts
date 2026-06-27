import type { Call } from '@telnyx/webrtc';
import { resolvePeerConnection } from '@/lib/webrtc-audio';

const LOG_PREFIX = '[VSP Softphone]';

function safeJson(value: unknown) {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

export function logSoftphone(message: string, detail?: unknown) {
  if (detail === undefined) {
    console.log(`${LOG_PREFIX} ${message}`);
    return;
  }
  console.log(`${LOG_PREFIX} ${message}`, detail);
}

export function warnSoftphone(message: string, detail?: unknown) {
  if (detail === undefined) {
    console.warn(`${LOG_PREFIX} ${message}`);
    return;
  }
  console.warn(`${LOG_PREFIX} ${message}`, detail);
}

export function errorSoftphone(message: string, detail?: unknown) {
  if (detail === undefined) {
    console.error(`${LOG_PREFIX} ${message}`);
    return;
  }
  console.error(`${LOG_PREFIX} ${message}`, detail);
}

export function summarizeCall(call: Call | null | undefined) {
  if (!call) return null;

  const extended = call as Call & {
    direction?: string;
    state?: string;
    prevState?: string;
    options?: Record<string, unknown>;
    telnyxIDs?: Record<string, unknown>;
    id?: string;
    cause?: string;
    causeCode?: number | string;
  };

  return {
    id: extended.id,
    state: extended.state,
    prevState: extended.prevState,
    direction: extended.direction,
    remotePartyNumber: (extended as Call & { remotePartyNumber?: string }).remotePartyNumber,
    remotePartyName: (extended as Call & { remotePartyName?: string }).remotePartyName,
    localPartyNumber: (extended as Call & { localPartyNumber?: string }).localPartyNumber,
    remoteCallerNumber: extended.options?.remoteCallerNumber,
    telnyxCallControlId: extended.telnyxIDs?.telnyxCallControlId,
    telnyxSessionId: extended.telnyxIDs?.telnyxSessionId,
    cause: extended.cause,
    causeCode: extended.causeCode,
  };
}

export function summarizeNotification(notification: unknown) {
  if (!notification || typeof notification !== 'object') {
    return { raw: notification };
  }

  const payload = notification as {
    type?: string;
    call?: Call;
    error?: unknown;
  };

  return {
    type: payload.type,
    call: summarizeCall(payload.call),
    error: payload.error,
  };
}

export async function logPeerConnectionDiagnostics(call: Call, label: string) {
  const pc = resolvePeerConnection(call);

  if (!pc) {
    warnSoftphone(`${label}: peerConnection not available yet`);
    return;
  }

  logSoftphone(`${label}: WebRTC state`, {
    iceConnectionState: pc.iceConnectionState,
    iceGatheringState: pc.iceGatheringState,
    connectionState: pc.connectionState,
    signalingState: pc.signalingState,
    localAudioTracks: pc.getSenders().filter((s) => s.track?.kind === 'audio').length,
    remoteAudioTracks: pc.getReceivers().filter((r) => r.track?.kind === 'audio').length,
  });

  try {
    const stats = await pc.getStats();
    const lines: Record<string, unknown>[] = [];

    stats.forEach((report) => {
      if (report.type === 'candidate-pair' && 'state' in report && report.state === 'succeeded') {
        lines.push({
          type: 'candidate-pair',
          state: report.state,
          localCandidateId: report.localCandidateId,
          remoteCandidateId: report.remoteCandidateId,
        });
      }
      if (report.type === 'inbound-rtp' && report.kind === 'audio') {
        lines.push({
          type: 'inbound-rtp',
          bytesReceived: report.bytesReceived,
          packetsReceived: report.packetsReceived,
        });
      }
      if (report.type === 'outbound-rtp' && report.kind === 'audio') {
        lines.push({
          type: 'outbound-rtp',
          bytesSent: report.bytesSent,
          packetsSent: report.packetsSent,
        });
      }
    });

    if (lines.length) {
      logSoftphone(`${label}: RTP / ICE stats`, lines);
    }
  } catch (err) {
    warnSoftphone(`${label}: getStats failed`, err);
  }
}

/** Telnyx SDK State enum order — call.state may be a numeric enum value at runtime. */
const TELNYX_STATE_BY_NUMBER = [
  'new',
  'requesting',
  'trying',
  'recovering',
  'ringing',
  'answering',
  'early',
  'active',
  'held',
  'hangup',
  'destroy',
  'purge',
] as const;

export function normalizeCallState(state: string | number | undefined | null) {
  if (typeof state === 'number' && Number.isFinite(state)) {
    return TELNYX_STATE_BY_NUMBER[state] ?? String(state);
  }
  return String(state ?? '').trim().toLowerCase();
}

export function isTerminalCallState(state: string | undefined) {
  const normalized = normalizeCallState(state);
  return normalized === 'hangup' || normalized === 'destroy' || normalized === 'purge';
}

export function isOutboundRingingState(state: string | undefined) {
  const normalized = normalizeCallState(state);
  return normalized === 'trying'
    || normalized === 'ringing'
    || normalized === 'requesting'
    || normalized === 'early'
    || normalized === 'new';
}

export function formatCallFailureReason(call: Call | null | undefined) {
  if (!call) return 'Call did not connect.';

  const extended = call as Call & {
    cause?: string;
    causeCode?: number | string;
    sipCode?: number;
    sipReason?: string;
  };

  const parts: string[] = [];
  if (extended.sipCode) {
    parts.push(`SIP ${extended.sipCode}${extended.sipReason ? ` ${extended.sipReason}` : ''}`);
  }
  if (extended.cause) {
    parts.push(extended.cause);
  }
  if (extended.causeCode !== undefined && extended.causeCode !== null) {
    parts.push(`code ${extended.causeCode}`);
  }

  if (!parts.length) {
    return 'Call did not connect. Check Telnyx Debugger for the INVITE and verify Outbound Voice Profile on VSP-SIP-Trunk.';
  }

  return `Call failed: ${parts.join(' · ')}`;
}

export function wireCallDebugHandlers(call: Call, label: string) {
  logSoftphone(`${label}: new call`, summarizeCall(call));
  logSoftphone('[SOFTPHONE] Call object created', {
    id: call.id,
    state: call.state,
    normalizedState: normalizeCallState(call.state),
    direction: (call as Call & { direction?: string }).direction,
  });

  const extended = call as Call & {
    on?: (event: string, handler: (...args: unknown[]) => void) => void;
  };

  const logStateEvent = (eventName: string, args?: unknown) => {
    logSoftphone(`[SOFTPHONE] call.${eventName}`, {
      label,
      args,
      call: summarizeCall(call),
      normalizedState: normalizeCallState(call.state),
    });
    void logPeerConnectionDiagnostics(call, `${label}:${eventName}`);
  };

  if (typeof extended.on === 'function') {
    const events = [
      'stateChange',
      'ringing',
      'active',
      'hangup',
      'destroy',
      'error',
      'answer',
      'notification',
    ] as const;

    for (const eventName of events) {
      extended.on(eventName, (...args: unknown[]) => {
        logStateEvent(eventName, args);
      });
    }
  }

  window.setTimeout(() => {
    void logPeerConnectionDiagnostics(call, `${label}: +2s`);
  }, 2000);
}

/**
 * Poll call.state when telnyx.notification callUpdate events are delayed or missing.
 */
export function watchCallState(
  call: Call,
  label: string,
  onChange: (call: Call, state: string, prevState: string) => void,
): () => void {
  let lastState = normalizeCallState(call.state);
  onChange(call, lastState, '');

  const pollId = window.setInterval(() => {
    const current = normalizeCallState(call.state);
    if (current === lastState) return;

    const prev = lastState;
    lastState = current;
    logSoftphone(`${label}: state poll`, { prev, current, call: summarizeCall(call) });
    onChange(call, current, prev);

    if (isTerminalCallState(current)) {
      cleanup();
    }
  }, 250);

  const extended = call as Call & {
    on?: (event: string, handler: (...args: unknown[]) => void) => void;
  };

  const onStateChange = () => {
    const current = normalizeCallState(call.state);
    if (current === lastState) return;

    const prev = lastState;
    lastState = current;
    logSoftphone(`${label}: stateChange event`, { prev, current, call: summarizeCall(call) });
    onChange(call, current, prev);

    if (isTerminalCallState(current)) {
      cleanup();
    }
  };

  if (typeof extended.on === 'function') {
    extended.on('stateChange', onStateChange);
  }

  function cleanup() {
    window.clearInterval(pollId);
  }

  return cleanup;
}

export function logTelnyxError(event: unknown) {
  errorSoftphone('Telnyx error event', safeJson(event));
}
