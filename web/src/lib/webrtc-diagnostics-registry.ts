import type { Call } from '@telnyx/webrtc';

export type WebRtcDiagnosticsRegistryEntry = {
  callId: string | null;
  call: Call | null;
  peerConnection: RTCPeerConnection | null;
  updatedAt: number;
};

let activeEntry: WebRtcDiagnosticsRegistryEntry | null = null;
const listeners = new Set<() => void>();

function notify() {
  for (const listener of listeners) {
    listener();
  }
}

/** Passive read-only registration for diagnostics pages — does not affect call handling. */
export function registerWebRtcDiagnosticsSnapshot(call: Call, peerConnection: RTCPeerConnection) {
  activeEntry = {
    callId: call.id ?? null,
    call,
    peerConnection,
    updatedAt: Date.now(),
  };
  notify();
}

export function clearWebRtcDiagnosticsSnapshot() {
  activeEntry = null;
  notify();
}

export function getWebRtcDiagnosticsRegistry(): WebRtcDiagnosticsRegistryEntry | null {
  return activeEntry;
}

export function subscribeWebRtcDiagnosticsRegistry(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
