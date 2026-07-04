'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Link2, Loader2 } from 'lucide-react';
import { PortalPageHeader } from '@/components/portal/page-header';
import { getExtensions, getMe, isUnauthorizedError } from '@/lib/api';
import { assignV3Number, getV3Numbers, type InventoryNumber } from '@/lib/v3-api';

export default function AssignmentsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [numbers, setNumbers] = useState<InventoryNumber[]>([]);
  const [extensions, setExtensions] = useState<Array<{ id: string; extensionNumber: string; displayName: string }>>([]);
  const [phoneNumberId, setPhoneNumberId] = useState('');
  const [extensionId, setExtensionId] = useState('');
  const [tenantId, setTenantId] = useState('');
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [assigning, setAssigning] = useState(false);

  useEffect(() => {getMe()
      .then(async (user) => {
        if (user.role !== 'TENANT_ADMIN' && user.role !== 'SUPER_ADMIN') {
          router.replace('/dashboard');
          return;
        }
        setIsSuperAdmin(user.role === 'SUPER_ADMIN');
        const [nums, extRes] = await Promise.all([
          getV3Numbers({ tenantScoped: user.role !== 'SUPER_ADMIN' }),
          user.tenantId ? getExtensions().catch(() => ({ extensions: [] })) : { extensions: [] },
        ]);
        setNumbers(nums.items || []);
        setExtensions((extRes.extensions || []).map((e) => ({
          id: e.id,
          extensionNumber: e.extensionNumber,
          displayName: e.displayName,
        })));
      })
      .catch((err) => {
        if (isUnauthorizedError(err)) router.replace('/login');
        else setError(err instanceof Error ? err.message : 'Failed to load');
      })
      .finally(() => setLoading(false));
  }, [router]);

  async function onAssign(e: React.FormEvent) {
    e.preventDefault();
    setAssigning(true);
    setMessage('');
    setError('');
    try {
      const res = await assignV3Number({
        phoneNumberId,
        extensionId: extensionId || undefined,
        tenantId: isSuperAdmin && tenantId ? tenantId : undefined,
      });
      setMessage(`Assigned (${res.assignment}) successfully.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Assignment failed');
    } finally {
      setAssigning(false);
    }
  }

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
        title="Number Assignments"
        description="Assign inventory numbers to tenants (Super Admin) or extensions (Tenant Admin)."
      />

      {error ? <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}
      {message ? <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{message}</div> : null}

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="flex items-center gap-2 text-base font-semibold text-slate-900">
          <Link2 className="h-4 w-4" /> Assign Number
        </h2>
        <form onSubmit={onAssign} className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-slate-600">Phone number</label>
            <select
              value={phoneNumberId}
              onChange={(e) => setPhoneNumberId(e.target.value)}
              required
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="">Select number…</option>
              {numbers.map((n) => (
                <option key={n.id} value={n.id}>{n.number} ({n.inventoryStatus})</option>
              ))}
            </select>
          </div>
          {isSuperAdmin ? (
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-600">Tenant ID (platform → tenant)</label>
              <input
                value={tenantId}
                onChange={(e) => setTenantId(e.target.value)}
                placeholder="Tenant UUID"
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
          ) : null}
          {!isSuperAdmin || !tenantId ? (
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-600">Extension</label>
              <select
                value={extensionId}
                onChange={(e) => setExtensionId(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="">Select extension…</option>
                {extensions.map((ext) => (
                  <option key={ext.id} value={ext.id}>{ext.extensionNumber} — {ext.displayName}</option>
                ))}
              </select>
            </div>
          ) : null}
          <div className="sm:col-span-2">
            <button
              type="submit"
              disabled={assigning}
              className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
            >
              {assigning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
              Assign
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
