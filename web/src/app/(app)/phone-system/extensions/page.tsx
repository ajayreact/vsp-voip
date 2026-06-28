'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2, Plus, Pencil, Settings, Trash2 } from 'lucide-react';
import 'sweetalert2/dist/sweetalert2.min.css';
import Swal from 'sweetalert2';
import { PhoneSystemNav } from '@/components/phone-system-nav';
import { DataTable, type DataTableColumn } from '@/components/data-table';
import { ExtensionDetailDrawer, type ExtensionDrawerTab } from '@/components/extension-detail-drawer';
import { ExtensionFormPanel } from '@/components/extension-form-panel';
import { formatPhoneNumber } from '@/lib/phone';
import { SWAL_THEME } from '@/lib/swal-theme';
import {
  deleteExtension,
  getExtensionStats,
  getExtensions,
  getMe,
  isUnauthorizedError,
  syncExtensionPhoneLinks,
  validateOwnershipChain,
  type ExtensionDashboardStats,
  type ExtensionRecord,
  type DeviceRegistrationStatus,
} from '@/lib/api';

function statusBadge(status: ExtensionRecord['status']) {
  const styles = {
    ACTIVE: 'bg-emerald-50 text-emerald-700',
    INACTIVE: 'bg-slate-100 text-slate-600',
    SUSPENDED: 'bg-amber-50 text-amber-700',
  };
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${styles[status]}`}>
      {status.charAt(0) + status.slice(1).toLowerCase()}
    </span>
  );
}

function regBadge(reg?: DeviceRegistrationStatus) {
  const status = reg?.status || 'UNREGISTERED';
  const styles: Record<string, string> = {
    ONLINE: 'text-emerald-600',
    OFFLINE: 'text-slate-500',
    EXPIRED: 'text-amber-600',
    UNREGISTERED: 'text-slate-400',
  };
  const label = status === 'UNREGISTERED' ? '—' : status.charAt(0) + status.slice(1).toLowerCase();
  return <span className={`text-xs font-medium ${styles[status]}`}>{label}</span>;
}

function StatCard({ label, value, hint }: { label: string; value: number; hint?: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-slate-900">{value}</p>
      {hint ? <p className="mt-1 text-xs text-slate-400">{hint}</p> : null}
    </div>
  );
}

function parseDrawerTab(value: string | null): ExtensionDrawerTab {
  const tabs: ExtensionDrawerTab[] = ['overview', 'employee', 'sip', 'qr', 'security', 'analytics'];
  if (value && tabs.includes(value as ExtensionDrawerTab)) {
    return value as ExtensionDrawerTab;
  }
  if (value === 'ownership') return 'employee';
  return 'overview';
}

export default function ExtensionsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [extensions, setExtensions] = useState<ExtensionRecord[]>([]);
  const [stats, setStats] = useState<ExtensionDashboardStats | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerExtensionId, setDrawerExtensionId] = useState<string | null>(null);
  const [drawerTab, setDrawerTab] = useState<ExtensionDrawerTab>('overview');
  const [formModalOpen, setFormModalOpen] = useState(false);
  const [formModalMode, setFormModalMode] = useState<'create' | 'edit'>('create');
  const [formModalExtensionId, setFormModalExtensionId] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const [extRes, statsRes] = await Promise.all([getExtensions(), getExtensionStats()]);
    setExtensions(extRes.extensions);
    setStats(statsRes.stats);
  }, []);

  const closeDrawer = useCallback(() => {
    setDrawerOpen(false);
    setDrawerExtensionId(null);
    router.replace('/phone-system/extensions', { scroll: false });
  }, [router]);

  const openDrawer = useCallback(
    (extensionId: string, options?: { tab?: ExtensionDrawerTab }) => {
      const tab = options?.tab || 'overview';
      setDrawerExtensionId(extensionId);
      setDrawerTab(tab);
      setDrawerOpen(true);
      router.replace(`/phone-system/extensions?open=${extensionId}&tab=${tab}`, { scroll: false });
    },
    [router],
  );

  const openCreateModal = useCallback(() => {
    setFormModalMode('create');
    setFormModalExtensionId(null);
    setFormModalOpen(true);
  }, []);

  const openEditModal = useCallback((extensionId: string) => {
    setFormModalMode('edit');
    setFormModalExtensionId(extensionId);
    setFormModalOpen(true);
  }, []);

  const closeFormModal = useCallback(() => {
    setFormModalOpen(false);
    setFormModalExtensionId(null);
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
        else setError(err instanceof Error ? err.message : 'Could not load extensions');
      })
      .finally(() => setLoading(false));
  }, [router, reload]);

  useEffect(() => {
    if (loading) return;

    if (searchParams.get('create') === '1' && isAdmin) {
      openCreateModal();
      router.replace('/phone-system/extensions', { scroll: false });
      return;
    }

    const openId = searchParams.get('open');
    if (!openId) return;

    setDrawerExtensionId(openId);
    setDrawerTab(parseDrawerTab(searchParams.get('tab')));
    setDrawerOpen(true);
  }, [searchParams, loading, isAdmin, openCreateModal, router]);

  async function onFormSaved(extension: ExtensionRecord) {
    await reload();
    await Swal.fire({
      title:
        formModalMode === 'create'
          ? `Extension ${extension.extensionNumber} created`
          : `Extension ${extension.extensionNumber} updated`,
      icon: 'success',
      timer: 2000,
      showConfirmButton: false,
      ...SWAL_THEME,
    });
  }

  async function onSyncLinks() {
    try {
      const res = await syncExtensionPhoneLinks();
      await reload();
      await Swal.fire({
        title: 'Phone links synced',
        text: `Linked ${res.linked} number(s) across ${res.extensions} extension(s).`,
        icon: 'success',
        timer: 2000,
        showConfirmButton: false,
        ...SWAL_THEME,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sync failed');
    }
  }

  async function onValidateChain() {
    try {
      const res = await validateOwnershipChain();
      const { passing, total, failing } = res.report;
      await Swal.fire({
        title: failing ? 'Ownership gaps found' : 'Ownership chain OK',
        html: `<p>${passing}/${total} numbers resolve: Employee → Extension → Phone Number → Device</p>`,
        icon: failing ? 'warning' : 'success',
        ...SWAL_THEME,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Validation failed');
    }
  }

  async function onDelete(row: ExtensionRecord) {
    const result = await Swal.fire({
      title: `Delete extension ${row.extensionNumber}?`,
      text: 'This cannot be undone.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Delete',
      ...SWAL_THEME,
    });
    if (!result.isConfirmed) return;
    try {
      await deleteExtension(row.id);
      if (drawerExtensionId === row.id) closeDrawer();
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
    }
  }

  const columns: DataTableColumn<ExtensionRecord>[] = [
    {
      key: 'extensionNumber',
      header: 'Extension',
      sortable: true,
      sortValue: (row) => Number(row.extensionNumber),
      render: (row) => (
        <button
          type="button"
          onClick={() => openDrawer(row.id)}
          className="text-left font-medium text-indigo-600 hover:text-indigo-700"
        >
          {row.extensionNumber} — {row.displayName}
        </button>
      ),
    },
    {
      key: 'employeeName',
      header: 'Employee',
      sortable: true,
      render: (row) => (
        <div>
          <p className="font-medium text-slate-900">{row.employeeName || row.displayName}</p>
          {!row.userId ? <p className="text-xs text-amber-600">Unassigned</p> : null}
        </div>
      ),
    },
    {
      key: 'assignedDidNumber',
      header: 'Assigned Phone Number',
      sortable: true,
      render: (row) => (row.assignedDidNumber ? formatPhoneNumber(row.assignedDidNumber) : '—'),
    },
    {
      key: 'mobile',
      header: 'Mobile',
      searchable: false,
      sortable: false,
      headerClassName: 'hidden lg:table-cell',
      className: 'hidden lg:table-cell',
      render: (row) => regBadge(row.deviceRegistration?.mobile),
    },
    {
      key: 'webrtc',
      header: 'WebRTC',
      searchable: false,
      sortable: false,
      headerClassName: 'hidden lg:table-cell',
      className: 'hidden lg:table-cell',
      render: (row) => regBadge(row.deviceRegistration?.webrtc),
    },
    {
      key: 'sip',
      header: 'SIP',
      searchable: false,
      sortable: false,
      headerClassName: 'hidden md:table-cell',
      className: 'hidden md:table-cell',
      render: (row) => regBadge(row.deviceRegistration?.sip),
    },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      render: (row) => statusBadge(row.status),
    },
    {
      key: 'actions',
      header: 'Actions',
      searchable: false,
      sortable: false,
      render: (row) =>
        isAdmin ? (
          <div className="flex flex-wrap items-center gap-1">
            <button
              type="button"
              onClick={() => openEditModal(row.id)}
              className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100"
            >
              <Pencil className="h-3.5 w-3.5" />
              Edit
            </button>
            <button
              type="button"
              onClick={() => openDrawer(row.id)}
              className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-indigo-600 hover:bg-indigo-50"
            >
              <Settings className="h-3.5 w-3.5" />
              Configure
            </button>
            <button
              type="button"
              onClick={() => onDelete(row)}
              className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => openDrawer(row.id)}
            className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-indigo-600 hover:bg-indigo-50"
          >
            <Settings className="h-3.5 w-3.5" />
            Configure
          </button>
        ),
    },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-slate-400">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        Loading extensions…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-medium text-slate-900">Phone system</h2>
        <p className="text-sm text-slate-400">
          Company → Extension → Assigned Phone Number → Employee. Extensions and numbers are long-lived; employees can be assigned later.
        </p>
      </div>

      <PhoneSystemNav />

      {stats ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Total extensions" value={stats.totalExtensions} />
          <StatCard label="Online extensions" value={stats.onlineExtensions} hint="At least one device connected" />
          <StatCard label="Offline extensions" value={stats.offlineExtensions} />
          <StatCard label="Voicemail messages" value={stats.voicemailCount} />
        </div>
      ) : null}

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <DataTable
        title="Extensions"
        data={extensions}
        columns={columns}
        getRowId={(row) => row.id}
        emptyMessage={
          <div className="py-8 text-center">
            <p className="text-slate-500">No extensions yet.</p>
            {isAdmin ? (
              <button
                type="button"
                onClick={openCreateModal}
                className="mt-3 inline-flex items-center gap-2 text-sm font-medium text-indigo-600 hover:text-indigo-700"
              >
                <Plus className="h-4 w-4" />
                Add your first extension
              </button>
            ) : null}
          </div>
        }
        action={
          isAdmin ? (
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => onSyncLinks()}
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Sync DIDs
              </button>
              <button
                type="button"
                onClick={() => onValidateChain()}
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Validate routing
              </button>
              <button
                type="button"
                onClick={openCreateModal}
                className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700"
              >
                <Plus className="h-4 w-4" />
                Add extension
              </button>
            </div>
          ) : undefined
        }
      />

      <ExtensionFormPanel
        open={formModalOpen}
        mode={formModalMode}
        extensionId={formModalExtensionId}
        onClose={closeFormModal}
        onSaved={onFormSaved}
      />

      <ExtensionDetailDrawer
        extensionId={drawerExtensionId}
        open={drawerOpen}
        initialTab={drawerTab}
        isAdmin={isAdmin}
        onClose={closeDrawer}
        onUpdated={reload}
      />
    </div>
  );
}
