import type { Call } from '@telnyx/webrtc';
import {
  extractAudioRtpStats,
  summarizeSdpAudioFromPeerConnection,
  type AudioRtpStats,
  type SdpAudioCapture,
} from '@/lib/webrtc-diagnostics';
import { resolvePeerConnection } from '@/lib/webrtc-audio';

const LOG_PREFIX = '[VSP SendPathProbe]';
const STORAGE_KEY = 'vsp.webrtc.sendPathProbe';
const PROBE_INTERVAL_MS = 1000;

export type SendPathProbeSenderSnapshot = {
  index: number;
  trackId: string | null;
  enabled: boolean | null;
  readyState: MediaStreamTrackState | null;
  muted: boolean | null;
  label: string | null;
};

export type SendPathProbeTick = {
  tick: number;
  elapsedMs: number;
  iceConnectionState: RTCIceConnectionState;
  connectionState: RTCPeerConnectionState;
  signalingState: RTCSignalingState;
  senders: SendPathProbeSenderSnapshot[];
  rtp: AudioRtpStats;
  replaceTrackCallCount: number;
};

let replaceTrackProbeInstalled = false;
let replaceTrackCallCount = 0;
let originalReplaceTrack: typeof RTCRtpSender.prototype.replaceTrack | null = null;

function logProbe(message: string, detail?: unknown) {
  if (detail === undefined) {
    console.log(`${LOG_PREFIX} ${message}`);
    return;
  }
  console.log(`${LOG_PREFIX} ${message}`, detail);
}

function installReplaceTrackProbe() {
  if (replaceTrackProbeInstalled || typeof RTCRtpSender === 'undefined') return;

  originalReplaceTrack = RTCRtpSender.prototype.replaceTrack;
  RTCRtpSender.prototype.replaceTrack = function replaceTrackWithProbe(
    this: RTCRtpSender,
    ...args: Parameters<typeof RTCRtpSender.prototype.replaceTrack>
  ) {
    if (isWebRtcSendPathProbeEnabled()) {
      replaceTrackCallCount += 1;
      const nextTrack = args[0];
      logProbe('replaceTrack.called', {
        count: replaceTrackCallCount,
        nextTrack: nextTrack
          ? {
              id: nextTrack.id,
              kind: nextTrack.kind,
              enabled: nextTrack.enabled,
              readyState: nextTrack.readyState,
              muted: nextTrack.muted,
              label: nextTrack.label,
            }
          : null,
      });
    }
    return originalReplaceTrack!.apply(this, args);
  };
  replaceTrackProbeInstalled = true;
}

/** Read-only toggle: localStorage, URL ?sendPathProbe=1, or NEXT_PUBLIC_VSP_WEBRTC_SEND_PATH_PROBE=1 */
export function isWebRtcSendPathProbeEnabled(): boolean {
  if (process.env.NEXT_PUBLIC_VSP_WEBRTC_SEND_PATH_PROBE === '1') return true;
  if (typeof window === 'undefined') return false;

  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored === '1') return true;
  if (stored === '0') return false;

  try {
    const params = new URLSearchParams(window.location.search);
    if (params.get('sendPathProbe') === '1') return true;
  } catch {
    // ignore malformed location
  }

  return false;
}

export function setWebRtcSendPathProbeEnabled(enabled: boolean) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, enabled ? '1' : '0');
  logProbe(enabled ? 'probe.enabled-via-console' : 'probe.disabled-via-console');
}

function summarizeLocalStream(call: Call) {
  const extended = call as Call & {
    localStream?: MediaStream;
    options?: { localStream?: MediaStream };
  };
  const stream = extended.localStream ?? extended.options?.localStream ?? null;
  if (!stream) return { present: false, trackCount: 0, tracks: [] as unknown[] };

  return {
    present: true,
    trackCount: stream.getAudioTracks().length,
    tracks: stream.getAudioTracks().map((track) => ({
      id: track.id,
      label: track.label,
      enabled: track.enabled,
      readyState: track.readyState,
      muted: track.muted,
    })),
  };
}

