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
  getExtensionSipCredentials,
  getExtensions,
  getMe,
  isUnauthorizedError,
  resetExtensionSipCredentials,
  type DeviceRegistrationStatus,
  type ExtensionRecord,
} from '@/lib/api';
import { SWAL_THEME } from '@/lib/swal-theme';

type DeviceRow = {
  extensionId: string;
  employeeName: string;
  extensionNumber: string;
  deviceTypeLabel: string;
  mobileStatus: DeviceRegistrationStatus;
  deskStatus: DeviceRegistrationStatus;
  registrationLabel: string;
  lastRegistrationAt: string | null;
  sipUsername: string;
};

function regStatusLabel(reg?: DeviceRegistrationStatus) {
  const status = reg?.status || 'UNREGISTERED';
  if (status === 'ONLINE') return 'Registered';
  if (status === 'OFFLINE') return 'Offline';
  if (status === 'EXPIRED') return 'Expired';
  return 'Unregistered';
}

function regStatusBadge(reg?: DeviceRegistrationStatus) {
  const status = reg?.status || 'UNREGISTERED';
  const styles: Record<string, string> = {
    ONLINE: 'bg-emerald-50 text-emerald-700',
    OFFLINE: 'bg-slate-100 text-slate-600',
    EXPIRED: 'bg-amber-50 text-amber-700',
    UNREGISTERED: 'bg-slate-50 text-slate-400',
  };
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${styles[status]}`}>
      {regStatusLabel(reg)}
    </span>
  );
}

function overallRegistration(ext: ExtensionRecord) {
  if (ext.registration?.isLive) return 'Registered';
  if (ext.lastSeen || ext.registration?.lastRegistrationAt) return 'Offline';
  return 'Unregistered';
}

function deviceTypeLabel(ext: ExtensionRecord) {
  const mobile = ext.deviceRegistration?.mobile?.status !== 'UNREGISTERED';
  const desk = ext.deviceRegistration?.sip?.status !== 'UNREGISTERED';
  if (mobile && desk) return 'Mobile + Desk';
  if (mobile) return 'Mobile';
  if (desk) return 'Desk phone';
  const hasMobileDevice = ext.devices?.some((d) => d.deviceType === 'MOBILE');
  const hasDeskDevice = ext.devices?.some((d) => d.deviceType === 'SIP');
  if (hasMobileDevice && hasDeskDevice) return 'Mobile + Desk';
  if (hasMobileDevice) return 'Mobile';
  if (hasDeskDevice) return 'Desk phone';
  return '—';
}

function latestRegistration(ext: ExtensionRecord) {
  const timestamps = [
    ext.registration?.lastRegistrationAt,
    ext.deviceRegistration?.mobile?.lastSeen,
    ext.deviceRegistration?.sip?.lastSeen,
    ...(ext.devices || [])
      .filter((d) => d.deviceType !== 'WEBRTC')
      .map((d) => d.lastRegistrationAt),
  ].filter(Boolean) as string[];

  if (!timestamps.length) return null;
  return timestamps.sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0];
}

function buildDeviceRows(
  extensions: ExtensionRecord[],
  sipMap: Map<string, string>,
): DeviceRow[] {
  return extensions
    .filter((ext) => {
      const nonWebrtc = (ext.devices || []).filter((d) => d.deviceType !== 'WEBRTC');
      const hasReg =
        ext.registeredDeviceCount > 0
        || ext.deviceRegistration?.mobile?.status !== 'UNREGISTERED'
        || ext.deviceRegistration?.sip?.status !== 'UNREGISTERED'
        || nonWebrtc.length > 0;
      return hasReg;
    })
    .map((ext) => ({
      extensionId: ext.id,
      employeeName: ext.employeeName || ext.displayName || '—',
      extensionNumber: ext.extensionNumber,
      deviceTypeLabel: deviceTypeLabel(ext),
      mobileStatus: ext.deviceRegistration?.mobile || { status: 'UNREGISTERED', lastSeen: null, deviceName: null },
      deskStatus: ext.deviceRegistration?.sip || { status: 'UNREGISTERED', lastSeen: null, deviceName: null },
      registrationLabel: overallRegistration(ext),
      lastRegistrationAt: latestRegistration(ext),
      sipUsername: sipMap.get(ext.id) || '—',
    }));
}

export function DevicesManagerPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [rows, setRows] = useState<DeviceRow[]>([]);
  const [summary, setSummary] = useState({ total: 0, registered: 0, mobile: 0, desk: 0 });

  const reload = useCallback(async () => {
    const extRes = await getExtensions();
    const extensions = extRes.extensions || [];
    const sipMap = new Map<string, string>();

    const ids = extensions.map((ext) => ext.id);
    await Promise.all(
      ids.slice(0, 50).map(async (extId) => {
        try {
          const res = await getExtensionSipCredentials(extId);
          if (res.sip?.sipUsername) sipMap.set(extId, res.sip.sipUsername);
        } catch {
          /* admin-only or unassigned */
        }
      }),
    );

    const deviceRows = buildDeviceRows(extensions, sipMap);
    setRows(deviceRows);

    const mobileOnline = deviceRows.filter((r) => r.mobileStatus.status === 'ONLINE').length;
    const deskOnline = deviceRows.filter((r) => r.deskStatus.status === 'ONLINE').length;
    setSummary({
      total: deviceRows.length,
      registered: deviceRows.filter((r) => r.registrationLabel === 'Registered').length,
      mobile: mobileOnline,
      desk: deskOnline,
    });
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

  async function onResetSip(extensionId: string) {
    if (!isAdmin) return;
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

  async function onRevoke(extensionId: string) {
    if (!isAdmin) return;
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

  const columns: DataTableColumn<DeviceRow>[] = useMemo(
    () => [
      {
        key: 'employeeName',
        header: 'Employee',
        sortable: true,
      },
      {
        key: 'extensionNumber',
        header: 'Extension',
        sortable: true,
        sortValue: (row) => Number(row.extensionNumber),
        render: (row) => (
          <Link href={`/extensions?open=${row.extensionId}`} className="text-indigo-600 hover:text-indigo-700">
            {row.extensionNumber}
          </Link>
        ),
      },
      {
        key: 'deviceTypeLabel',
        header: 'Device type',
        sortable: true,
      },
      {
        key: 'mobileStatus',
        header: 'Mobile status',
        sortable: true,
        sortValue: (row) => row.mobileStatus.status,
        render: (row) => regStatusBadge(row.mobileStatus),
      },
      {
        key: 'deskStatus',
        header: 'Desk phone status',
        sortable: true,
        sortValue: (row) => row.deskStatus.status,
        render: (row) => regStatusBadge(row.deskStatus),
        headerClassName: 'hidden lg:table-cell',
        className: 'hidden lg:table-cell',
      },
      {
        key: 'registrationLabel',
        header: 'Registration',
        sortable: true,
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
          isAdmin ? (
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
    ],
    [isAdmin],
  );

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
        description="Mobile and desk phone registrations per extension. Provision via Config and QR — administration only, no browser calling."
      />

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="panel-card p-4">
          <p className="text-xs uppercase text-slate-500">Extensions with devices</p>
          <p className="mt-1 text-2xl font-semibold">{summary.total}</p>
        </div>
        <div className="panel-card p-4">
          <p className="text-xs uppercase text-slate-500">Registered</p>
          <p className="mt-1 text-2xl font-semibold text-emerald-600">{summary.registered}</p>
        </div>
        <div className="panel-card p-4">
          <p className="text-xs uppercase text-slate-500">Mobile online</p>
          <p className="mt-1 text-2xl font-semibold">{summary.mobile}</p>
        </div>
        <div className="panel-card p-4">
          <p className="text-xs uppercase text-slate-500">Desk online</p>
          <p className="mt-1 text-2xl font-semibold">{summary.desk}</p>
        </div>
      </div>

      <DataTable
        title="Registered devices"
        data={rows}
        columns={columns}
        getRowId={(row) => row.extensionId}
        emptyMessage="No mobile or desk devices registered. Assign an employee and scan the provisioning QR from Extensions."
      />
    </div>
  );
}
