'use client';

import { useState } from 'react';
import { deleteVoicemail, markVoicemailRead, type VoicemailRecord } from '@/lib/api';
import { formatPhoneNumber } from '@/lib/phone';
import {
  formatMediaDuration,
  formatMediaTimestamp,
  LazyStreamPlayer,
} from '@/components/lazy-stream-player';
import { trackSoftphoneEvent } from '@/lib/softphone-telemetry';

type VoicemailListProps = {
  voicemails: VoicemailRecord[];
  onChange: () => void;
  onError?: (message: string) => void;
};

export function VoicemailList({ voicemails, onChange, onError }: VoicemailListProps) {
  const [busyId, setBusyId] = useState<string | null>(null);

  async function onMarkRead(vm: VoicemailRecord) {
    if (vm.isRead) return;
    try {
      await markVoicemailRead(vm.id);
      onChange();
    } catch {
      /* ignore mark-read errors */
    }
  }

  async function onDelete(id: string) {
    if (!confirm('Delete this voicemail?')) return;
    setBusyId(id);
    try {
      await deleteVoicemail(id);
      onChange();
    } catch (err) {
      onError?.(err instanceof Error ? err.message : 'Delete failed');
    } finally {
      setBusyId(null);
    }
  }

  if (!voicemails.length) {
    return (
      <p className="py-4 text-center text-sm text-[#1D1D1F]/45 dark:text-white/45">
        No voicemails match your filters
      </p>
    );
  }

  return (
    <ul className="space-y-3">
      {voicemails.map((vm) => (
        <li
          key={vm.id}
          className="rounded-2xl border border-white/50 bg-white/75 p-4 shadow-md backdrop-blur-md dark:border-white/10 dark:bg-white/[0.06]"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                {!vm.isRead ? (
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-[#007AFF] shadow-[0_0_0_4px_rgba(0,122,255,0.15)]" />
                ) : null}
                <p className="truncate text-base font-medium">
                  {formatPhoneNumber(vm.from)}
                </p>
              </div>
              <p className="mt-1 text-sm text-[#1D1D1F]/65 dark:text-white/65">
                {formatMediaTimestamp(vm.createdAt)}
              </p>
              <p className="mt-1 text-sm text-[#1D1D1F]/55 dark:text-white/55">
                Duration: {formatMediaDuration(vm.durationSeconds)}
                {!vm.isRead ? ' · Unread' : ' · Read'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => void onDelete(vm.id)}
              disabled={busyId === vm.id}
              className="rounded-full px-2 py-1 text-sm transition-all duration-200 hover:scale-105 active:scale-95 disabled:opacity-50"
              aria-label="Delete voicemail"
            >
              🗑
            </button>
          </div>

          <LazyStreamPlayer
            className="mt-3"
            streamPath={`/api/tenant/voicemails/${vm.id}/stream`}
            durationSeconds={vm.durationSeconds}
            onPlayStart={() => {
              void onMarkRead(vm);
              trackSoftphoneEvent('Voicemail Played', {
                voicemailId: vm.id,
                from: vm.from,
              });
            }}
          />
        </li>
      ))}
    </ul>
  );
}
