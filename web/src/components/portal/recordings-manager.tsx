'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Download, Loader2, RefreshCw, Trash2 } from 'lucide-react';
import { AuthenticatedAudioPlayer } from '@/components/authenticated-audio-player';
import { DataTable, type DataTableColumn } from '@/components/data-table';
import { PortalPageHeader } from '@/components/portal/page-header';
import {
  deleteCallRecording,
  getCallRecordings,
  getMe,
  isUnauthorizedError,
  syncCallRecordings,
  type CallRecordingRecord,
} from '@/lib/api';
import { downloadAuthenticatedFile } from '@/lib/media-download';
import { formatPhoneNumber } from '@/lib/phone';

function formatDuration(seconds: number | null) {
  if (seconds == null || !Number.isFinite(seconds)) return '—';
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
}

type RecordingRow = CallRecordingRecord & { playing?: boolean };

export function RecordingsManagerPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const highlightId = searchParams.get('highlight');

  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState('');
  const [syncMessage, setSyncMessage] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [recordings, setRecordings] = useState<RecordingRow[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(highlightId);

  const reload = useCallback(async () => {
    const res = await getCallRecordings(100);
    setRecordings(res.recordings);
  }, []);

  useEffect(() => {
    getMe()
      .then((user) => {
        if (!user.tenantId) {
          router.replace('/dashboard');
          return;
        }
        setIsAdmin(user.role === 'TENANT_ADMIN' || user.role === 'SUPER_ADMIN');
        return reload();
      })
      .catch((err) => {
        if (isUnauthorizedError(err)) router.replace('/login');
        else setError(err instanceof Error ? err.message : 'Could not load recordings');
      })
      .finally(() => setLoading(false));
  }, [router, reload]);

  useEffect(() => {
    if (highlightId) setExpandedId(highlightId);
  }, [highlightId]);

  async function onSync() {
    setSyncing(true);
    setSyncMessage('');
    setError('');
    try {
      const result = await syncCallRecordings();
      await reload();
      setSyncMessage(
        result.imported > 0
          ? `Imported ${result.imported} new recording${result.imported === 1 ? '' : 's'}.`
          : 'No new recordings found.',
      );
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
      if (expandedId === id) setExpandedId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
    }
  }

  async function onDownload(rec: CallRecordingRecord) {
    try {
      await downloadAuthenticatedFile(
        `/api/tenant/recordings/${rec.id}/stream`,
        `recording-${rec.id}.mp3`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Download failed');
    }
  }

  const columns: DataTableColumn<RecordingRow>[] = [
    {
      key: 'createdAt',
      header: 'Date',
      sortable: true,
      sortValue: (row) => new Date(row.createdAt),
      render: (row) => new Date(row.createdAt).toLocaleString(),
    },
    {
      key: 'from',
      header: 'Caller',
      sortable: true,
      render: (row) => formatPhoneNumber(row.from),
    },
    {
      key: 'to',
      header: 'Callee',
      sortable: true,
      render: (row) => formatPhoneNumber(row.to),
    },
    {
      key: 'durationSeconds',
      header: 'Duration',
      sortable: true,
      sortValue: (row) => row.durationSeconds ?? -1,
      render: (row) => formatDuration(row.durationSeconds),
    },
    {
      key: 'actions',
      header: 'Actions',
      searchable: false,
      sortable: false,
      render: (row) => (
        <div className="flex flex-wrap gap-1">
          <button
            type="button"
            onClick={() => setExpandedId(expandedId === row.id ? null : row.id)}
            className="rounded-lg px-2 py-1 text-xs font-medium text-indigo-600 hover:bg-indigo-50"
          >
            Play
          </button>
          <button
            type="button"
            onClick={() => onDownload(row)}
            className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100"
          >
            <Download className="h-3.5 w-3.5" />
            Download
          </button>
          {isAdmin ? (
            <button
              type="button"
              onClick={() => onDelete(row.id)}
              className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete
            </button>
          ) : null}
        </div>
      ),
    },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-slate-400">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        Loading recordings…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PortalPageHeader
        title="Recordings"
        description="Answered call recordings. Administration only — no browser calling."
        actions={
          isAdmin ? (
            <button
              type="button"
              onClick={onSync}
              disabled={syncing}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
              {syncing ? 'Syncing…' : 'Sync recordings'}
            </button>
          ) : undefined
        }
      />

      {syncMessage ? <p className="text-sm text-indigo-600">{syncMessage}</p> : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <DataTable
        title="Call recordings"
        data={recordings}
        getRowId={(row) => row.id}
        emptyMessage="No call recordings yet. Enable recording in call routing, then sync after calls complete."
        columns={columns}
      />

      {expandedId ? (
        <div className="panel-card p-4">
          <p className="text-sm font-medium text-slate-900">Playback</p>
          <AuthenticatedAudioPlayer
            streamPath={`/api/tenant/recordings/${expandedId}/stream`}
            className="mt-3 w-full max-w-md"
          />
        </div>
      ) : null}
    </div>
  );
}
