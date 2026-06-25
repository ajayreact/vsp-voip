'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  voicemailPlaybackManager,
  type VoicemailPlaybackState,
} from '@/lib/voicemail-playback-manager';

export function useVoicemailPlayback(
  playerId: string,
  streamPath: string,
  durationHint?: number | null,
) {
  const [state, setState] = useState<VoicemailPlaybackState>(
    () => voicemailPlaybackManager.getState(),
  );

  useEffect(() => voicemailPlaybackManager.subscribe(setState), []);

  const isActive = state.activePlayerId === playerId;
  const isPlaying = isActive && state.status === 'playing';
  const isLoading = isActive && state.status === 'loading';
  const currentTime = isActive ? state.currentTime : 0;
  const duration = isActive && state.duration > 0
    ? state.duration
    : (durationHint ?? 0);
  const error = isActive ? state.error : null;

  const togglePlay = useCallback(
    async (onPlayStart?: () => void) => {
      await voicemailPlaybackManager.toggle(playerId, streamPath, { onPlayStart });
    },
    [playerId, streamPath],
  );

  return {
    isActive,
    isPlaying,
    isLoading,
    currentTime,
    duration,
    error,
    togglePlay,
  };
}
