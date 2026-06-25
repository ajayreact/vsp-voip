'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useExclusiveAudio } from '@/hooks/use-exclusive-audio';
import {
  fetchAuthenticatedAudioUrl,
  revokeAuthenticatedAudioUrl,
} from '@/lib/media-playback';

type AuthenticatedAudioPlayerProps = {
  streamPath: string;
  className?: string;
  onPlay?: () => void;
  /** When set with playerId, only one player in the group may play at a time. */
  exclusiveGroup?: string;
  playerId?: string;
};

export function AuthenticatedAudioPlayer({
  streamPath,
  className,
  onPlay,
  exclusiveGroup,
  playerId,
}: AuthenticatedAudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [src, setSrc] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const stopPlayback = useCallback(() => {
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
    }
  }, []);

  const { claimPlayback } = useExclusiveAudio(exclusiveGroup, playerId, stopPlayback);

  useEffect(() => {
    let active = true;
    let objectUrl: string | null = null;

    async function load() {
      setLoading(true);
      setError('');
      try {
        objectUrl = await fetchAuthenticatedAudioUrl(streamPath);
        if (active) {
          setSrc(objectUrl);
        } else {
          revokeAuthenticatedAudioUrl(objectUrl);
        }
      } catch (err) {
        if (active) {
          setError(err instanceof Error ? err.message : 'Could not load audio');
          setSrc(null);
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    void load();

    return () => {
      active = false;
      revokeAuthenticatedAudioUrl(objectUrl);
    };
  }, [streamPath]);

  if (loading) {
    return <p className="mt-3 text-xs text-slate-400">Loading audio…</p>;
  }

  if (error) {
    return <p className="mt-3 text-xs text-red-600">{error}</p>;
  }

  if (!src) {
    return <p className="mt-3 text-xs text-slate-400">Audio unavailable</p>;
  }

  return (
    <audio
      ref={audioRef}
      controls
      preload="none"
      src={src}
      className={className ?? 'mt-3 w-full max-w-md'}
      onPlay={() => {
        claimPlayback();
        onPlay?.();
      }}
      onEnded={() => {
        stopPlayback();
      }}
    />
  );
}
