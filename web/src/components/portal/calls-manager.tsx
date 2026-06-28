'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Mic } from 'lucide-react';
import { DataTable, type DataTableColumn } from '@/components/data-table';
import { PortalPageHeader } from '@/components/portal/page-header';
import { getCalls, getMe, isUnauthorizedError } from '@/lib/api';
import { callTypeBadgeClass, callTypeDisplayLabel } from '@/lib/call-type-labels';
import { formatPhoneNumber } from '@/lib/phone';

type CallRow = {
  id: string;
  callSid: string;
  from: string;
  to: string;
  direction: string;
  status: string;
  callType: string;
  callTypeLabel?: string;
  durationSeconds: number | null;
  durationLabel: string;
  createdAt: string;
  recordingId: string | null;
  recordingUrl: string | null;
};

type DirectionFilter = 'all' | 'inbound' | 'outbound';

function callTypeLabel(type: string, label?: string) {
  return label || callTypeDisplayLabel(type);
}

export function CallsManagerPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [calls, setCalls] = useState<CallRow[]>([]);
  const [direction, setDirection] = useState<DirectionFilter>('all');

  const reload = useCallback(async () => {
    const res = await getCalls(200);
    setCalls((res.calls as CallRow[]) || []);
  }, []);

  useEffect(() => {
    getMe()
      .then((user) => {
        if (!user.tenantId) {
          router.replace('/dashboard');
          return;
        }
        return reload();
      })
      .catch((err) => {
        if (isUnauthorizedError(err)) router.replace('/login');
        else setError(err instanceof Error ? err.message : 'Could not load call history');
      })
      .finally(() => setLoading(false));
  }, [router, reload]);

  const filtered = useMemo(() => {
    if (direction === 'all') return calls;
    return calls.filter((c) => c.direction === direction);
  }, [calls, direction]);

  const stats = useMemo(() => {
    const inbound = calls.filter((c) => c.direction === 'inbound').length;
    const outbound = calls.filter((c) => c.direction === 'outbound').length;
    const withRecording = calls.filter((c) => c.recordingUrl || c.recordingId).length;
    return { total: calls.length, inbound, outbound, withRecording };
  }, [calls]);

  const columns: DataTableColumn<CallRow>[] = [
    {
      key: 'callType',
      header: 'Type',
      sortable: true,
      render: (call) => (
        <span className={`rounded-full px-2.5 py-1 text-xs font-medium ring-1 ${callTypeBadgeClass(call.callType)}`}>
          {callTypeLabel(call.callType, call.callTypeLabel)}
        </span>
      ),
    },
    {
      key: 'direction',
      header: 'Direction',
      sortable: true,
      render: (call) => (
        <span className="capitalize text-slate-600">{call.direction || '—'}</span>
      ),
    },
    {
      key: 'from',
      header: 'From',
      sortable: true,
      render: (call) => formatPhoneNumber(call.from),
    },
    {
      key: 'to',
      header: 'To',
      sortable: true,
      render: (call) => formatPhoneNumber(call.to),
    },
    {
      key: 'durationLabel',
      header: 'Duration',
      sortable: true,
      sortValue: (call) => call.durationSeconds ?? -1,
      render: (call) => call.durationLabel || '—',
    },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      render: (call) => <span className="capitalize text-slate-600">{call.status}</span>,
    },
    {
      key: 'createdAt',
      header: 'Time',
      sortable: true,
      sortValue: (call) => new Date(call.createdAt),
      render: (call) => new Date(call.createdAt).toLocaleString(),
    },
    {
      key: 'recording',
      header: 'Recording',
      searchable: false,
      sortable: false,
      render: (call) =>
        call.recordingUrl || call.recordingId ? (
          <Link
            href={call.recordingId ? `/recordings?highlight=${call.recordingId}` : '/recordings'}
            className="inline-flex items-center gap-1 text-sm font-medium text-indigo-600 hover:text-indigo-500"
          >
            <Mic className="h-3.5 w-3.5" />
            Listen
          </Link>
        ) : (
          <span className="text-slate-400">—</span>
        ),
    },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-slate-400">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        Loading call history…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PortalPageHeader
        title="Call history"
        description="Inbound, outbound, and missed calls. Read-only administration — no browser calling."
        actions={
          <div className="flex gap-2">
            {(['all', 'inbound', 'outbound'] as DirectionFilter[]).map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDirection(d)}
                className={direction === d ? 'filter-btn filter-btn-active' : 'filter-btn'}
              >
                {d === 'all' ? 'All' : d.charAt(0).toUpperCase() + d.slice(1)}
              </button>
            ))}
          </div>
        }
      />

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="panel-card p-4">
          <p className="text-xs uppercase text-slate-500">Recent calls</p>
          <p className="mt-1 text-2xl font-semibold">{stats.total}</p>
        </div>
        <div className="panel-card p-4">
          <p className="text-xs uppercase text-slate-500">Inbound</p>
          <p className="mt-1 text-2xl font-semibold text-blue-600">{stats.inbound}</p>
        </div>
        <div className="panel-card p-4">
          <p className="text-xs uppercase text-slate-500">Outbound</p>
          <p className="mt-1 text-2xl font-semibold text-emerald-600">{stats.outbound}</p>
        </div>
        <div className="panel-card p-4">
          <p className="text-xs uppercase text-slate-500">With recording</p>
          <p className="mt-1 text-2xl font-semibold">{stats.withRecording}</p>
        </div>
      </div>

      <DataTable
        title="Call directory"
        data={filtered}
        getRowId={(call) => call.id}
        emptyMessage="No call logs yet"
        columns={columns}
      />
    </div>
  );
}
