'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Download, Eye, Loader2 } from 'lucide-react';
import 'sweetalert2/dist/sweetalert2.min.css';
import Swal from 'sweetalert2';
import { DataTable, type DataTableColumn } from '@/components/data-table';
import { AiSummaryCard } from '@/components/ai/ai-summary-card';
import { TranscriptCard } from '@/components/ai/transcript-card';
import { PortalPageHeader } from '@/components/portal/page-header';
import { enrichCallRow } from '@/lib/call-enrichment';
import { getCalls, getExtensions, getMe, isUnauthorizedError } from '@/lib/api';
import { downloadAuthenticatedFile } from '@/lib/media-download';
import { formatPhoneNumber } from '@/lib/phone';
import { SWAL_THEME } from '@/lib/swal-theme';

type CallRow = {
  id: string;
  callSid: string;
  from: string;
  to: string;
  direction: string;
  status: string;
  durationSeconds: number | null;
  durationLabel: string;
  createdAt: string;
  recordingId: string | null;
  recordingUrl: string | null;
  extensionNumber: string;
  employeeName: string;
};

type DirectionFilter = 'all' | 'inbound' | 'outbound';

function callerLabel(call: CallRow) {
  return call.direction === 'inbound' ? formatPhoneNumber(call.from) : formatPhoneNumber(call.from);
}

function calleeLabel(call: CallRow) {
  return call.direction === 'inbound' ? formatPhoneNumber(call.to) : formatPhoneNumber(call.to);
}

export function CallsManagerPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [calls, setCalls] = useState<CallRow[]>([]);
  const [direction, setDirection] = useState<DirectionFilter>('all');
  const [selectedCallId, setSelectedCallId] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const [callsRes, extRes] = await Promise.all([getCalls(200), getExtensions()]);
    const extensions = extRes.extensions || [];
    setCalls(
      (callsRes.calls || []).map((call) =>
        enrichCallRow(call as Omit<CallRow, 'extensionNumber' | 'employeeName'>, extensions),
      ),
    );
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

  async function onViewDetails(call: CallRow) {
    setSelectedCallId(call.id);
    await Swal.fire({
      title: 'Call details',
      html: `
        <div style="text-align:left;font-size:14px;line-height:1.6">
          <p><strong>Time:</strong> ${new Date(call.createdAt).toLocaleString()}</p>
          <p><strong>Caller:</strong> ${formatPhoneNumber(call.from)}</p>
          <p><strong>Callee:</strong> ${formatPhoneNumber(call.to)}</p>
          <p><strong>Direction:</strong> ${call.direction}</p>
          <p><strong>Extension:</strong> ${call.extensionNumber}</p>
          <p><strong>Employee:</strong> ${call.employeeName}</p>
          <p><strong>Duration:</strong> ${call.durationLabel || '—'}</p>
          <p><strong>Status:</strong> ${call.status}</p>
          <p><strong>Call SID:</strong> <code style="font-size:11px">${call.callSid || '—'}</code></p>
          ${call.recordingId ? `<p><strong>Recording:</strong> Available</p>` : ''}
        </div>
      `,
      confirmButtonText: 'Close',
      ...SWAL_THEME,
    });
  }

  async function onDownload(call: CallRow) {
    if (!call.recordingId) return;
    try {
      await downloadAuthenticatedFile(
        `/api/tenant/recordings/${call.recordingId}/stream`,
        `recording-${call.id}.mp3`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Download failed');
    }
  }

  const columns: DataTableColumn<CallRow>[] = [
    {
      key: 'createdAt',
      header: 'Time',
      sortable: true,
      sortValue: (call) => new Date(call.createdAt),
      render: (call) => new Date(call.createdAt).toLocaleString(),
    },
    {
      key: 'from',
      header: 'Caller',
      sortable: true,
      render: (call) => callerLabel(call),
    },
    {
      key: 'to',
      header: 'Callee',
      sortable: true,
      render: (call) => calleeLabel(call),
    },
    {
      key: 'direction',
      header: 'Direction',
      sortable: true,
      render: (call) => <span className="capitalize text-slate-600">{call.direction || '—'}</span>,
    },
    {
      key: 'extensionNumber',
      header: 'Extension',
      sortable: true,
      sortValue: (call) => Number(call.extensionNumber) || 0,
    },
    {
      key: 'employeeName',
      header: 'Employee',
      sortable: true,
      headerClassName: 'hidden md:table-cell',
      className: 'hidden md:table-cell',
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
      key: 'actions',
      header: 'Actions',
      searchable: false,
      sortable: false,
      render: (call) => (
        <div className="flex flex-wrap gap-1">
          <button
            type="button"
            onClick={() => onViewDetails(call)}
            className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-indigo-600 hover:bg-indigo-50"
          >
            <Eye className="h-3.5 w-3.5" />
            Details
          </button>
          {call.recordingId ? (
            <button
              type="button"
              onClick={() => onDownload(call)}
              className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100"
            >
              <Download className="h-3.5 w-3.5" />
              Download
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
        Loading call history…
      </div>
    );
  }

  const inbound = calls.filter((c) => c.direction === 'inbound').length;
  const outbound = calls.filter((c) => c.direction === 'outbound').length;

  return (
    <div className="space-y-6">
      <PortalPageHeader
        title="Call history"
        description="Read-only call detail records. No browser calling or telephony controls."
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

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="panel-card p-4">
          <p className="text-xs uppercase text-slate-500">Recent calls</p>
          <p className="mt-1 text-2xl font-semibold">{calls.length}</p>
        </div>
        <div className="panel-card p-4">
          <p className="text-xs uppercase text-slate-500">Inbound</p>
          <p className="mt-1 text-2xl font-semibold text-blue-600">{inbound}</p>
        </div>
        <div className="panel-card p-4">
          <p className="text-xs uppercase text-slate-500">Outbound</p>
          <p className="mt-1 text-2xl font-semibold text-emerald-600">{outbound}</p>
        </div>
      </div>

      <DataTable
        title="Call directory"
        data={filtered}
        getRowId={(call) => call.id}
        emptyMessage="No call logs yet"
        columns={columns}
      />

      {selectedCallId ? (
        <>
          <TranscriptCard entityType="call" entityId={selectedCallId} />
          <AiSummaryCard entityType="call" entityId={selectedCallId} />
        </>
      ) : null}
    </div>
  );
}
