'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, QrCode, RotateCcw, Settings, ShieldOff } from 'lucide-react';
import 'sweetalert2/dist/sweetalert2.min.css';
import Swal from 'sweetalert2';
import { DataTable, type DataTableColumn } from '@/components/data-table';
import { PortalPageHeader } from '@/components/portal/page-header';
import {
  forceLogoutExtensionDevices,
  getExtensionDevices,
  getExtensionSipCredentials,
  getExtensions,
  getMe,
  isUnauthorizedError,
  resetExtensionSipCredentials,
  type ExtensionDeviceRecord,
} from '@/lib/api';
import { SWAL_THEME } from '@/lib/swal-theme';

type DeviceRow = ExtensionDeviceRecord & {
  employeeName: string;
  sipUsername: string;
};

function deviceTypeLabel(type: ExtensionDeviceRecord['deviceType']) {
  if (type === 'MOBILE') return 'Mobile';
  if (type === 'SIP') return 'Desk phone';
  if (type === 'WEBRTC') return 'WebRTC';
  return type;
}

function statusBadge(status: string) {
  const styles: Record<string, string> = {
    ONLINE: 'bg-emerald-50 text-emerald-700',
    OFFLINE: 'bg-slate-100 text-slate-600',
    EXPIRED: 'bg-amber-50 text-amber-700',
  };
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${styles[status] || styles.OFFLINE}`}>
      {status === 'ONLINE' ? 'Registered' : status.charAt(0) + status.slice(1).toLowerCase()}
    </span>
  );
}

export function DevicesManagerPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [totalDevices, setTotalDevices] = useState(0);
  const [registeredDevices, setRegisteredDevices] = useState(0);
  const [byType, setByType] = useState({ webrtc: 0, mobile: 0, sip: 0 });
  const [devices, setDevices] = useState<DeviceRow[]>([]);

  const reload = useCallback(async () => {
    const [devicesRes, extRes] = await Promise.all([
      getExtensionDevices(),
      getExtensions(),
    ]);

    const extMap = new Map(extRes.extensions.map((ext) => [ext.id, ext]));
    const sipMap = new Map<string, string>();

    const uniqueExtIds = [...new Set(devicesRes.devices.map((d) => d.extensionId).filter(Boolean))] as string[];
    await Promise.all(
      uniqueExtIds.slice(0, 40).map(async (extId) => {
        try {
          const res = await getExtensionSipCredentials(extId);
          if (res.sip?.sipUsername) sipMap.set(extId, res.sip.sipUsername);
        } catch {
          /* admin-only or unassigned */
        }
      }),
    );

    const rows: DeviceRow[] = devicesRes.devices.map((device) => {
      const ext = device.extensionId ? extMap.get(device.extensionId) : undefined;
      return {
        ...device,
        employeeName: ext?.employeeName || ext?.displayName || '—',
        sipUsername: device.extensionId ? (sipMap.get(device.extensionId) || '—') : '—',
      };
    });

    setTotalDevices(devicesRes.totalDevices);
    setRegisteredDevices(devicesRes.registeredDevices);
    setByType(devicesRes.byType);
    setDevices(rows);
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
        else setError(err instanceof Error ? err.message : 'Could not load devices');
      })
      .finally(() => setLoading(false));
  }, [router, reload]);

  async function onResetSip(extensionId: string | undefined) {
    if (!extensionId || !isAdmin) return;
    const confirm = await Swal.fire({
      title: 'Reset SIP password?',
      text: 'The employee must scan a new QR code or re-enter credentials on their device.',
      icon: 'warning',
      showCancelButton: true,
      ...SWAL_THEME,
    });
    if (!confirm.isConfirmed) return;
    try {
      await resetExtensionSipCredentials(extensionId);
      await reload();
      await Swal.fire({ title: 'SIP password reset', icon: 'success', timer: 1500, showConfirmButton: false, ...SWAL_THEME });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Reset failed');
    }
  }

  async function onRevoke(extensionId: string | undefined) {
    if (!extensionId || !isAdmin) return;
    const confirm = await Swal.fire({
      title: 'Revoke devices?',
      text: 'Force logout all registered endpoints for this extension.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Revoke',
      ...SWAL_THEME,
    });
    if (!confirm.isConfirmed) return;
    try {
      await forceLogoutExtensionDevices(extensionId);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Revoke failed');
    }
  }

  const filteredDevices = useMemo(
    () => devices.filter((d) => d.deviceType !== 'WEBRTC'),
    [devices],
  );

  const columns: DataTableColumn<DeviceRow>[] = [
    {
      key: 'employeeName',
      header: 'Employee',
      sortable: true,
    },
    {
      key: 'extensionNumber',
      header: 'Extension',
      sortable: true,
      render: (row) =>
        row.extensionId ? (
          <Link href={`/extensions?open=${row.extensionId}`} className="text-indigo-600 hover:text-indigo-700">
            {row.extensionNumber}
          </Link>
        ) : (
          row.extensionNumber || '—'
        ),
    },
    {
      key: 'deviceType',
      header: 'Device type',
      sortable: true,
      render: (row) => deviceTypeLabel(row.deviceType),
    },
    {
      key: 'status',
      header: 'Registration',
      sortable: true,
      render: (row) => statusBadge(row.status),
    },
    {
      key: 'lastRegistrationAt',
      header: 'Last registration',
      sortable: true,
      sortValue: (row) => row.lastRegistrationAt || '',
      render: (row) => (row.lastRegistrationAt ? new Date(row.lastRegistrationAt).toLocaleString() : '—'),
    },
    {
      key: 'sipUsername',
      header: 'SIP username',
      sortable: true,
      headerClassName: 'hidden md:table-cell',
      className: 'hidden md:table-cell font-mono text-xs',
    },
    {
      key: 'actions',
      header: 'Actions',
      searchable: false,
      sortable: false,
      render: (row) =>
        isAdmin && row.extensionId ? (
          <div className="flex flex-wrap gap-1">
            <Link
              href={`/extensions?open=${row.extensionId}&tab=sip`}
              className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-indigo-600 hover:bg-indigo-50"
            >
              <Settings className="h-3.5 w-3.5" />
              Config
            </Link>
            <Link
              href={`/extensions?open=${row.extensionId}&tab=qr`}
              className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-indigo-600 hover:bg-indigo-50"
            >
              <QrCode className="h-3.5 w-3.5" />
              QR
            </Link>
            <button
              type="button"
              onClick={() => onResetSip(row.extensionId)}
              className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Reset SIP
            </button>
            <button
              type="button"
              onClick={() => onRevoke(row.extensionId)}
              className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
            >
              <ShieldOff className="h-3.5 w-3.5" />
              Revoke
            </button>
          </div>
        ) : null,
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
      <PortalPageHeader
        title="Devices"
        description="Mobile and desk phone registrations. Provision via extension Config and QR — no browser calling."
      />

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="panel-card p-4">
          <p className="text-xs uppercase text-slate-500">Total devices</p>
          <p className="mt-1 text-2xl font-semibold">{totalDevices}</p>
        </div>
        <div className="panel-card p-4">
          <p className="text-xs uppercase text-slate-500">Registered</p>
          <p className="mt-1 text-2xl font-semibold text-emerald-600">{registeredDevices}</p>
        </div>
        <div className="panel-card p-4">
          <p className="text-xs uppercase text-slate-500">Mobile</p>
          <p className="mt-1 text-2xl font-semibold">{byType.mobile}</p>
        </div>
        <div className="panel-card p-4">
          <p className="text-xs uppercase text-slate-500">Desk (SIP)</p>
          <p className="mt-1 text-2xl font-semibold">{byType.sip}</p>
        </div>
      </div>

      <DataTable
        title="Registered devices"
        data={filteredDevices}
        columns={columns}
        getRowId={(row) => row.id}
        emptyMessage="No mobile or desk devices registered. Assign an employee and scan the provisioning QR from Extensions."
      />
    </div>
  );
}
