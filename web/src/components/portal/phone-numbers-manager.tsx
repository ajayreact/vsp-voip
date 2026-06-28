'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  History,
  Loader2,
  Phone,
  Plus,
  Route,
  Settings,
  Unlink,
  UserPlus,
} from 'lucide-react';
import 'sweetalert2/dist/sweetalert2.min.css';
import Swal from 'sweetalert2';
import { DataTable, type DataTableColumn } from '@/components/data-table';
import { PortalPageHeader } from '@/components/portal/page-header';
import {
  getExtensions,
  getMe,
  getMyNumbers,
  isUnauthorizedError,
  setExtensionPrimaryPhoneNumber,
  type ExtensionRecord,
  type OwnedNumber,
} from '@/lib/api';
import { formatPhoneNumber } from '@/lib/phone';
import { SWAL_THEME } from '@/lib/swal-theme';

type EnrichedNumber = OwnedNumber & {
  tenantName: string;
  employeeName: string;
  callerIdName: string;
  registrationStatus: string;
  routingStatus: string;
  numberStatus: 'Active' | 'Unassigned' | 'Suspended';
};

function routingLabel(number: OwnedNumber) {
  return number.effectiveRoutingLabel || number.routingTypeLabel || 'Tenant default';
}

function registrationLabel(ext: ExtensionRecord | undefined) {
  if (!ext) return '—';
  if (ext.registration?.isLive) return 'Registered';
  if (ext.lastSeen || ext.registration?.lastRegistrationAt) return 'Offline';
  return 'Unregistered';
}

function numberStatus(number: OwnedNumber): EnrichedNumber['numberStatus'] {
  if (number.isActive === false) return 'Suspended';
  if (!number.extensionId) return 'Unassigned';
  return 'Active';
}

