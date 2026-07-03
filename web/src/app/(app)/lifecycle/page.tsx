'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { PortalPageHeader } from '@/components/portal/page-header';
import { MetricCard, runV3AdminGuard } from '@/components/v3/ops/ops-ui';
import { getV3Lifecycle, runV3LifecycleAction, type V3LifecycleOverview } from '@/lib/v3-api';

export default function LifecyclePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [lifecycle, setLifecycle] = useState<V3LifecycleOverview | null>(null);

  async function load() {
    const res = await getV3Lifecycle();
    setLifecycle(res.lifecycle);
  }

  useEffect(() => {
    runV3AdminGuard(router).then((ok) => (ok ? load() : undefined))
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load lifecycle'))
      .finally(() => setLoading(false));
  }, [router]);

  async function runAction(action: string) {
    setBusy(action);
    setError('');
    try {
      await runV3LifecycleAction(action);
      setMessage(`Action "${action}" completed.`);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Action failed');
    } finally {
      setBusy('');
    }
  }

  if (loading) return <div className="flex h-64 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  const tenant = lifecycle?.tenant || {};
  const actions = lifecycle?.actions || {};

  return (
    <div className="space-y-6">
      <PortalPageHeader title="Tenant Lifecycle" description="Reversible archive, deactivate, snapshot, and clone preview — no destructive operations." />
      {error ? <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}
      {message ? <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{message}</div> : null}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <MetricCard label="Status" value={lifecycle?.status || '—'} />
        <MetricCard label="Active" value={tenant.isActive ? 'Yes' : 'No'} accent={tenant.isActive ? 'text-emerald-600' : 'text-amber-600'} />
        <MetricCard label="Billing" value={tenant.billingStatus || '—'} />
        <MetricCard label="Backups" value={lifecycle?.backup?.count ?? 0} />
      </div>
      <div className="flex flex-wrap gap-2">
        {actions.canSnapshot ? <ActionButton label="Create Snapshot" busy={busy} action="snapshot" onRun={runAction} /> : null}
        {actions.canArchive ? <ActionButton label="Archive" busy={busy} action="archive" onRun={runAction} /> : null}
        {actions.canDeactivate ? <ActionButton label="Deactivate" busy={busy} action="deactivate" onRun={runAction} /> : null}
        {actions.canReactivate ? <ActionButton label="Reactivate" busy={busy} action="reactivate" onRun={runAction} /> : null}
        {actions.canClonePreview ? <ActionButton label="Clone Preview" busy={busy} action="clone-preview" onRun={runAction} /> : null}
      </div>
    </div>
  );
}

function ActionButton({ label, action, busy, onRun }: { label: string; action: string; busy: string; onRun: (a: string) => void }) {
  return (
    <button type="button" disabled={!!busy} onClick={() => onRun(action)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium hover:bg-slate-50 disabled:opacity-60">
      {busy === action ? 'Working…' : label}
    </button>
  );
}
