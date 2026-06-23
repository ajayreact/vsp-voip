import type { Call } from '@telnyx/webrtc';

type PeerLike = {
  peerConnection?: RTCPeerConnection;
  onAddRemoteStream?: (session: unknown, stream: MediaStream) => void;
};

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
  if (call.remoteStream?.getAudioTracks().length) {
    return call.remoteStream;
  }
  return collectRemoteStream(pc);
}

export async function attachRemoteCallAudio(
  call: Call,
  audioEl: HTMLAudioElement | null,
): Promise<boolean> {
  if (!audioEl) return false;

  const pc = getPeer(call)?.peerConnection;
  enableReceiverTracks(pc);
  enableStreamTracks(call.remoteStream);

  const stream = resolveRemoteStream(call, pc);
  if (!stream) return false;

  enableStreamTracks(stream);

  if (audioEl.srcObject !== stream) {
    audioEl.srcObject = stream;
  }

  audioEl.muted = false;
  audioEl.volume = 1;

  try {
    await audioEl.play();
    return true;
  } catch {
    return false;
  }
}

export function wireWebCallAudio(
  call: Call,
  audioEl: HTMLAudioElement | null,
  onPlaybackBlocked?: () => void,
): () => void {
  const peer = getPeer(call);
  const pc = peer?.peerConnection;

  const refresh = () => {
    attachRemoteCallAudio(call, audioEl).then((playing) => {
      if (!playing) onPlaybackBlocked?.();
    });
  };

  refresh();

  if (peer) {
    const previous = peer.onAddRemoteStream;
    peer.onAddRemoteStream = (session, stream) => {
      previous?.(session, stream);
      enableStreamTracks(stream);
      refresh();
    };
  }

  if (pc) {
    pc.ontrack = (event) => {
      if (event.track.kind === 'audio') {
        event.track.enabled = true;
        if (event.streams[0]) {
          enableStreamTracks(event.streams[0]);
          if (audioEl && audioEl.srcObject !== event.streams[0]) {
            audioEl.srcObject = event.streams[0];
            audioEl.play().catch(() => onPlaybackBlocked?.());
          }
        } else {
          refresh();
        }
      }
    };
  }

  const timerId = window.setInterval(refresh, 800);

  return () => window.clearInterval(timerId);
}

export function detachRemoteCallAudio(audioEl: HTMLAudioElement | null) {
  if (!audioEl) return;
  audioEl.pause();
  audioEl.srcObject = null;
}
