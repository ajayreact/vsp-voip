'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { PhoneSystemNav } from '@/components/phone-system-nav';
import { DataTable, type DataTableColumn } from '@/components/data-table';
import {
  getExtensionDevices,
  getMe,
  isUnauthorizedError,
  type ExtensionDeviceRecord,
} from '@/lib/api';

function deviceStatusBadge(status: string) {
  const styles: Record<string, string> = {
    ONLINE: 'bg-emerald-50 text-emerald-700',
    OFFLINE: 'bg-slate-100 text-slate-600',
    EXPIRED: 'bg-amber-50 text-amber-700',
  };
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${styles[status] || styles.OFFLINE}`}>
      {status.charAt(0) + status.slice(1).toLowerCase()}
    </span>
  );
}

export default function PhoneSystemDevicesPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [totalDevices, setTotalDevices] = useState(0);
  const [registeredDevices, setRegisteredDevices] = useState(0);
  const [byType, setByType] = useState({ webrtc: 0, mobile: 0, sip: 0 });
  const [devices, setDevices] = useState<ExtensionDeviceRecord[]>([]);

  useEffect(() => {
    getMe()
      .then((user) => {
        if (!user.tenantId) {
          router.replace('/dashboard');
          return;
        }
        return getExtensionDevices();
      })
      .then((res) => {
        if (!res) return;
        setTotalDevices(res.totalDevices);
        setRegisteredDevices(res.registeredDevices);
        setByType(res.byType);
        setDevices(res.devices);
      })
      .catch((err) => {
        if (isUnauthorizedError(err)) router.replace('/login');
        else setError(err instanceof Error ? err.message : 'Could not load devices');
      })
      .finally(() => setLoading(false));
  }, [router]);

  const columns: DataTableColumn<ExtensionDeviceRecord>[] = [
    {
      key: 'extensionNumber',
      header: 'Extension',
      sortable: true,
      render: (row) => (
        <span className="font-medium">{row.extensionNumber} — {row.displayName}</span>
      ),
    },
    { key: 'deviceName', header: 'Device', sortable: true, render: (row) => row.deviceName || '—' },
    { key: 'deviceType', header: 'Type', sortable: true },
    { key: 'platform', header: 'Platform', sortable: true, render: (row) => row.platform || '—' },
    {
      key: 'lastRegistrationAt',
      header: 'Last registration',
      sortable: true,
      sortValue: (row) => row.lastRegistrationAt || '',
      render: (row) => (row.lastRegistrationAt ? new Date(row.lastRegistrationAt).toLocaleString() : '—'),
    },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      render: (row) => deviceStatusBadge(row.status),
    },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-slate-400">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        Loading devices…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-medium text-slate-900">Devices</h2>
        <p className="text-sm text-slate-400">WebRTC, mobile, and SIP endpoints across all extensions.</p>
      </div>

      <PhoneSystemNav />

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs uppercase text-slate-500">Total devices</p>
          <p className="mt-1 text-2xl font-semibold">{totalDevices}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs uppercase text-slate-500">Registered (online)</p>
          <p className="mt-1 text-2xl font-semibold text-emerald-600">{registeredDevices}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs uppercase text-slate-500">WebRTC</p>
          <p className="mt-1 text-2xl font-semibold">{byType.webrtc}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs uppercase text-slate-500">Mobile</p>
          <p className="mt-1 text-2xl font-semibold">{byType.mobile}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs uppercase text-slate-500">SIP</p>
          <p className="mt-1 text-2xl font-semibold">{byType.sip}</p>
        </div>
      </div>

      <DataTable
        title="All devices"
        data={devices}
        columns={columns}
        getRowId={(row) => row.id}
        emptyMessage="No devices registered yet. Assign extensions to users and connect softphone clients."
      />
    </div>
  );
}
