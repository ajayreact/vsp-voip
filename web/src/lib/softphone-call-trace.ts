import type { Call } from '@telnyx/webrtc';
import type { TelnyxRTC } from '@telnyx/webrtc';
import {
  errorSoftphone,
  logSoftphone,
  normalizeCallState,
  summarizeCall,
  summarizeNotification,
  warnSoftphone,
  wireCallDebugHandlers,
} from '@/lib/telnyx-debug';

export type CallTraceEvent = {
  at: string;
  source: string;
  event: string;
  callId?: string | null;
  state?: string;
  detail?: unknown;
};

export type CallTraceSink = {
  record: (entry: Omit<CallTraceEvent, 'at'>) => void;
};

export type CallStateProbeSnapshot = {
  elapsedMs: number;
  state: string;
  prevState: string;
  peerConnectionState: string | null;
  signalingState: string | null;
  localTracks: number;
  remoteTracks: number;
  creatingPeer?: boolean;
  hasPeer: boolean;
};

type OutboundTraceCapture = {
  notifications: unknown[];
  errors: unknown[];
  inviteAttempted: boolean;
  inviteAttemptReason: string;
  getUserMediaOk: boolean | null;
  getUserMediaError: string | null;
};

export type OutboundDeepTraceSession = {
  callId: string;
  stop: () => void;
  capture: OutboundTraceCapture;
};

export function createCallTraceSink(
  onUpdate: (entry: CallTraceEvent) => void,
): CallTraceSink {
  return {
    record(entry) {
      const full: CallTraceEvent = {
        at: new Date().toLocaleTimeString(),
        ...entry,
      };
      onUpdate(full);
      logSoftphone(`[SOFTPHONE] event:${entry.event}`, {
        source: entry.source,
        callId: entry.callId,
        state: entry.state,
        detail: entry.detail,
      });
    },
  };
}

function getCallPeer(call: Call) {
  return (call as Call & {
    peer?: { instance?: RTCPeerConnection | null; peerConnection?: RTCPeerConnection | null };
    creatingPeer?: boolean;
  }).peer;
}

function getPeerConnection(call: Call): RTCPeerConnection | null {
  const peer = getCallPeer(call);
  return peer?.instance ?? peer?.peerConnection ?? null;
}

export function buildCallStateProbeSnapshot(
  call: Call,
  elapsedMs: number,
): CallStateProbeSnapshot {
  const extended = call as Call & { prevState?: string; creatingPeer?: boolean };
  const pc = getPeerConnection(call);
  const localStream = (call as Call & { localStream?: MediaStream }).localStream;
  const remoteStream = (call as Call & { remoteStream?: MediaStream }).remoteStream;

  const localFromPc = pc?.getSenders().filter((s) => s.track?.kind === 'audio').length ?? 0;
  const remoteFromPc = pc?.getReceivers().filter((r) => r.track?.kind === 'audio').length ?? 0;

  return {
    elapsedMs,
    state: normalizeCallState(call.state),
    prevState: normalizeCallState(extended.prevState),
    peerConnectionState: pc?.connectionState ?? null,
    signalingState: pc?.signalingState ?? null,
    localTracks: Math.max(localFromPc, localStream?.getAudioTracks().length ?? 0),
    remoteTracks: Math.max(remoteFromPc, remoteStream?.getAudioTracks().length ?? 0),
    creatingPeer: extended.creatingPeer,
    hasPeer: Boolean(getCallPeer(call)),
  };
}

export function logNewCallInspection(call: Call) {
  const ownKeys = Object.keys(call as object);
  const protoKeys = Object.getOwnPropertyNames(Object.getPrototypeOf(call) ?? {});
  const extended = call as Call & {
    invite?: unknown;
    hangup?: unknown;
    direction?: string;
    options?: Record<string, unknown>;
  };

  logSoftphone('[SOFTPHONE] newCall() returned — object inspection', {
    ownKeys,
    prototypeKeys: protoKeys.filter((k) => k !== 'constructor'),
    callId: call.id,
    state: call.state,
    normalizedState: normalizeCallState(call.state),
    prevState: extended.prevState,
    direction: extended.direction,
    typeofInvite: typeof extended.invite,
    typeofHangup: typeof extended.hangup,
    destinationNumber: extended.options?.destinationNumber,
    callerNumber: extended.options?.callerNumber,
    describe: describeCallObject(call),
  });
}

