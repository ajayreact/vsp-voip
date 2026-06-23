'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  fetchAuthenticatedAudioUrl,
  revokeAuthenticatedAudioUrl,
} from '@/lib/media-playback';

function formatMediaTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return '00:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

type LazyStreamPlayerProps = {
  streamPath: string;
  durationSeconds?: number | null;
  onPlayStart?: () => void;
  className?: string;
};

export function LazyStreamPlayer({
  streamPath,
  durationSeconds,
  onPlayStart,
  className,
}: LazyStreamPlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [src, setSrc] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(durationSeconds ?? 0);
  const [error, setError] = useState('');

  useEffect(() => () => {
    revokeAuthenticatedAudioUrl(src);
  }, [src]);

  const ensureLoaded = useCallback(async () => {
    if (src) return src;
    setLoading(true);
    setError('');
    try {
      const objectUrl = await fetchAuthenticatedAudioUrl(streamPath);
      setSrc(objectUrl);
      return objectUrl;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load audio');
      return null;
    } finally {
      setLoading(false);
    }
  }, [src, streamPath]);

  const onTogglePlay = async () => {
    const audio = audioRef.current;
    if (playing && audio) {
      audio.pause();
      return;
    }

    const wasLoaded = Boolean(src);
    const objectUrl = await ensureLoaded();
    if (!objectUrl) return;

    if (!wasLoaded) {
      onPlayStart?.();
    }

    window.requestAnimationFrame(() => {
      void audioRef.current?.play();
    });
  };

  const progress = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;

  return (
    <div className={className}>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => void onTogglePlay()}
          disabled={loading}
          className="rounded-full border border-white/50 bg-white/80 px-3 py-1.5 text-xs font-semibold text-[#007AFF] shadow-sm backdrop-blur-md transition-all duration-200 hover:scale-105 active:scale-95 disabled:opacity-50 dark:border-white/10 dark:bg-white/10 dark:text-[#0A84FF]"
        >
          {loading ? 'Loading…' : playing ? '⏸ Pause' : '▶ Play'}
        </button>
        <span className="text-xs tabular-nums text-[#1D1D1F]/55 dark:text-white/55">
          {formatMediaTime(currentTime)} / {formatMediaTime(duration)}
        </span>
      </div>

      <div className="mt-3 h-2 overflow-hidden rounded-full bg-black/5 dark:bg-white/10">
        <div
          className="h-full rounded-full bg-gradient-to-r from-[#007AFF] to-[#34C759] transition-all duration-150"
          style={{ width: `${progress}%` }}
        />
      </div>

      {error ? (
        <p className="mt-2 text-xs text-red-500">{error}</p>
      ) : null}

      {src ? (
        <audio
          ref={audioRef}
          src={src}
          preload="none"
          className="sr-only"
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onEnded={() => {
            setPlaying(false);
            setCurrentTime(0);
          }}
          onTimeUpdate={(event) => {
            setCurrentTime(event.currentTarget.currentTime);
          }}
          onLoadedMetadata={(event) => {
            if (Number.isFinite(event.currentTarget.duration)) {
              setDuration(event.currentTarget.duration);
            }
          }}
        />
      ) : null}
    </div>
  );
}

export async function downloadAuthenticatedStream(
  streamPath: string,
  filename: string,
) {
  const objectUrl = await fetchAuthenticatedAudioUrl(streamPath);
  try {
    const anchor = document.createElement('a');
    anchor.href = objectUrl;
    anchor.download = filename;
    anchor.rel = 'noopener';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  } finally {
    window.setTimeout(() => revokeAuthenticatedAudioUrl(objectUrl), 1000);
  }
}

export function formatMediaDuration(seconds: number | null | undefined) {
  if (seconds == null || !Number.isFinite(seconds)) return '—';
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
}

export function formatMediaTimestamp(iso: string) {
  const date = new Date(iso);
  const now = new Date();
  const time = date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  if (date.toDateString() === now.toDateString()) {
    return `Today ${time}`;
  }
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) {
    return `Yesterday ${time}`;
  }
  return `${date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })} ${time}`;
}