function statusBadge(status: EnrichedNumber['numberStatus']) {
  const styles = {
    Active: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
    Unassigned: 'bg-slate-100 text-slate-600 ring-slate-200',
    Suspended: 'bg-amber-50 text-amber-700 ring-amber-200',
  };
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ${styles[status]}`}>
      {status}
    </span>
  );
}

export function PhoneNumbersManagerPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [numbers, setNumbers] = useState<OwnedNumber[]>([]);
  const [extensions, setExtensions] = useState<ExtensionRecord[]>([]);
  const [tenantName, setTenantName] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);

  const extensionById = useMemo(
    () => new Map(extensions.map((ext) => [ext.id, ext])),
    [extensions],
  );

  const enriched: EnrichedNumber[] = useMemo(
    () =>
      numbers.map((n) => {
        const ext = n.extensionId ? extensionById.get(n.extensionId) : undefined;
        return {
          ...n,
          tenantName,
          employeeName:
            n.assignedUserName
            || ext?.employeeName
            || ext?.user?.name
            || '—',
          callerIdName: n.label || ext?.displayName || '—',
          registrationStatus: registrationLabel(ext),
          routingStatus: routingLabel(n),
          numberStatus: numberStatus(n),
        };
      }),
    [numbers, extensionById, tenantName],
  );

  const reload = useCallback(async () => {
    const [numbersRes, extRes] = await Promise.all([
      getMyNumbers(),
      getExtensions(),
    ]);
    setNumbers(numbersRes.numbers || []);
    setExtensions(extRes.extensions || []);
  }, []);

  useEffect(() => {
    getMe()
      .then((user) => {
        if (!user.tenantId) {
          router.replace('/dashboard');
          return;
        }
        setTenantName(user.tenantName || '—');
        setIsAdmin(user.role === 'TENANT_ADMIN' || user.role === 'SUPER_ADMIN');
        return reload();
      })
      .catch((err) => {
        if (isUnauthorizedError(err)) router.replace('/login');
        else setError(err instanceof Error ? err.message : 'Could not load phone numbers');
      })
      .finally(() => setLoading(false));
  }, [router, reload]);

  async function assignExtension(number: EnrichedNumber, mode: 'assign' | 'change') {
    if (!isAdmin) return;

    const options = extensions
      .filter((ext) => ext.status === 'ACTIVE')
      .map(
        (ext) =>
          `<option value="${ext.id}" ${ext.id === number.extensionId ? 'selected' : ''}>Ext ${ext.extensionNumber} — ${ext.displayName}</option>`,
      )
      .join('');

    const result = await Swal.fire({
      title: mode === 'assign' ? 'Assign extension' : 'Change extension',
      html: `
        <p style="margin-bottom:8px;font-size:14px;color:#475569">${formatPhoneNumber(number.number)}</p>
        <select id="ext-id" class="swal2-input" style="margin:0">
          <option value="">— Select extension —</option>
          ${options}
        </select>
      `,
      showCancelButton: true,
      confirmButtonText: 'Save',
      preConfirm: () => {
        const extId = (document.getElementById('ext-id') as HTMLSelectElement)?.value;
        if (!extId) {
          Swal.showValidationMessage('Select an extension');
          return false;
        }
        return extId;
      },
      ...SWAL_THEME,
    });

    if (!result.isConfirmed || !result.value) return;

    try {
      await setExtensionPrimaryPhoneNumber(result.value, number.id);
      await reload();
      await Swal.fire({ title: 'Extension assigned', icon: 'success', timer: 1500, showConfirmButton: false, ...SWAL_THEME });
    } catch (err) {
      await Swal.fire({
        title: 'Assignment failed',
        text: err instanceof Error ? err.message : 'Unknown error',
        icon: 'error',
        ...SWAL_THEME,
      });
    }
  }

  async function unassignNumber(number: EnrichedNumber) {
    if (!isAdmin || !number.extensionId) return;

    const confirm = await Swal.fire({
      title: 'Unassign DID?',
      text: `Remove ${formatPhoneNumber(number.number)} from extension ${number.extensionNumber || ''}?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Unassign',
      ...SWAL_THEME,
    });
    if (!confirm.isConfirmed) return;

    try {
      await setExtensionPrimaryPhoneNumber(number.extensionId, null);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unassign failed');
    }
  }

  const columns: DataTableColumn<EnrichedNumber>[] = [
    {
      key: 'number',
      header: 'Phone number',
      sortable: true,
      render: (row) => (
        <span className="inline-flex items-center gap-2 font-medium text-slate-900">
          <Phone className="h-4 w-4 text-indigo-400" />
          {formatPhoneNumber(row.numberFormatted || row.number)}
        </span>
      ),
    },
    {
      key: 'tenantName',
      header: 'Tenant',
      sortable: true,
      headerClassName: 'hidden lg:table-cell',
      className: 'hidden lg:table-cell',
    },
    {
      key: 'extensionNumber',
      header: 'Extension',
      sortable: true,
      render: (row) =>
        row.extensionId ? (
          <Link href={`/extensions?open=${row.extensionId}`} className="text-indigo-600 hover:text-indigo-700">
            {row.extensionNumber || '—'}
          </Link>
        ) : (
          '—'
        ),
    },
    {
      key: 'employeeName',
      header: 'Employee',
      sortable: true,
      render: (row) => row.employeeName,
    },
    {
      key: 'callerIdName',
      header: 'Caller ID name',
      sortable: true,
      headerClassName: 'hidden md:table-cell',
      className: 'hidden md:table-cell',
    },
    {
      key: 'registrationStatus',
      header: 'Registration',
      sortable: true,
      headerClassName: 'hidden xl:table-cell',
      className: 'hidden xl:table-cell',
    },
    {
      key: 'routingStatus',
      header: 'Routing',
      sortable: true,
      render: (row) => (
        <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs text-indigo-700">
          {row.routingStatus}
        </span>
      ),
    },
    {
      key: 'numberStatus',
      header: 'Status',
      sortable: true,
      render: (row) => statusBadge(row.numberStatus),
    },
    {
      key: 'actions',
      header: 'Actions',
      searchable: false,
      sortable: false,
      render: (row) =>
        isAdmin ? (
          <div className="flex flex-wrap gap-1">
            {!row.extensionId ? (
              <button
                type="button"
                onClick={() => assignExtension(row, 'assign')}
                className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-indigo-600 hover:bg-indigo-50"
              >
                <UserPlus className="h-3.5 w-3.5" />
                Assign
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => assignExtension(row, 'change')}
                  className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100"
                >
                  Change ext
                </button>
                <button
                  type="button"
                  onClick={() => unassignNumber(row)}
                  className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100"
                >
                  <Unlink className="h-3.5 w-3.5" />
                  Unassign
                </button>
                <Link
                  href={`/extensions?open=${row.extensionId}&tab=sip`}
                  className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-indigo-600 hover:bg-indigo-50"
                >
                  <Settings className="h-3.5 w-3.5" />
                  Config
                </Link>
              </>
            )}
            <Link
              href="/greeting"
              className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100"
            >
              <Route className="h-3.5 w-3.5" />
              Routing
            </Link>
            <Link
              href="/calls"
              className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100"
            >
              <History className="h-3.5 w-3.5" />
              History
            </Link>
          </div>
        ) : (
          <Link href="/calls" className="text-xs text-indigo-600 hover:text-indigo-700">
            Call history
          </Link>
        ),
    },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-slate-400">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        Loading phone numbers…
      </div>
    );
  }

  const activeCount = enriched.filter((n) => n.numberStatus === 'Active').length;
  const unassignedCount = enriched.filter((n) => n.numberStatus === 'Unassigned').length;

  return (
    <div className="space-y-6">
      <PortalPageHeader
        title="Phone numbers"
        description="Manage DIDs, extension assignment, and inbound routing. Assignment uses the extension primary DID API."
        actions={
          isAdmin ? (
            <Link
              href="/numbers"
              className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
            >
              <Plus className="h-4 w-4" />
              Buy numbers
            </Link>
          ) : undefined
        }
      />

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="panel-card p-4">
          <p className="text-xs uppercase text-slate-500">Total DIDs</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">{enriched.length}</p>
        </div>
        <div className="panel-card p-4">
          <p className="text-xs uppercase text-slate-500">Assigned</p>
          <p className="mt-1 text-2xl font-semibold text-emerald-600">{activeCount}</p>
        </div>
        <div className="panel-card p-4">
          <p className="text-xs uppercase text-slate-500">Unassigned</p>
          <p className="mt-1 text-2xl font-semibold text-slate-600">{unassignedCount}</p>
        </div>
      </div>

      <DataTable
        title="DID directory"
        data={enriched}
        columns={columns}
        getRowId={(row) => row.id}
        emptyMessage={
          <>
            <p>No phone numbers yet.</p>
            {isAdmin ? (
              <Link href="/numbers" className="mt-2 inline-block text-sm text-indigo-600 hover:text-indigo-700">
                Search and buy numbers →
              </Link>
            ) : null}
          </>
        }
      />
    </div>
  );
}