export function detectInviteAttempt(call: Call): { attempted: boolean; reason: string } {
  const extended = call as Call & {
    invite?: (...args: unknown[]) => unknown;
    creatingPeer?: boolean;
    direction?: string;
  };

  if (typeof extended.invite !== 'function') {
    return {
      attempted: false,
      reason: 'call.invite is not a function — Telnyx Call object may be invalid',
    };
  }

  const pc = getPeerConnection(call);
  if (extended.creatingPeer) {
    return {
      attempted: true,
      reason: 'invite() invoked — creatingPeer=true (peer.init in progress)',
    };
  }

  if (pc) {
    return {
      attempted: true,
      reason: `invite() invoked — RTCPeerConnection exists (signalingState=${pc.signalingState})`,
    };
  }

  if (normalizeCallState(call.state) !== 'new') {
    return {
      attempted: true,
      reason: `invite() likely invoked — state already left "new" (${normalizeCallState(call.state)})`,
    };
  }

  if (extended.direction?.toLowerCase() === 'outbound') {
    return {
      attempted: true,
      reason: 'invite() invoked — direction=outbound set on call object',
    };
  }

  return {
    attempted: false,
    reason: 'No peer, creatingPeer=false, state still "new", direction unset — invite() may not have run or failed synchronously before peer creation',
  };
}

export async function traceGetUserMedia(
  sink: CallTraceSink,
  callId?: string | null,
): Promise<{ ok: boolean; error: string | null }> {
  if (!navigator.mediaDevices?.getUserMedia) {
    const error = 'navigator.mediaDevices.getUserMedia is not available';
    errorSoftphone('[SOFTPHONE] getUserMedia unavailable', { error });
    sink.record({ source: 'getUserMedia', event: 'unavailable', callId, detail: { error } });
    return { ok: false, error };
  }

  try {
    logSoftphone('[SOFTPHONE] getUserMedia probe starting', { audio: true });
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const tracks = stream.getAudioTracks().map((t) => ({
      id: t.id,
      label: t.label,
      enabled: t.enabled,
      readyState: t.readyState,
    }));
    stream.getTracks().forEach((track) => track.stop());
    logSoftphone('[SOFTPHONE] getUserMedia probe succeeded', { tracks });
    sink.record({
      source: 'getUserMedia',
      event: 'success',
      callId,
      detail: { tracks },
    });
    return { ok: true, error: null };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    const name = err instanceof Error ? err.name : 'UnknownError';
    errorSoftphone('[SOFTPHONE] getUserMedia probe FAILED', { name, error, err });
    sink.record({
      source: 'getUserMedia',
      event: 'failure',
      callId,
      detail: { name, error, err },
    });
    return { ok: false, error: `${name}: ${error}` };
  }
}

function diagnoseStuckInNewState(
  call: Call,
  capture: OutboundTraceCapture,
  probes: CallStateProbeSnapshot[],
): string {
  const reasons: string[] = [];
  const latest = probes[probes.length - 1];
  const invite = detectInviteAttempt(call);

  if (!invite.attempted) {
    reasons.push(`invite not evidenced: ${invite.reason}`);
  } else {
    reasons.push(`invite evidence: ${invite.reason}`);
  }

  if (capture.getUserMediaOk === false) {
    reasons.push(`getUserMedia failed before dial: ${capture.getUserMediaError}`);
  }

  if (latest?.creatingPeer) {
    reasons.push('creatingPeer still true — peer.init() hung or awaiting getUserMedia');
  }

  if (latest && !latest.hasPeer && normalizeCallState(call.state) === 'new') {
    reasons.push('no RTCPeerConnection after 2s — invite() did not create peer (check telnyx.error for peer-init-failed)');
  }

  if (latest?.signalingState === 'closed') {
    reasons.push('RTCPeerConnection signalingState=closed — peer init failed or was torn down');
  }

  if (latest && latest.localTracks === 0) {
    reasons.push('no local audio tracks — getUserMedia may not have been acquired by Telnyx peer');
  }

  const callErrors = capture.errors.filter((e) => {
    const text = JSON.stringify(e).toLowerCase();
    return text.includes('usermedia') || text.includes('media') || text.includes('peer');
  });
  if (callErrors.length) {
    reasons.push(`telnyx.error events captured: ${callErrors.length} (see console for detail)`);
  }

  const updates = capture.notifications.filter((n) => {
    const summary = summarizeNotification(n);
    return summary.type === 'callUpdate' || String(summary.type).includes('invite');
  });
  if (!updates.length) {
    reasons.push('no callUpdate/invite telnyx.notification received — signaling may not have started');
  }

  if (!reasons.length) {
    reasons.push('unknown — inspect 500ms probe series and Telnyx Debugger for outbound INVITE');
  }

  return reasons.join(' | ');
}

