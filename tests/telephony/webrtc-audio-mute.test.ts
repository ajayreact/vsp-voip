import { describe, expect, it, vi } from 'vitest';
import type { Call } from '@telnyx/webrtc';
import {
  canWireRemoteCallAudio,
  setLocalAudioMuted,
  verifyLocalAudioSenders,
} from '@/lib/webrtc-audio';

function mockCall(overrides: Record<string, unknown> = {}): Call {
  const audioTrack = { kind: 'audio', enabled: true, readyState: 'live', muted: false };
  const localStream = { getAudioTracks: () => [audioTrack] };
  const remoteStream = {
    getAudioTracks: () => [{ kind: 'audio', enabled: true, readyState: 'live', muted: false }],
  };

  return {
    id: 'call-1',
    state: 'active',
    localStream,
    remoteStream,
    muteAudio: vi.fn(),
    unmuteAudio: vi.fn(),
    ...overrides,
  } as Call;
}

describe('webrtc-audio mute + wire guards', () => {
  it('keeps local senders disabled while muted during verifyLocalAudioSenders', () => {
    const track = { kind: 'audio', enabled: true, readyState: 'live', muted: false };
    const pc = {
      getSenders: () => [{ track }],
    } as unknown as RTCPeerConnection;

    const call = mockCall({ peer: { instance: pc } });
    setLocalAudioMuted(call, true);
    verifyLocalAudioSenders(call, pc);

    expect(track.enabled).toBe(false);
    expect((call as Call & { muteAudio?: () => void }).muteAudio).toHaveBeenCalled();
  });

  it('can wire audio when remoteStream exists before peer connection', () => {
    const call = mockCall();
    expect(canWireRemoteCallAudio(call)).toBe(true);
  });

  it('can wire audio when call is active even without remoteStream yet', () => {
    const call = mockCall({ remoteStream: undefined, state: 'active' });
    expect(canWireRemoteCallAudio(call)).toBe(true);
  });
});
