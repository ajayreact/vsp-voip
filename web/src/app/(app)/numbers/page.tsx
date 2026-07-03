'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Wrench } from 'lucide-react';
import { PortalPageHeader } from '@/components/portal/page-header';
import { getMe, isUnauthorizedError } from '@/lib/api';
import { getV3Numbers, getV3NumbersHealth, repairV3Numbers, type InventoryNumber, type NumberHealth } from '@/lib/v3-api';

const STATUS_CLASS: Record<string, string> = {
  AVAILABLE: 'bg-slate-100 text-slate-700',
  RESERVED: 'bg-amber-100 text-amber-800',
  ASSIGNED: 'bg-emerald-100 text-emerald-800',
  PORTING: 'bg-blue-100 text-blue-800',
  RELEASE_PENDING: 'bg-orange-100 text-orange-800',
  SUSPENDED: 'bg-rose-100 text-rose-800',
};

const LEVEL_DOT: Record<string, string> = {
  green: 'bg-emerald-500',
  yellow: 'bg-amber-500',
  red: 'bg-rose-500',
};

export default function NumbersPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [items, setItems] = useState<InventoryNumber[]>([]);
  const [health, setHealth] = useState<NumberHealth[]>([]);
  const [repairMsg, setRepairMsg] = useState('');
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [ready, setReady] = useState(false);

  async function load(superAdmin: boolean) {
    const [nums, healthRes] = await Promise.all([
      getV3Numbers({ tenantScoped: !superAdmin }),
      getV3NumbersHealth(superAdmin),
    ]);
    setItems(nums.items || []);
    setHealth(healthRes.numbers || []);
  }

  useEffect(() => {getMe()
      .then((user) => {
        if (user.role !== 'TENANT_ADMIN' && user.role !== 'SUPER_ADMIN') {
          router.replace('/dashboard');
          return;
        }
        const superAdmin = user.role === 'SUPER_ADMIN';
        setIsSuperAdmin(superAdmin);
        setReady(true);
        return load(superAdmin);
      })
      .catch((err) => {
        if (isUnauthorizedError(err)) router.replace('/login');
        else setError(err instanceof Error ? err.message : 'Failed to load');
      })
      .finally(() => setLoading(false));
  }, [router]);

  async function onRepair(apply: boolean) {
    setRepairMsg('');
    if (apply && !window.confirm('Apply number inventory repairs for this tenant?')) return;
    try {
      const report = await repairV3Numbers(apply, false);
      setRepairMsg(`${report.mode}: ${report.changes.length} change(s)${apply ? `, ${report.applied.filter((a) => a.ok).length} applied` : ''}`);
      if (apply && ready) await load(isSuperAdmin);
    } catch (err) {
      setRepairMsg(err instanceof Error ? err.message : 'Repair failed');
    }
  }

  const healthById = new Map(health.map((h) => [h.phoneNumberId, h]));

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center text-slate-500">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PortalPageHeader
        title="Number Inventory"
        description={isSuperAdmin ? 'Global platform inventory (Super Admin).' : 'Numbers assigned to your organization.'}
        actions={
          <div className="flex gap-2">
            <button type="button" onClick={() => load(isSuperAdmin)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">Refresh</button>
            <button type="button" onClick={() => onRepair(false)} className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-2 text-sm">
              <Wrench className="h-4 w-4" /> Inspect
            </button>
            <button type="button" onClick={() => onRepair(true)} className="inline-flex items-center gap-1 rounded-lg bg-amber-600 px-3 py-2 text-sm text-white">
              Repair
            </button>
          </div>
        }
      />

      {error ? <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}
      {repairMsg ? <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm">{repairMsg}</div> : null}

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-xs font-medium uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Number</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Tenant</th>
              <th className="px-4 py-3">Extension</th>
              <th className="px-4 py-3">Health</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {items.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-500">No numbers found.</td></tr>
            ) : items.map((row) => {
              const h = healthById.get(row.id);
              return (
                <tr key={row.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium">{row.number}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_CLASS[row.inventoryStatus] || ''}`}>
                      {row.inventoryStatus}
                    </span>
                  </td>
                  <td className="px-4 py-3">{row.tenantName || '—'}</td>
                  <td className="px-4 py-3">{row.extensionNumber || '—'}</td>
                  <td className="px-4 py-3">
                    {h ? (
                      <span className={`inline-block h-2.5 w-2.5 rounded-full ${LEVEL_DOT[h.overall]}`} title={h.overall} />
                    ) : '—'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