/**
 * Deep instrumentation for outbound call creation lifecycle.
 * Returns stop() — call on hangup / reset.
 */
export function startOutboundDeepTrace(
  client: TelnyxRTC,
  call: Call,
  sink: CallTraceSink,
): OutboundDeepTraceSession {
  const capture: OutboundTraceCapture = {
    notifications: [],
    errors: [],
    inviteAttempted: false,
    inviteAttemptReason: '',
    getUserMediaOk: null,
    getUserMediaError: null,
  };

  const callId = call.id;
  const probes: CallStateProbeSnapshot[] = [];
  const startedAt = Date.now();

  logNewCallInspection(call);

  const initialInvite = detectInviteAttempt(call);
  capture.inviteAttempted = initialInvite.attempted;
  capture.inviteAttemptReason = initialInvite.reason;
  logSoftphone('[SOFTPHONE] outbound INVITE attempt check (immediate)', initialInvite);

  const onNotification = (notification: unknown) => {
    capture.notifications.push(notification);
    const summary = summarizeNotification(notification);
    logSoftphone('[SOFTPHONE] client.telnyx.notification (outbound trace)', summary);
    sink.record({
      source: 'client.telnyx.notification',
      event: String(summary.type || 'notification'),
      callId: summary.call?.id ?? callId,
      state: summary.call?.state ? normalizeCallState(summary.call.state) : undefined,
      detail: summary,
    });

    if (String(summary.type).includes('invite') || summary.type === 'callUpdate') {
      capture.inviteAttempted = true;
      capture.inviteAttemptReason = `telnyx.notification type=${summary.type}`;
    }
  };

  const onError = (event: unknown) => {
    capture.errors.push(event);
    errorSoftphone('[SOFTPHONE] client.telnyx.error (outbound trace)', event);
    sink.record({
      source: 'client.telnyx.error',
      event: 'error',
      callId,
      detail: event,
    });
  };

  client.on('telnyx.notification', onNotification);
  client.on('telnyx.error', onError);

  let probeCount = 0;
  const maxProbes = 20; // 500ms × 20 = 10s
  const probeTimer = window.setInterval(() => {
    probeCount += 1;
    const elapsedMs = Date.now() - startedAt;
    const snapshot = buildCallStateProbeSnapshot(call, elapsedMs);
    probes.push(snapshot);

    logSoftphone('[SOFTPHONE] call-state-probe', snapshot);
    sink.record({
      source: 'call-state-probe',
      event: `probe-${probeCount}`,
      callId,
      state: snapshot.state,
      detail: snapshot,
    });

    const inviteCheck = detectInviteAttempt(call);
    if (inviteCheck.attempted) {
      capture.inviteAttempted = true;
      capture.inviteAttemptReason = inviteCheck.reason;
    }

    if (probeCount >= maxProbes) {
      window.clearInterval(probeTimer);
    }
  }, 500);

  const stuckTimer = window.setTimeout(() => {
    if (normalizeCallState(call.state) !== 'new') return;

    const diagnosis = diagnoseStuckInNewState(call, capture, probes);
    errorSoftphone('[SOFTPHONE] CALL STUCK IN NEW STATE', {
      callId,
      diagnosis,
      probes,
      inviteAttempted: capture.inviteAttempted,
      inviteAttemptReason: capture.inviteAttemptReason,
      notifications: capture.notifications.length,
      errors: capture.errors.length,
      describe: describeCallObject(call),
    });
    sink.record({
      source: 'outbound-deep-trace',
      event: 'CALL STUCK IN NEW STATE',
      callId,
      state: 'new',
      detail: { diagnosis, probes, capture },
    });
  }, 2000);

  const summaryTimer = window.setTimeout(() => {
    logSoftphone('[SOFTPHONE] outbound trace 10s summary', {
      callId,
      finalState: normalizeCallState(call.state),
      inviteAttempted: capture.inviteAttempted,
      inviteAttemptReason: capture.inviteAttemptReason,
      notificationCount: capture.notifications.length,
      errorCount: capture.errors.length,
      probes,
    });
  }, 10000);

  const stop = () => {
    window.clearInterval(probeTimer);
    window.clearTimeout(stuckTimer);
    window.clearTimeout(summaryTimer);
    client.off('telnyx.notification', onNotification);
    client.off('telnyx.error', onError);
  };

  return { callId, stop, capture };
}

