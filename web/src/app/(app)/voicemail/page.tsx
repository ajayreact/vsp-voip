'use client';

import { useEffect, useState } from 'react';
import { AuthenticatedAudioPlayer } from '@/components/authenticated-audio-player';
import { deleteVoicemail, getVoicemails, isUnauthorizedError, markVoicemailRead, type VoicemailRecord } from '@/lib/api';
import { formatPhoneNumber } from '@/lib/phone';

function formatDuration(seconds: number | null) {
  if (seconds == null || !Number.isFinite(seconds)) return '—';
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
}

export default function VoicemailPage() {
  const [voicemails, setVoicemails] = useState<VoicemailRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function load() {
    setLoading(true);
    setError('');
    try {
      const res = await getVoicemails(100);
      setVoicemails(res.voicemails);
    } catch (err) {
      if (!isUnauthorizedError(err)) {
        setError(err instanceof Error ? err.message : 'Could not load voicemails');
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function onPlay(vm: VoicemailRecord) {
    if (!vm.isRead) {
      try {
        await markVoicemailRead(vm.id);
        setVoicemails((prev) =>
          prev.map((item) => (item.id === vm.id ? { ...item, isRead: true } : item)),
        );
      } catch {
        /* ignore mark-read errors */
      }
    }
  }

  async function onDelete(id: string) {
    if (!confirm('Delete this voicemail?')) return;
    try {
      await deleteVoicemail(id);
      setVoicemails((prev) => prev.filter((item) => item.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
    }
  }

  if (loading) {
    return <div className="py-24 text-center text-slate-400">Loading voicemails…</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-medium text-slate-900">Voicemail</h2>
        <p className="text-sm text-slate-400">
          Messages left when calls are not answered or after hours (when enabled).
        </p>
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <div className="space-y-3">
        {voicemails.map((vm) => (
          <div
            key={vm.id}
            className={`rounded-xl border p-4 ${
              vm.isRead
                ? 'border-indigo-200 bg-indigo-50'
                : 'border-indigo-500/30 bg-indigo-500/5'
            }`}
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-medium text-slate-900">
                  {formatPhoneNumber(vm.from)}
                  {!vm.isRead ? (
                    <span className="ml-2 rounded bg-indigo-500/20 px-2 py-0.5 text-xs text-indigo-700">
                      New
                    </span>
                  ) : null}
                </p>
                <p className="text-sm text-slate-400">
                  To {formatPhoneNumber(vm.to)} · {formatDuration(vm.durationSeconds)} ·{' '}
                  {new Date(vm.createdAt).toLocaleString()}
                </p>
              </div>
              <button
                type="button"
                onClick={() => onDelete(vm.id)}
                className="text-sm text-red-600 hover:text-red-700"
              >
                Delete
              </button>
            </div>
            <AuthenticatedAudioPlayer
              streamPath={`/api/tenant/voicemails/${vm.id}/stream`}
              className="mt-3 w-full max-w-md"
              onPlay={() => onPlay(vm)}
            />
          </div>
        ))}
        {!voicemails.length ? (
          <div className="panel-card px-5 py-10 text-center text-slate-500">
            No voicemails yet. Enable voicemail in Call routing and test by calling when no one answers.
          </div>
        ) : null}
      </div>
    </div>
  );
}
