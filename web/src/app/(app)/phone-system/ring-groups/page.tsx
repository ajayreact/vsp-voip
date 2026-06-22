'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Plus, Eye, Trash2 } from 'lucide-react';
import { PhoneSystemNav } from '@/components/phone-system-nav';
import { DataTable, type DataTableColumn } from '@/components/data-table';
import {
  deleteRingGroup,
  getMe,
  getRingGroups,
  isUnauthorizedError,
  type RingGroupRecord,
  type RingStrategy,
} from '@/lib/api';

const STRATEGY_LABELS: Record<RingStrategy, string> = {
  SIMULTANEOUS: 'Simultaneous',
  SEQUENTIAL: 'Sequential',
  ROUND_ROBIN: 'Round robin',
  LONGEST_IDLE: 'Longest idle',
};

function StatCard({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-slate-900">{value}</p>
    </div>
  );
}

export default function RingGroupsPage() {
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
    if (!confirm(`Deactivate ring group "${row.name}"?`)) return;
    try {
      await deleteRingGroup(row.id);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
    }
  }

  const totals = ringGroups.reduce(
    (acc, g) => ({
      offered: acc.offered + g.analytics.callsOffered,
      answered: acc.answered + g.analytics.callsAnswered,
      missed: acc.missed + g.analytics.callsMissed,
    }),
    { offered: 0, answered: 0, missed: 0 },
  );

  const columns: DataTableColumn<RingGroupRecord>[] = [
    {
      key: 'name',
      header: 'Name',
      sortable: true,
      render: (row) => (
        <div>
          <p className="font-medium text-slate-900">{row.name}</p>
          {row.extensionNumber ? (
            <p className="text-xs text-slate-400">Ext {row.extensionNumber}</p>
          ) : null}
        </div>
      ),
    },
    {
      key: 'ringStrategy',
      header: 'Strategy',
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
      key: 'analytics',
      header: 'Answer rate',
      sortable: true,
      sortValue: (row) =>
        row.analytics.callsOffered > 0
          ? row.analytics.callsAnswered / row.analytics.callsOffered
          : 0,
      render: (row) => {
        const rate =
          row.analytics.callsOffered > 0
            ? Math.round((row.analytics.callsAnswered / row.analytics.callsOffered) * 100)
            : 0;
        return `${rate}%`;
      },
    },
    {
      key: 'status',
      header: 'Status',
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
      render: (row) => (
        <div className="flex flex-wrap items-center gap-1">
          <Link
            href={`/phone-system/ring-groups/${row.id}`}
            className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-indigo-600 hover:bg-indigo-50"
          >
            <Eye className="h-3.5 w-3.5" />
            View
          </Link>
          {isAdmin ? (
            <button
              type="button"
              onClick={() => onDelete(row)}
              className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Deactivate
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
        Loading ring groups…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-medium text-slate-900">Ring groups</h2>
        <p className="text-sm text-slate-400">
          Route incoming calls to multiple extensions with simultaneous, sequential, round robin, or longest idle ringing.
        </p>
      </div>

      <PhoneSystemNav />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Ring groups" value={ringGroups.length} />
        <StatCard label="Calls offered" value={totals.offered} />
        <StatCard label="Calls answered" value={totals.answered} />
        <StatCard label="Calls missed" value={totals.missed} />
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <DataTable
        title="Ring groups"
        data={ringGroups}
        columns={columns}
        getRowId={(row) => row.id}
        emptyMessage={
          <div className="py-8 text-center">
            <p className="text-slate-500">No ring groups yet.</p>
            {isAdmin ? (
              <Link
                href="/phone-system/ring-groups/new"
                className="mt-3 inline-flex items-center gap-2 text-sm font-medium text-indigo-600 hover:text-indigo-700"
              >
                <Plus className="h-4 w-4" />
                Create your first ring group
              </Link>
            ) : null}
          </div>
        }
        action={
          isAdmin ? (
            <Link
              href="/phone-system/ring-groups/new"
              className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700"
            >
              <Plus className="h-4 w-4" />
              Create ring group
            </Link>
          ) : undefined
        }
      />
    </div>
  );
}
