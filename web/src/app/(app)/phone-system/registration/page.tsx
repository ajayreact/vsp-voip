'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Circle, Loader2 } from 'lucide-react';
import { PhoneSystemNav } from '@/components/phone-system-nav';
import { DataTable, type DataTableColumn } from '@/components/data-table';
import {
  getExtensionRegistration,
  getMe,
  isUnauthorizedError,
  type ExtensionRegistrationRow,
} from '@/lib/api';

export default function RegistrationMonitoringPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [rows, setRows] = useState<ExtensionRegistrationRow[]>([]);
  const [summary, setSummary] = useState({ total: 0, online: 0, offline: 0 });

  useEffect(() => {
    getMe()
      .then((user) => {
        if (!user.tenantId) {
          router.replace('/dashboard');
          return;
        }
        return getExtensionRegistration();
      })
      .then((res) => {
        if (!res) return;
        setRows(res.extensions);
        setSummary({ total: res.total, online: res.online, offline: res.offline });
      })
      .catch((err) => {
        if (isUnauthorizedError(err)) router.replace('/login');
        else setError(err instanceof Error ? err.message : 'Could not load registration');
      })
      .finally(() => setLoading(false));
  }, [router]);

  const columns: DataTableColumn<ExtensionRegistrationRow>[] = [
    {
      key: 'extensionNumber',
      header: 'Extension',
      sortable: true,
      render: (row) => (
        <Link href={`/phone-system/extensions/${row.extensionId}`} className="font-medium text-indigo-600 hover:underline">
          {row.extensionNumber} — {row.displayName}
        </Link>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      render: (row) => (
        <span className="inline-flex items-center gap-1.5 text-sm">
          {row.status === 'ONLINE' ? (
            <Circle className="h-2.5 w-2.5 fill-emerald-500 text-emerald-500" />
          ) : (
            <Circle className="h-2.5 w-2.5 fill-slate-300 text-slate-300" />
          )}
          {row.status === 'ONLINE' ? 'Online' : 'Offline'}
        </span>
      ),
    },
    {
      key: 'lastRegistrationAt',
      header: 'Last registration',
      sortable: true,
      sortValue: (row) => row.lastRegistrationAt || '',
      render: (row) => (row.lastRegistrationAt ? new Date(row.lastRegistrationAt).toLocaleString() : '—'),
    },
    {
      key: 'deviceCount',
      header: 'Devices',
      sortable: true,
      render: (row) => `${row.connectedDeviceCount} / ${row.deviceCount}`,
    },
    {
      key: 'doNotDisturb',
      header: 'DND',
      render: (row) => (row.doNotDisturb ? 'On' : 'Off'),
    },
    {
      key: 'callScreeningEnabled',
      header: 'Screening',
      render: (row) => (row.callScreeningEnabled ? 'On' : 'Off'),
    },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-slate-400">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        Loading registration status…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-medium text-slate-900">Registration monitoring</h2>
        <p className="text-sm text-slate-400">Live online/offline status for every extension.</p>
      </div>

      <PhoneSystemNav />

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs uppercase text-slate-500">Total extensions</p>
          <p className="mt-1 text-2xl font-semibold">{summary.total}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs uppercase text-slate-500">Online</p>
          <p className="mt-1 text-2xl font-semibold text-emerald-600">{summary.online}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs uppercase text-slate-500">Offline</p>
          <p className="mt-1 text-2xl font-semibold text-slate-600">{summary.offline}</p>
        </div>
      </div>

      <DataTable
        title="Extension registration"
        data={rows}
        columns={columns}
        getRowId={(row) => row.extensionId}
        emptyMessage="No extensions to monitor."
      />
    </div>
  );
}
