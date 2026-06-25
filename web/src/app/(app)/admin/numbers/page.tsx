'use client';

import 'sweetalert2/dist/sweetalert2.min.css';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Hash, History, Loader2, RefreshCw, Search } from 'lucide-react';
import Swal from 'sweetalert2';
import { DataTable } from '@/components/data-table';
import { KpiCard, KpiSection } from '@/components/kpi-card';
import { AdminPageHeader } from '@/components/admin-page-header';
import {
  assignAdminNumber,
  getAdminNumberInventory,
  getAdminTenants,
  getMe,
  isUnauthorizedError,
  releaseAdminNumber,
  syncAdminTelnyxNumbers,
  unassignAdminNumber,
  type AdminTenant,
  type NumberInventoryRow,
  type NumberInventorySummary,
} from '@/lib/api';
import { formatPrice } from '@/lib/pricing';
import { SWAL_THEME } from '@/lib/swal-theme';

const STATUS_OPTIONS = ['ALL', 'ASSIGNED', 'UNASSIGNED', 'PORTING', 'RELEASED'] as const;

function statusBadge(status: string) {
  const map: Record<string, string> = {
    ASSIGNED: 'bg-emerald-50 text-emerald-700',
    UNASSIGNED: 'bg-blue-50 text-blue-700',
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
  const [tenants, setTenants] = useState<AdminTenant[]>([]);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<(typeof STATUS_OPTIONS)[number]>('ALL');
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [releasingId, setReleasingId] = useState<string | null>(null);
  const [unassigningId, setUnassigningId] = useState<string | null>(null);
  const [assigningId, setAssigningId] = useState<string | null>(null);

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
        return Promise.all([load(), getAdminTenants().then((r) => setTenants(r.tenants || []))]);
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

  async function onSyncTelnyx() {
    setSyncing(true);
    try {
      const result = await syncAdminTelnyxNumbers();
      await load();
      await Swal.fire({
        title: 'Telnyx sync complete',
        html: `<p>Imported <strong>${result.created}</strong> new number(s).</p>
          <p class="text-sm text-slate-500">Telnyx account: ${result.telnyxTotal} · Platform: ${result.dbTotal} · Assigned: ${result.assigned} · Unassigned: ${result.unassigned}</p>`,
        icon: 'success',
        ...SWAL_THEME,
      });
    } catch (err) {
      await Swal.fire({
        title: 'Sync failed',
        text: err instanceof Error ? err.message : 'Could not sync Telnyx numbers',
        icon: 'error',
        ...SWAL_THEME,
      });
    } finally {
      setSyncing(false);
    }
  }

  async function onAssign(row: NumberInventoryRow) {
    if (!tenants.length) {
      await Swal.fire({ title: 'No tenants', text: 'Create a tenant before assigning numbers.', icon: 'info', ...SWAL_THEME });
      return;
    }

    const { value: tenantId } = await Swal.fire({
      title: `Assign ${row.number}`,
      input: 'select',
      inputOptions: Object.fromEntries(tenants.map((t) => [t.id, t.name])),
      inputPlaceholder: 'Select tenant',
      showCancelButton: true,
      confirmButtonText: 'Assign',
      ...SWAL_THEME,
    });
    if (!tenantId) return;

    setAssigningId(row.id);
    try {
      await assignAdminNumber({ phoneNumberId: row.id, tenantId: String(tenantId) });
      await load();
      await Swal.fire({ title: 'Number assigned', icon: 'success', timer: 1500, showConfirmButton: false, ...SWAL_THEME });
    } catch (err) {
      await Swal.fire({
        title: 'Assign failed',
        text: err instanceof Error ? err.message : 'Could not assign number',
        icon: 'error',
        ...SWAL_THEME,
      });
    } finally {
      setAssigningId(null);
    }
  }

  async function onUnassign(row: NumberInventoryRow) {
    const confirm = await Swal.fire({
      title: `Unassign ${row.number}?`,
      text: 'Returns the DID to the Super Admin pool. Inbound calls will stop routing to this tenant.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Unassign',
      ...SWAL_THEME,
    });
    if (!confirm.isConfirmed) return;

    setUnassigningId(row.id);
    try {
      await unassignAdminNumber(row.id);
      await load();
      await Swal.fire({ title: 'Number unassigned', icon: 'success', timer: 1500, showConfirmButton: false, ...SWAL_THEME });
    } catch (err) {
      await Swal.fire({
        title: 'Unassign failed',
        text: err instanceof Error ? err.message : 'Could not unassign number',
        icon: 'error',
        ...SWAL_THEME,
      });
    } finally {
      setUnassigningId(null);
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
        title="DID management"
        subtitle="Super Admin inventory from Telnyx. Sync, assign DIDs to tenants, and track assignment history."
      />

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onSyncTelnyx}
          disabled={syncing}
          className="btn-primary inline-flex items-center gap-2 px-4 py-2 text-sm disabled:opacity-50"
        >
          {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Sync from Telnyx
        </button>
        <Link href="/admin/numbers/assignment-history" className="btn-secondary inline-flex items-center gap-2 px-4 py-2 text-sm">
          <History className="h-4 w-4" />
          Assignment history
        </Link>
        <Link href="/admin/numbers/purchase" className="btn-secondary px-4 py-2 text-sm">
          Search & buy
        </Link>
      </div>

      {summary ? (
        <KpiSection title="Inventory snapshot">
          <KpiCard title="Purchased numbers" value={summary.purchased} icon={Hash} tone="indigo" />
          <KpiCard title="Assigned numbers" value={summary.assigned} icon={Hash} tone="emerald" />
          <KpiCard
            title="Unassigned pool"
            value={summary.unassigned ?? summary.available}
            subtitle="Available for tenant assignment"
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
                {s === 'ALL' ? 'All statuses' : s.charAt(0) + s.slice(1).toLowerCase()}
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
        emptyMessage="No numbers match your filters. Sync from Telnyx to import your account inventory."
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
          { key: 'tenantName', header: 'Current tenant', sortable: true, render: (n) => n.tenantName || '—' },
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
              <div className="flex flex-wrap gap-2">
                {n.tenantId ? (
                  <Link href={`/admin/tenants/${n.tenantId}`} className="text-indigo-600 hover:text-indigo-500">
                    Tenant
                  </Link>
                ) : null}
                {!n.tenantId && n.isActive && n.status !== 'PORTING' ? (
                  <button
                    type="button"
                    disabled={assigningId === n.id}
                    onClick={() => onAssign(n)}
                    className="text-indigo-600 hover:text-indigo-500 disabled:opacity-50"
                  >
                    {assigningId === n.id ? '…' : 'Assign'}
                  </button>
                ) : null}
                {n.tenantId && n.isActive ? (
                  <button
                    type="button"
                    disabled={unassigningId === n.id}
                    onClick={() => onUnassign(n)}
                    className="text-amber-600 hover:text-amber-500 disabled:opacity-50"
                  >
                    {unassigningId === n.id ? '…' : 'Unassign'}
                  </button>
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