export function describeCallObject(call: Call | null | undefined) {
  if (!call) return null;

  const extended = call as Call & {
    direction?: string;
    options?: {
      destinationNumber?: string;
      callerNumber?: string;
      remoteElement?: unknown;
    };
    creatingPeer?: boolean;
  };

  const pc = getPeerConnection(call);

  return {
    ...summarizeCall(call),
    normalizedState: normalizeCallState(call.state),
    destinationNumber: extended.options?.destinationNumber ?? null,
    callerNumber: extended.options?.callerNumber ?? null,
    hasOnMethod: typeof (call as Call & { on?: unknown }).on === 'function',
    typeofInvite: typeof (call as Call & { invite?: unknown }).invite,
    typeofHangup: typeof call.hangup,
    creatingPeer: extended.creatingPeer ?? null,
    peerSignalingState: pc?.signalingState ?? null,
    peerConnectionState: pc?.connectionState ?? null,
    objectIdentity: String(call),
  };
}

export function validateOutboundCallObject(call: Call | null | undefined): string | null {
  if (!call) return 'Telnyx newCall returned null/undefined';
  if (!call.id) return 'Telnyx newCall returned no call.id';
  const state = normalizeCallState(call.state);
  if (!state) return 'Telnyx call has empty state after newCall';
  return null;
}

/** Telnyx SDK emits call state via telnyx.notification — call.on() is usually absent. */
export function attachCallTraceListeners(
  call: Call,
  label: string,
  sink: CallTraceSink,
) {
  sink.record({
    source: label,
    event: 'trace-attached',
    callId: call.id,
    state: normalizeCallState(call.state),
    detail: describeCallObject(call),
  });

  const extended = call as Call & {
    on?: (event: string, handler: (...args: unknown[]) => void) => void;
  };

  if (typeof extended.on !== 'function') {
    warnSoftphone('[SOFTPHONE] call.on() is NOT available on this Telnyx Call object — rely on telnyx.notification + state polling', {
      callId: call.id,
      label,
    });
  } else {
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
        sink.record({
          source: `${label}:call.on`,
          event: eventName,
          callId: call.id,
          state: normalizeCallState(call.state),
          detail: args,
        });
      });
    }
  }

  wireCallDebugHandlers(call, label);
}

export function assignDebugGlobals(
  client: object | null,
  call: Call | null,
) {
  if (typeof window === 'undefined') return;
  const win = window as typeof window & {
    telnyxClient?: object | null;
    currentCall?: Call | null;
  };
  win.telnyxClient = client;
  win.currentCall = call;
}

export async function hangupTrackedCall(
  call: Call | null | undefined,
  label: string,
  sink: CallTraceSink,
): Promise<void> {
  if (!call) {
    warnSoftphone('[SOFTPHONE] hangup skipped — no call object', { label });
    return;
  }

  sink.record({
    source: label,
    event: 'hangup-invoked',
    callId: call.id,
    state: normalizeCallState(call.state),
    detail: describeCallObject(call),
  });

  try {
    await Promise.resolve(call.hangup());
    sink.record({
      source: label,
      event: 'hangup-resolved',
      callId: call.id,
      state: normalizeCallState(call.state),
    });
  } catch (err) {
    errorSoftphone('[SOFTPHONE] hangup() rejected', { label, err, call: describeCallObject(call) });
    sink.record({
      source: label,
      event: 'hangup-error',
      callId: call.id,
      state: normalizeCallState(call.state),
      detail: err,
    });
  }
}
