import type { Call } from '@telnyx/webrtc';
import { logDiagnosticTimeline } from '@/lib/telephony/logger';

type PeerLike = {
  instance?: RTCPeerConnection;
  peerConnection?: RTCPeerConnection;
  onAddRemoteStream?: (session: unknown, stream: MediaStream) => void;
};

/** Telnyx SDK 2.27.x stores RTCPeerConnection on call.peer.instance (see Peer.d.ts). */
export function resolvePeerConnection(call: Call): RTCPeerConnection | null {
  const extended = call as Call & {
    peer?: PeerLike | null;
    peerConnection?: RTCPeerConnection | null;
  };
  const peer = extended.peer;
  return peer?.instance ?? peer?.peerConnection ?? extended.peerConnection ?? null;
}

function getPeer(call: Call): PeerLike | null {
  const peer = (call as Call & { peer?: PeerLike }).peer;
  return peer ?? null;
}

function enableStreamTracks(stream: MediaStream | null | undefined) {
  if (!stream) return 0;
  let enabled = 0;
  for (const track of stream.getAudioTracks()) {
    if (!track.enabled) track.enabled = true;
    enabled += 1;
  }
  return enabled;
}

function enableReceiverTracks(pc: RTCPeerConnection | undefined) {
  if (!pc) return 0;
  let enabled = 0;
  for (const receiver of pc.getReceivers()) {
    const track = receiver.track;
    if (track?.kind === 'audio' && !track.enabled) {
      track.enabled = true;
      enabled += 1;
    }
  }
  return enabled;
}

function enableSenderTracks(pc: RTCPeerConnection | undefined) {
  if (!pc) return 0;
  let enabled = 0;
  for (const sender of pc.getSenders()) {
    const track = sender.track;
    if (track?.kind === 'audio') {
      if (!track.enabled) track.enabled = true;
      enabled += 1;
    }
  }
  return enabled;
}

export type LocalAudioSenderStatus = {
  senderCount: number;
  liveEnabledCount: number;
  senders: Array<{
    enabled: boolean;
    readyState: MediaStreamTrackState;
    muted: boolean;
  }>;
};

type CallWithMuteIntent = Call & {
  muteAudio?: () => void;
  unmuteAudio?: () => void;
  localStream?: MediaStream;
  isAudioMuted?: boolean;
  _vspMuteIntent?: boolean;
};

function isLocalAudioIntentionallyMuted(call: Call): boolean {
  const extended = call as CallWithMuteIntent;
  return Boolean(extended._vspMuteIntent ?? extended.isAudioMuted);
}

/** Documented Telnyx SDK mute/unmute with local track sync. */
export function setLocalAudioMuted(call: Call, muted: boolean) {
  const extended = call as CallWithMuteIntent;

  if (muted) {
    extended._vspMuteIntent = true;
    try {
      extended.muteAudio?.();
    } catch {
      // SDK mute API failed — fall through to track-level mute
    }
  } else {
    try {
      extended.unmuteAudio?.();
    } catch {
      // SDK unmute API failed — fall through to track-level restore
    }
    extended._vspMuteIntent = false;
  }

  const pc = resolvePeerConnection(call) ?? undefined;
  for (const sender of pc?.getSenders() ?? []) {
    const track = sender.track;
    if (track?.kind === 'audio') {
      track.enabled = !muted;
    }
  }
  if (extended.localStream) {
    for (const track of extended.localStream.getAudioTracks()) {
      track.enabled = !muted;
      logDiagnosticTimeline('media.localTrack.enabled', {}, {
        enabled: track.enabled,
        muted,
        readyState: track.readyState,
      });
    }
  }
}

export function readCallAudioMuted(call: Call): boolean {
  const extended = call as CallWithMuteIntent;
  return Boolean(extended._vspMuteIntent ?? extended.isAudioMuted);
}

export function readCallHeld(call: Call): boolean {
  return normalizeSdkCallState(call.state) === 'held';
}

function normalizeSdkCallState(state: string | number | undefined | null): string {
  if (typeof state === 'number' && Number.isFinite(state)) {
    const states = [
      'new', 'requesting', 'trying', 'recovering', 'ringing', 'answering',
      'early', 'active', 'held', 'hangup', 'destroy', 'purge',
    ];
    return states[state] ?? String(state);
  }
  return String(state ?? '').trim().toLowerCase();
}

/** Enable and verify local microphone send path (inbound + outbound). */
export function verifyLocalAudioSenders(
  call: Call,
  pc?: RTCPeerConnection,
): LocalAudioSenderStatus {
  const peerPc = pc ?? resolvePeerConnection(call) ?? undefined;
  const muted = isLocalAudioIntentionallyMuted(call);

  if (!muted) {
    enableStreamTracks((call as Call & { localStream?: MediaStream }).localStream);
    enableSenderTracks(peerPc);
  }

  const senders = (peerPc?.getSenders() ?? [])
    .filter((sender) => sender.track?.kind === 'audio')
    .map((sender) => ({
      enabled: sender.track!.enabled,
      readyState: sender.track!.readyState,
      muted: sender.track!.muted,
    }));

  return {
    senderCount: senders.length,
    liveEnabledCount: senders.filter(
      (sender) => sender.enabled && sender.readyState === 'live' && !sender.muted,
    ).length,
    senders,
  };
}