function collectSenderSnapshots(pc: RTCPeerConnection): SendPathProbeSenderSnapshot[] {
  return pc.getSenders()
    .filter((sender) => sender.track?.kind === 'audio' || !sender.track)
    .map((sender, index) => ({
      index,
      trackId: sender.track?.id ?? null,
      enabled: sender.track?.enabled ?? null,
      readyState: sender.track?.readyState ?? null,
      muted: sender.track?.muted ?? null,
      label: sender.track?.label ?? null,
    }));
}

function logSdpCapture(label: string, sdp: SdpAudioCapture) {
  logProbe(`${label}:sdp`, sdp);
}

/**
 * Passive 1 Hz logging during an active call. No media mutations.
 * Enable via localStorage `vsp.webrtc.sendPathProbe=1`, URL `?sendPathProbe=1`,
 * or `NEXT_PUBLIC_VSP_WEBRTC_SEND_PATH_PROBE=1`.
 */
export function startWebRtcSendPathProbe(call: Call, label: string): () => void {
  if (!isWebRtcSendPathProbeEnabled()) {
    return () => {};
  }

  installReplaceTrackProbe();

  const pc = resolvePeerConnection(call);
  const startedAt = Date.now();
  let tick = 0;
  let stopped = false;
  let lastSdpSignature = '';

  logProbe('probe.start', {
    label,
    callId: call.id ?? null,
    hasPeerConnection: Boolean(pc),
    localStream: summarizeLocalStream(call),
    replaceTrackProbeInstalled,
  });

  const logSdpIfChanged = (reason: string) => {
    if (!pc) return;
    const capture = summarizeSdpAudioFromPeerConnection(pc);
    const signature = `${capture.localOffer?.direction}|${capture.remoteAnswer?.direction}|${capture.localOffer?.section?.slice(0, 80)}`;
    if (signature === lastSdpSignature) return;
    lastSdpSignature = signature;
    logSdpCapture(`${label}:${reason}`, capture);
  };

  logSdpIfChanged('initial');

  const onSignalingStateChange = () => {
    logSdpIfChanged(`signaling-${pc?.signalingState ?? 'unknown'}`);
  };

  pc?.addEventListener('signalingstatechange', onSignalingStateChange);

  const intervalId = window.setInterval(() => {
    if (stopped) return;

    const activePc = resolvePeerConnection(call) ?? pc;
    if (!activePc) {
      logProbe('probe.tick', { tick, elapsedMs: Date.now() - startedAt, warning: 'peerConnection unavailable' });
      tick += 1;
      return;
    }

    void activePc.getStats().then((stats) => {
      if (stopped) return;
      const payload: SendPathProbeTick = {
        tick,
        elapsedMs: Date.now() - startedAt,
        iceConnectionState: activePc.iceConnectionState,
        connectionState: activePc.connectionState,
        signalingState: activePc.signalingState,
        senders: collectSenderSnapshots(activePc),
        rtp: extractAudioRtpStats(stats),
        replaceTrackCallCount,
      };
      logProbe(`${label}:tick`, payload);
    }).catch((err) => {
      logProbe(`${label}:tick:getStats-failed`, { tick, err });
    });

    tick += 1;
  }, PROBE_INTERVAL_MS);

  return () => {
    if (stopped) return;
    stopped = true;
    window.clearInterval(intervalId);
    pc?.removeEventListener('signalingstatechange', onSignalingStateChange);
    logProbe('probe.stop', {
      label,
      callId: call.id ?? null,
      ticks: tick,
      replaceTrackCallCount,
    });
  };
}

declare global {
  interface Window {
    __vspSendPathProbe?: {
      enable: () => void;
      disable: () => void;
      isEnabled: () => boolean;
    };
  }
}

if (typeof window !== 'undefined') {
  window.__vspSendPathProbe = {
    enable: () => setWebRtcSendPathProbeEnabled(true),
    disable: () => setWebRtcSendPathProbeEnabled(false),
    isEnabled: isWebRtcSendPathProbeEnabled,
  };
}
