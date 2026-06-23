'use client';

import { useState } from 'react';
import type { CallRecordingRecord } from '@/lib/api';
import { formatPhoneNumber } from '@/lib/phone';
import {
  downloadAuthenticatedStream,
  formatMediaDuration,
  formatMediaTimestamp,
  LazyStreamPlayer,
} from '@/components/lazy-stream-player';
import { trackSoftphoneEvent } from '@/lib/softphone-telemetry';

type RecordingsListProps = {
  recordings: CallRecordingRecord[];
  onError?: (message: string) => void;
};

function directionLabel(direction: string) {
  const value = direction.toLowerCase();
  if (value === 'outbound') return 'Outgoing';
  if (value === 'inbound') return 'Incoming';
  return direction.charAt(0).toUpperCase() + direction.slice(1);
}

export function RecordingsList({ recordings, onError }: RecordingsListProps) {
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  async function onDownload(rec: CallRecordingRecord) {
    setDownloadingId(rec.id);
    try {
      const safeFrom = rec.from.replace(/\D/g, '') || rec.id;
      await downloadAuthenticatedStream(
        `/api/tenant/recordings/${rec.id}/stream`,
        `recording-${safeFrom}-${rec.id.slice(0, 8)}.mp3`,
      );
    } catch (err) {
      onError?.(err instanceof Error ? err.message : 'Download failed');
    } finally {
      setDownloadingId(null);
    }
  }

  if (!recordings.length) {
    return (
      <p className="py-4 text-center text-sm text-[#1D1D1F]/45 dark:text-white/45">
        No recordings match your filters
      </p>
    );
  }

  return (
    <ul className="space-y-3">
      {recordings.map((rec) => (
        <li
          key={rec.id}
          className="rounded-2xl border border-white/50 bg-white/75 p-4 shadow-md backdrop-blur-md dark:border-white/10 dark:bg-white/[0.06]"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-base font-medium">
                {formatPhoneNumber(rec.direction?.toLowerCase() === 'outbound' ? rec.to : rec.from)}
              </p>
              <p className="mt-1 text-sm text-[#1D1D1F]/65 dark:text-white/65">
                {directionLabel(rec.direction)}
              </p>
              <p className="mt-1 text-sm text-[#1D1D1F]/55 dark:text-white/55">
                Duration: {formatMediaDuration(rec.durationSeconds)}
              </p>
              <p className="mt-1 text-xs text-[#1D1D1F]/45 dark:text-white/45">
                {formatMediaTimestamp(rec.createdAt)}
              </p>
            </div>
            <button
              type="button"
              onClick={() => void onDownload(rec)}
              disabled={downloadingId === rec.id}
              className="rounded-full border border-white/50 bg-white/80 px-3 py-1.5 text-xs font-semibold text-[#1D1D1F] shadow-sm backdrop-blur-md transition-all duration-200 hover:scale-105 active:scale-95 disabled:opacity-50 dark:border-white/10 dark:bg-white/10 dark:text-white"
            >
              {downloadingId === rec.id ? '…' : '⬇ Download'}
            </button>
          </div>

          <LazyStreamPlayer
            className="mt-3"
            streamPath={`/api/tenant/recordings/${rec.id}/stream`}
            durationSeconds={rec.durationSeconds}
            onPlayStart={() => {
              trackSoftphoneEvent('Recording Played', {
                recordingId: rec.id,
                direction: rec.direction,
                from: rec.from,
                to: rec.to,
              });
            }}
          />
        </li>
      ))}
    </ul>
  );
}
