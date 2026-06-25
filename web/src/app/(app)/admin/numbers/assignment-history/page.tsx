'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { DataTable } from '@/components/data-table';
import { AdminPageHeader } from '@/components/admin-page-header';
import {
  getAdminDidAssignmentHistory,
  getAdminTenants,
  getMe,
  isUnauthorizedError,
  type AdminTenant,
  type DidAssignmentHistoryRow,
} from '@/lib/api';

function actionBadge(action: string) {
  const map: Record<string, string> = {
    ASSIGNED: 'bg-emerald-50 text-emerald-700',
    REASSIGNED: 'bg-amber-50 text-amber-700',
    UNASSIGNED: 'bg-slate-100 text-slate-600',
    SYNCED: 'bg-blue-50 text-blue-700',
  };
  return map[action] || 'bg-slate-100 text-slate-600';
}

export default function AdminDidAssignmentHistoryPage() {
  const router = useRouter();
  const [rows, setRows] = useState<DidAssignmentHistoryRow[]>([]);
  const [tenants, setTenants] = useState<AdminTenant[]>([]);
  const [tenantFilter, setTenantFilter] = useState('');
  const [numberFilter, setNumberFilter] = useState('');
  const [loading, setLoading] = useState(true);

  async function load() {
    const res = await getAdminDidAssignmentHistory({
      tenantId: tenantFilter || undefined,
      number: numberFilter.trim() || undefined,
      limit: 200,
    });
    setRows(res.rows || []);
  }

  useEffect(() => {
    getMe()
      .then((user) => {
        if (user.role !== 'SUPER_ADMIN') {
          router.replace('/dashboard');
          return;
        }
        return Promise.all([load(), getAdminTenants().then((r) => setTenants(r.tenants || []))]);
      })
      .catch((err) => {
        if (isUnauthorizedError(err)) router.replace('/login');
      })
      .finally(() => setLoading(false));
  }, [router]);

  async function onFilter(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await load();
    } finally {
      setLoading(false);
    }
  }

  if (loading && !rows.length) {
    return (
      <div className="flex items-center justify-center py-24 text-slate-400">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        Loading assignment history…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <AdminPageHeader
        section="Numbers"
        title="DID assignment history"
        subtitle="Audit trail of Super Admin DID sync, assign, reassign, and unassign actions."
      />

      <div className="flex justify-end">
        <Link href="/admin/numbers" className="btn-secondary px-4 py-2 text-sm">
          Back to inventory
        </Link>
      </div>

      <form onSubmit={onFilter} className="flex flex-wrap items-end gap-3">
        <label>
          <span className="mb-1 block text-sm text-slate-600">Tenant</span>
          <select
            value={tenantFilter}
            onChange={(e) => setTenantFilter(e.target.value)}
            className="input-field min-w-[200px]"
          >
            <option value="">All tenants</option>
            {tenants.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="mb-1 block text-sm text-slate-600">Number</span>
          <input
            value={numberFilter}
            onChange={(e) => setNumberFilter(e.target.value)}
            placeholder="+1555…"
            className="input-field min-w-[180px]"
          />
        </label>
        <button type="submit" className="btn-primary px-4 py-2 text-sm">
          Filter
        </button>
      </form>

      <DataTable
        title="Assignment events"
        data={rows}
        getRowId={(row) => row.id}
        defaultPageSize={20}
        emptyMessage="No assignment history yet. Sync and assign DIDs from the inventory page."
        columns={[
          {
            key: 'createdAt',
            header: 'When',
            sortable: true,
            sortValue: (row) => new Date(row.createdAt),
            render: (row) => new Date(row.createdAt).toLocaleString(),
          },
          {
            key: 'number',
            header: 'DID',
            sortable: true,
            render: (row) => <span className="font-mono">{row.number}</span>,
          },
          {
            key: 'action',
            header: 'Action',
            sortable: true,
            render: (row) => (
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${actionBadge(row.action)}`}>
                {row.action}
              </span>
            ),
          },
          {
            key: 'tenant',
            header: 'Current owner',
            render: (row) => row.tenant?.name || (row.tenantId ? row.tenantId : '—'),
          },
          {
            key: 'previousTenantId',
            header: 'Previous tenant',
            render: (row) => row.previousTenantId || '—',
          },
          {
            key: 'notes',
            header: 'Notes',
            render: (row) => row.notes || '—',
          },
        ]}
      />
    </div>
  );
}
