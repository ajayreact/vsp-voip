'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import 'sweetalert2/dist/sweetalert2.min.css';
import Swal from 'sweetalert2';
import { DataTable, type DataTableColumn } from '@/components/data-table';
import { PortalPageHeader } from '@/components/portal/page-header';
import {
  deleteRingGroup,
  getMe,
  getRingGroups,
  isUnauthorizedError,
  type RingGroupRecord,
} from '@/lib/api';
import { STRATEGY_LABELS } from '@/lib/ring-group-utils';
import { SWAL_THEME } from '@/lib/swal-theme';

function activeBadge(isActive: boolean) {
  return (
    <span
      className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
        isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'
      }`}
    >
      {isActive ? 'Active' : 'Inactive'}
    </span>
  );
}

export function RingGroupsManagerPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [ringGroups, setRingGroups] = useState<RingGroupRecord[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);

  async function reload() {
    const res = await getRingGroups();
    setRingGroups(res.ringGroups);
  }

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
        else setError(err instanceof Error ? err.message : 'Could not load ring groups');
      })
      .finally(() => setLoading(false));
  }, [router]);

  async function onDelete(row: RingGroupRecord) {
    const confirm = await Swal.fire({
      title: `Delete "${row.name}"?`,
      text: 'The ring group will be deactivated.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Delete',
      ...SWAL_THEME,
    });
    if (!confirm.isConfirmed) return;
    try {
      await deleteRingGroup(row.id);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
    }
  }

  const columns: DataTableColumn<RingGroupRecord>[] = [
    {
      key: 'name',
      header: 'Group name',
      sortable: true,
      render: (row) => (
        <Link href={`/ring-groups/${row.id}`} className="font-medium text-indigo-600 hover:text-indigo-700">
          {row.name}
        </Link>
      ),
    },
    {
      key: 'extensionNumber',
      header: 'Extension',
      sortable: true,
      render: (row) => row.extensionNumber || '—',
    },
    {
      key: 'ringStrategy',
      header: 'Ring strategy',
      sortable: true,
      render: (row) => STRATEGY_LABELS[row.ringStrategy] || row.ringStrategy,
    },
    {
      key: 'memberCount',
      header: 'Members',
      sortable: true,
      sortValue: (row) => row.memberCount,
    },
    {
      key: 'isActive',
      header: 'Active status',
      sortable: true,
      sortValue: (row) => (row.isActive ? 1 : 0),
      render: (row) => activeBadge(row.isActive),
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
              href={`/ring-groups/${row.id}`}
              className="rounded-lg px-2 py-1 text-xs font-medium text-indigo-600 hover:bg-indigo-50"
            >
              Edit
            </Link>
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
          <Link href={`/ring-groups/${row.id}`} className="text-xs text-indigo-600">
            View
          </Link>
        ),
    },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-slate-400">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        Loading ring groups…
      </div>
    );
  }

  const activeCount = ringGroups.filter((g) => g.isActive).length;

  return (
    <div className="space-y-6">
      <PortalPageHeader
        title="Ring groups"
        description="Enterprise hunt groups — route inbound calls to multiple extensions. Administration only."
        actions={
          isAdmin ? (
            <Link
              href="/ring-groups/new"
              className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
            >
              <Plus className="h-4 w-4" />
              Create ring group
            </Link>
          ) : undefined
        }
      />

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="panel-card p-4">
          <p className="text-xs uppercase text-slate-500">Total groups</p>
          <p className="mt-1 text-2xl font-semibold">{ringGroups.length}</p>
        </div>
        <div className="panel-card p-4">
          <p className="text-xs uppercase text-slate-500">Active</p>
          <p className="mt-1 text-2xl font-semibold text-emerald-600">{activeCount}</p>
        </div>
        <div className="panel-card p-4">
          <p className="text-xs uppercase text-slate-500">Total members</p>
          <p className="mt-1 text-2xl font-semibold">
            {ringGroups.reduce((sum, g) => sum + g.memberCount, 0)}
          </p>
        </div>
      </div>

      <DataTable
        title="All ring groups"
        data={ringGroups}
        columns={columns}
        getRowId={(row) => row.id}
        emptyMessage={
          isAdmin ? (
            <div className="py-6 text-center">
              <p className="text-slate-500">No ring groups yet.</p>
              <Link href="/ring-groups/new" className="mt-2 inline-flex items-center gap-1 text-sm text-indigo-600">
                <Plus className="h-4 w-4" />
                Create ring group
              </Link>
            </div>
          ) : (
            'No ring groups configured.'
          )
        }
      />
    </div>
  );
}