export function collectRemoteStream(pc: RTCPeerConnection | undefined): MediaStream | null {
  if (!pc) return null;

  const tracks = pc.getReceivers()
    .map((receiver) => receiver.track)
    .filter((track): track is MediaStreamTrack => (
      track?.kind === 'audio' && track.readyState === 'live'
    ));

  if (!tracks.length) return null;
  return new MediaStream(tracks);
}

function resolveRemoteStream(call: Call, pc: RTCPeerConnection | undefined): MediaStream | null {
  const sdkStream = call.remoteStream;
  if (sdkStream?.getAudioTracks().length) {
    return sdkStream;
  }
  return collectRemoteStream(pc);
}

function streamsShareLiveAudio(
  current: MediaProvider | null | undefined,
  next: MediaStream,
): boolean {
  if (!current || !(current instanceof MediaStream)) return false;
  if (current === next) return true;
  const currentTracks = current.getAudioTracks().filter((track) => track.readyState === 'live');
  const nextTracks = next.getAudioTracks().filter((track) => track.readyState === 'live');
  if (!currentTracks.length || currentTracks.length !== nextTracks.length) return false;
  return currentTracks.every((track, index) => track.id === nextTracks[index]?.id);
}

/** Telnyx SDK may expose remote media on call.remoteStream before peer.instance is populated. */
export function canWireRemoteCallAudio(call: Call): boolean {
  if (resolvePeerConnection(call)) return true;
  if (call.remoteStream?.getAudioTracks().length) return true;
  const state = normalizeSdkCallState(call.state);
  return state === 'active' || state === 'early' || state === 'held';
}

export async function attachRemoteCallAudio(
  call: Call,
  audioEl: HTMLAudioElement | null,
): Promise<boolean> {
  if (!audioEl) return false;

  const pc = resolvePeerConnection(call) ?? undefined;
  verifyLocalAudioSenders(call, pc);
  enableReceiverTracks(pc);
  enableStreamTracks(call.remoteStream);

  const stream = resolveRemoteStream(call, pc);
  if (!stream) return false;

  enableStreamTracks(stream);

  const alreadyPlayingSameStream = streamsShareLiveAudio(audioEl.srcObject, stream)
    && !audioEl.paused
    && audioEl.currentTime > 0;

  if (alreadyPlayingSameStream) {
    return true;
  }

  if (!streamsShareLiveAudio(audioEl.srcObject, stream)) {
    audioEl.srcObject = stream;
  }

  audioEl.muted = false;
  audioEl.volume = 1;

  if (!audioEl.paused && streamsShareLiveAudio(audioEl.srcObject, stream)) {
    return true;
  }

  try {
    await audioEl.play();
    logDiagnosticTimeline('media.remoteAudio.play', {}, {
      muted: audioEl.muted,
      volume: audioEl.volume,
      paused: audioEl.paused,
    });
    return true;
  } catch (err) {
    logDiagnosticTimeline('media.remoteAudio.play.failed', {}, {
      error: err instanceof Error ? err.message : String(err),
    });
    return false;
  }
}

export function wireWebCallAudio(
  call: Call,
  audioEl: HTMLAudioElement | null,
  onPlaybackBlocked?: () => void,
): () => void {
  const peer = getPeer(call);
  let stopped = false;
  let fallbackTimer: number | null = null;

  const refresh = () => {
    if (stopped) return;
    const pc = resolvePeerConnection(call) ?? undefined;
    verifyLocalAudioSenders(call, pc);
    void attachRemoteCallAudio(call, audioEl).then((playing) => {
      if (stopped) return;
      if (playing) {
        if (fallbackTimer != null) {
          window.clearInterval(fallbackTimer);
          fallbackTimer = null;
        }
        return;
      }
      onPlaybackBlocked?.();
      if (fallbackTimer == null) {
        fallbackTimer = window.setInterval(refresh, 2000);
      }
    });
  };

  refresh();

  const previousOnAddRemoteStream = peer?.onAddRemoteStream;
  if (peer) {
    peer.onAddRemoteStream = (session, stream) => {
      previousOnAddRemoteStream?.(session, stream);
      enableStreamTracks(stream);
      refresh();
    };
  }

  const pc = resolvePeerConnection(call);
  const previousOntrack = pc?.ontrack ?? null;
  if (pc) {
    pc.ontrack = (event) => {
      previousOntrack?.call(pc, event);
      if (event.track.kind !== 'audio') return;
      event.track.enabled = true;
      if (event.streams[0]) {
        enableStreamTracks(event.streams[0]);
      }
      refresh();
    };
  }

  return () => {
    stopped = true;
    if (fallbackTimer != null) {
      window.clearInterval(fallbackTimer);
      fallbackTimer = null;
    }
    if (peer) {
      peer.onAddRemoteStream = previousOnAddRemoteStream ?? undefined;
    }
    if (pc) {
      pc.ontrack = previousOntrack;
    }
  };
}

export function detachRemoteCallAudio(audioEl: HTMLAudioElement | null) {
  if (!audioEl) return;
  logDiagnosticTimeline('media.detachCallMedia', {}, {
    paused: audioEl.paused,
    hadSrcObject: Boolean(audioEl.srcObject),
  });
  audioEl.pause();
  logDiagnosticTimeline('media.remoteAudio.pause', {}, {});
  audioEl.srcObject = null;
}
