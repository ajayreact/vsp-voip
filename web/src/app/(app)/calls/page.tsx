'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Mic } from 'lucide-react';
import { DataTable } from '@/components/data-table';
import { getCalls } from '@/lib/api';
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

function callTypeLabel(type: string, label?: string) {
  return label || callTypeDisplayLabel(type);
}

export default function CallsPage() {
  const [calls, setCalls] = useState<CallRow[]>([]);

  useEffect(() => {
    getCalls(100).then((res) => setCalls((res.calls as CallRow[]) || []));
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="page-title">Call History</h2>
        <p className="page-subtitle">Inbound, outbound, and missed calls with duration and recordings</p>
      </div>

      <DataTable
        title="Call directory"
        data={calls}
        getRowId={(call) => call.id}
        emptyMessage="No call logs yet"
        columns={[
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
              call.recordingUrl ? (
                <Link
                  href="/recordings"
                  className="inline-flex items-center gap-1 text-sm font-medium text-indigo-600 hover:text-indigo-500"
                >
                  <Mic className="h-3.5 w-3.5" />
                  Listen
                </Link>
              ) : (
                <span className="text-slate-400">—</span>
              ),
          },
        ]}
      />
    </div>
  );
}
