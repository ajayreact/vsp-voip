'use client';

import { useEffect, useRef, useState } from 'react';
import { useVoicemailPlayback } from '@/hooks/use-voicemail-playback';
import {
  fetchAuthenticatedAudioUrl,
  revokeAuthenticatedAudioUrl,
} from '@/lib/media-playback';

type AuthenticatedAudioPlayerProps = {
  streamPath: string;
  className?: string;
  onPlay?: () => void;
  /** When set, uses the app-wide singleton voicemail playback manager (one HTMLAudioElement). */
  playerId?: string;
};

function ManagedAuthenticatedAudioPlayer({
  streamPath,
  className,
  onPlay,
  playerId,
}: Required<Pick<AuthenticatedAudioPlayerProps, 'streamPath' | 'playerId'>> &
  AuthenticatedAudioPlayerProps) {
  const { isPlaying, isLoading, error, togglePlay } = useVoicemailPlayback(
    playerId,
    streamPath,
  );

  return (
    <div className={className ?? 'mt-3 w-full max-w-md'}>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => void togglePlay(onPlay)}
          disabled={isLoading}
          className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
        >
          {isLoading ? 'Loading…' : isPlaying ? 'Pause' : 'Play'}
        </button>
        {isPlaying ? (
          <span className="text-xs text-slate-500">Playing…</span>
        ) : null}
      </div>
      {error ? <p className="mt-2 text-xs text-red-600">{error}</p> : null}
    </div>
  );
}

function StandaloneAuthenticatedAudioPlayer({
  streamPath,
  className,
  onPlay,
}: AuthenticatedAudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [src, setSrc] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

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
      onPlay={onPlay}
    />
  );
}

export function AuthenticatedAudioPlayer(props: AuthenticatedAudioPlayerProps) {
  if (props.playerId) {
    return (
      <ManagedAuthenticatedAudioPlayer
        {...props}
        playerId={props.playerId}
        streamPath={props.streamPath}
      />
    );
  }
  return <StandaloneAuthenticatedAudioPlayer {...props} />;
}
