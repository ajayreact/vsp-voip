'use client';

import { useCallback, useEffect, useState } from 'react';
import { AuthenticatedAudioPlayer } from '@/components/authenticated-audio-player';
import {
  deleteCallRecording,
  getCallRecordings,
  getRecordingSetupStatus,
  isUnauthorizedError,
  syncCallRecordings,
  type CallRecordingRecord,
  type RecordingSetupStatus,
} from '@/lib/api';

function formatDuration(seconds: number | null) {
  if (seconds == null || !Number.isFinite(seconds)) return '—';
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
}

export default function RecordingsPage() {
  const [recordings, setRecordings] = useState<CallRecordingRecord[]>([]);
  const [setup, setSetup] = useState<RecordingSetupStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState('');
  const [syncMessage, setSyncMessage] = useState('');

  const loadRecordings = useCallback(async () => {
    const res = await getCallRecordings(100);
    setRecordings(res.recordings);
  }, []);

  useEffect(() => {
    Promise.all([
      loadRecordings(),
      getRecordingSetupStatus().then((res) => setSetup(res.setup)),
    ])
      .catch((err) => {
        if (!isUnauthorizedError(err)) {
          setError(err instanceof Error ? err.message : 'Could not load recordings');
        }
      })
      .finally(() => setLoading(false));
  }, [loadRecordings]);

  async function onSync() {
    setSyncing(true);
    setSyncMessage('');
    setError('');
    try {
      const result = await syncCallRecordings();
      await loadRecordings();
      if (result.imported > 0) {
        setSyncMessage(`Imported ${result.imported} new recording${result.imported === 1 ? '' : 's'} from Telnyx.`);
      } else {
        setSyncMessage('No new recordings found in Telnyx yet. Place a call (15+ seconds), then sync again.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sync failed');
    } finally {
      setSyncing(false);
    }
  }

  async function onDelete(id: string) {
    if (!confirm('Delete this call recording?')) return;
    try {
      await deleteCallRecording(id);
      setRecordings((prev) => prev.filter((item) => item.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
    }
  }

  if (loading) {
    return <div className="py-24 text-center text-slate-400">Loading call recordings…</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-medium text-slate-900">Call Recordings</h2>
          <p className="text-sm text-slate-400">
            Recordings of answered inbound calls (forward/ring group) and outbound softphone calls.
            Voicemail messages are in Voicemail.
          </p>
        </div>
        <button
          type="button"
          onClick={onSync}
          disabled={syncing}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-slate-900 hover:bg-indigo-500 disabled:opacity-50"
        >
          {syncing ? 'Syncing…' : 'Sync from Telnyx'}
        </button>
      </div>

      {setup && !setup.webhooksReachable ? (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-900 space-y-2">
          <p>
            <strong>Local dev tip:</strong> Add <code className="text-amber-200">API_PUBLIC_URL=https://your-ngrok-url</code> to{' '}
            <code className="text-amber-200">.env</code> so Telnyx can POST recording webhooks instantly.
          </p>
          <p className="text-amber-200/80">
            Without it, use <strong>Sync from Telnyx</strong> after each call. Outbound auto-recording is{' '}
            {setup.outboundRecordingEnabled ? 'enabled' : 'not enabled yet'} on your Telnyx outbound profile.
          </p>
        </div>
      ) : null}

      {syncMessage ? <p className="text-sm text-indigo-400">{syncMessage}</p> : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <div className="space-y-3">
        {recordings.map((rec) => (
          <div
            key={rec.id}
            className="panel-card p-4"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-medium text-slate-900">
                  {rec.from}
                  <span className="ml-2 rounded bg-slate-100 px-2 py-0.5 text-xs capitalize text-slate-400">
                    {rec.direction}
                  </span>
                </p>
                <p className="text-sm text-slate-400">
                  To {rec.to} · {formatDuration(rec.durationSeconds)} ·{' '}
                  {new Date(rec.createdAt).toLocaleString()}
                </p>
              </div>
              <button
                type="button"
                onClick={() => onDelete(rec.id)}
                className="text-sm text-red-600 hover:text-red-700"
              >
                Delete
              </button>
            </div>
            <AuthenticatedAudioPlayer
              streamPath={`/api/tenant/recordings/${rec.id}/stream`}
              className="mt-3 w-full max-w-md"
            />
          </div>
        ))}
        {!recordings.length ? (
          <div className="panel-card px-5 py-10 text-center text-slate-500 space-y-3">
            <p>
              No call recordings yet. Enable recording in Call routing, then place a softphone call or answer a forwarded inbound call.
            </p>
            <p className="text-sm">
              After a call of at least 15 seconds, click <strong className="text-slate-400">Sync from Telnyx</strong> above.
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
