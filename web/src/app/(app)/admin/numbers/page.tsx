'use client';

import 'sweetalert2/dist/sweetalert2.min.css';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Hash, Loader2, Search } from 'lucide-react';
import Swal from 'sweetalert2';
import { DataTable } from '@/components/data-table';
import { KpiCard, KpiSection } from '@/components/kpi-card';
import { AdminPageHeader } from '@/components/admin-page-header';
import {
  getAdminNumberInventory,
  getMe,
  isUnauthorizedError,
  releaseAdminNumber,
  type NumberInventoryRow,
  type NumberInventorySummary,
} from '@/lib/api';
import { formatPrice } from '@/lib/pricing';
import { SWAL_THEME } from '@/lib/swal-theme';

const STATUS_OPTIONS = ['ALL', 'ASSIGNED', 'PORTING', 'RELEASED'] as const;

function statusBadge(status: string) {
  const map: Record<string, string> = {
    ASSIGNED: 'bg-emerald-50 text-emerald-700',
    AVAILABLE: 'bg-blue-50 text-blue-700',
    PORTING: 'bg-amber-50 text-amber-700',
    RELEASED: 'bg-slate-100 text-slate-600',
  };
  return map[status] || 'bg-slate-100 text-slate-600';
}

export default function AdminNumberInventoryPage() {
  const router = useRouter();
  const [summary, setSummary] = useState<NumberInventorySummary | null>(null);
  const [numbers, setNumbers] = useState<NumberInventoryRow[]>([]);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<(typeof STATUS_OPTIONS)[number]>('ALL');
  const [loading, setLoading] = useState(true);
  const [releasingId, setReleasingId] = useState<string | null>(null);

  async function load() {
    const res = await getAdminNumberInventory({
      search: search.trim() || undefined,
      status: status === 'ALL' ? undefined : status,
    });
    setSummary(res.summary);
    setNumbers(res.numbers || []);
  }

  useEffect(() => {
    getMe()
      .then((user) => {
        if (user.role !== 'SUPER_ADMIN') {
          router.replace('/dashboard');
          return;
        }
        return load();
      })
      .catch((err) => {
        if (isUnauthorizedError(err)) router.replace('/login');
      })
      .finally(() => setLoading(false));
  }, [router]);

  async function onSearch(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await load();
    } finally {
      setLoading(false);
    }
  }

  async function onRelease(row: NumberInventoryRow) {
    const confirm = await Swal.fire({
      title: `Release ${row.number}?`,
      text: 'Marks the number inactive and unassigns the user. The number remains on your Telnyx account until released in the carrier portal.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Release',
      ...SWAL_THEME,
    });
    if (!confirm.isConfirmed) return;

    setReleasingId(row.id);
    try {
      await releaseAdminNumber(row.id);
      await load();
      await Swal.fire({ title: 'Number released', icon: 'success', timer: 1500, showConfirmButton: false, ...SWAL_THEME });
    } catch (err) {
      await Swal.fire({
        title: 'Release failed',
        text: err instanceof Error ? err.message : 'Could not release number',
        icon: 'error',
        ...SWAL_THEME,
      });
    } finally {
      setReleasingId(null);
    }
  }

  if (loading && !numbers.length) {
    return (
      <div className="flex items-center justify-center py-24 text-slate-400">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        Loading inventory…
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <AdminPageHeader
        section="Numbers"
        title="Number inventory"
        subtitle="Telecom inventory across all tenants. Purchase numbers from Search & buy numbers."
      />

      {summary ? (
        <KpiSection title="Inventory snapshot">
          <KpiCard title="Purchased numbers" value={summary.purchased} icon={Hash} tone="indigo" />
          <KpiCard title="Assigned numbers" value={summary.assigned} icon={Hash} tone="emerald" />
          <KpiCard
            title="Available numbers"
            value={summary.availableSynced === false ? '—' : summary.available}
            subtitle={
              summary.availableSynced === false
                ? 'Could not sync Telnyx'
                : 'Telnyx account, unassigned in platform'
            }
            icon={Hash}
            tone="sky"
          />
          <KpiCard title="Porting numbers" value={summary.porting} icon={Hash} tone="amber" href="/admin/numbers/porting" />
          <KpiCard title="Released numbers" value={summary.released} icon={Hash} tone="slate" />
        </KpiSection>
      ) : null}

      <form onSubmit={onSearch} className="flex flex-wrap items-end gap-3">
        <label className="flex-1 min-w-[200px]">
          <span className="mb-1 block text-sm text-slate-600">Search</span>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Number, tenant, label…"
              className="input-field w-full pl-9"
            />
          </div>
        </label>
        <label>
          <span className="mb-1 block text-sm text-slate-600">Status</span>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as typeof status)}
            className="input-field"
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s === 'ALL' ? 'All statuses' : s}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className="btn-primary px-4 py-2 text-sm">
          Search
        </button>
      </form>

      <DataTable
        title="Number directory"
        data={numbers}
        getRowId={(n) => n.id}
        defaultPageSize={15}
        emptyMessage="No numbers match your filters"
        columns={[
          { key: 'number', header: 'Number', sortable: true, render: (n) => <span className="font-mono">{n.number}</span> },
          {
            key: 'status',
            header: 'Status',
            sortable: true,
            render: (n) => (
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusBadge(n.status)}`}>
                {n.status}
              </span>
            ),
          },
          { key: 'tenantName', header: 'Tenant', sortable: true, render: (n) => n.tenantName || '—' },
          { key: 'assignedUserName', header: 'User', render: (n) => n.assignedUserName || '—' },
          {
            key: 'monthlyCost',
            header: 'MRC',
            render: (n) => (n.monthlyCost != null ? formatPrice(n.monthlyCost) : '—'),
          },
          {
            key: 'actions',
            header: 'Actions',
            searchable: false,
            sortable: false,
            render: (n) => (
              <div className="flex gap-2">
                {n.tenantId ? (
                  <Link href={`/admin/tenants/${n.tenantId}`} className="text-indigo-600 hover:text-indigo-500">
                    Tenant
                  </Link>
                ) : null}
                {n.status === 'ASSIGNED' && n.isActive ? (
                  <button
                    type="button"
                    disabled={releasingId === n.id}
                    onClick={() => onRelease(n)}
                    className="text-rose-600 hover:text-rose-500 disabled:opacity-50"
                  >
                    {releasingId === n.id ? '…' : 'Release'}
                  </button>
                ) : null}
              </div>
            ),
          },
        ]}
      />
    </div>
  );
}
