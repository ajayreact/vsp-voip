'use client';

import { useCallback, useEffect, useRef } from 'react';
import {
  releaseExclusivePlayback,
  requestExclusivePlayback,
} from '@/lib/exclusive-audio-session';

export function useExclusiveAudio(
  group: string | undefined,
  playerId: string | undefined,
  stopPlayback: () => void,
) {
  const stopRef = useRef(stopPlayback);
  stopRef.current = stopPlayback;

  const claimPlayback = useCallback(() => {
    if (!group || !playerId) return;
    requestExclusivePlayback(group, playerId, () => stopRef.current());
  }, [group, playerId]);

  useEffect(() => {
    if (!group || !playerId) return undefined;
    return () => releaseExclusivePlayback(group, playerId);
  }, [group, playerId]);

  return { claimPlayback };
}
