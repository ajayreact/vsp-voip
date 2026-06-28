'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Pencil, Plus, Trash2, UserMinus, UserPlus } from 'lucide-react';
import 'sweetalert2/dist/sweetalert2.min.css';
import Swal from 'sweetalert2';
import { DataTable, type DataTableColumn } from '@/components/data-table';
import { PortalPageHeader } from '@/components/portal/page-header';
import {
  addRingGroupMember,
  deleteRingGroup,
  getExtensions,
  getMe,
  getRingGroup,
  getRingGroups,
  isUnauthorizedError,
  removeRingGroupMember,
  type RingGroupRecord,
  type RingStrategy,
} from '@/lib/api';
import { SWAL_THEME } from '@/lib/swal-theme';

const STRATEGY_LABELS: Record<RingStrategy, string> = {
  SIMULTANEOUS: 'Simultaneous',
  SEQUENTIAL: 'Sequential',
  ROUND_ROBIN: 'Round robin',
  LONGEST_IDLE: 'Longest idle',
};

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

  async function onAddMember(group: RingGroupRecord) {
    let members = group.members || [];
    if (!members.length && group.memberCount > 0) {
      try {
        const detail = await getRingGroup(group.id);
        members = detail.ringGroup.members || [];
      } catch {
        /* use empty members */
      }
    }

    const extRes = await getExtensions();
    const memberIds = new Set(members.map((m) => m.extensionId));
    const options = extRes.extensions
      .filter((ext) => !memberIds.has(ext.id))
      .map(
        (ext) =>
          `<option value="${ext.id}">Ext ${ext.extensionNumber} — ${ext.displayName}</option>`,
      )
      .join('');

    const result = await Swal.fire({
      title: 'Add member',
      html: `<select id="member-ext" class="swal2-input" style="margin:0"><option value="">— Select extension —</option>${options}</select>`,
      showCancelButton: true,
      preConfirm: () => {
        const id = (document.getElementById('member-ext') as HTMLSelectElement)?.value;
        if (!id) {
          Swal.showValidationMessage('Select an extension');
          return false;
        }
        return id;
      },
      ...SWAL_THEME,
    });

    if (!result.isConfirmed || !result.value) return;
    try {
      await addRingGroupMember(group.id, result.value);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add member');
    }
  }

  async function onRemoveMember(group: RingGroupRecord) {
    let members = group.members || [];
    if (!members.length) {
      try {
        const detail = await getRingGroup(group.id);
        members = detail.ringGroup.members || [];
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not load members');
        return;
      }
    }

    if (!members.length) {
      setError('No members to remove');
      return;
    }

    const options = members
      .map(
        (m) =>
          `<option value="${m.id}">Ext ${m.extension?.extensionNumber || m.extensionId} — ${m.extension?.displayName || ''}</option>`,
      )
      .join('');

    const result = await Swal.fire({
      title: 'Remove member',
      html: `<select id="member-id" class="swal2-input" style="margin:0">${options}</select>`,
      showCancelButton: true,
      confirmButtonText: 'Remove',
      preConfirm: () => {
        const id = (document.getElementById('member-id') as HTMLSelectElement)?.value;
        if (!id) {
          Swal.showValidationMessage('Select a member');
          return false;
        }
        return id;
      },
      ...SWAL_THEME,
    });

    if (!result.isConfirmed || !result.value) return;
    try {
      await removeRingGroupMember(group.id, result.value);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not remove member');
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
      key: 'memberCount',
      header: 'Members',
      sortable: true,
      sortValue: (row) => row.memberCount,
    },
    {
      key: 'ringStrategy',
      header: 'Ring strategy',
      sortable: true,
      render: (row) => STRATEGY_LABELS[row.ringStrategy] || row.ringStrategy,
    },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      sortValue: (row) => (row.isActive ? 1 : 0),
      render: (row) => (
        <span
          className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
            row.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'
          }`}
        >
          {row.isActive ? 'Active' : 'Inactive'}
        </span>
      ),
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
              className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-indigo-600 hover:bg-indigo-50"
            >
              <Pencil className="h-3.5 w-3.5" />
              Edit
            </Link>
            <button
              type="button"
              onClick={() => onAddMember(row)}
              className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100"
            >
              <UserPlus className="h-3.5 w-3.5" />
              Add
            </button>
            <button
              type="button"
              onClick={() => onRemoveMember(row)}
              className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100"
            >
              <UserMinus className="h-3.5 w-3.5" />
              Remove
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

  return (
    <div className="space-y-6">
      <PortalPageHeader
        title="Ring groups"
        description="Route inbound calls to multiple extensions with simultaneous, sequential, or round-robin ringing."
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
