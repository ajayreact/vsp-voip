'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Loader2, RefreshCw, Wrench } from 'lucide-react';
import { PortalPageHeader } from '@/components/portal/page-header';
import { HealthDot, MetricCard, runV3AdminGuard } from '@/components/v3/ops/ops-ui';
import {
  getV3RuntimeHealth,
  getV3RuntimeStatus,
  repairV3Runtime,
  resyncV3Runtime,
  type HealthLevel,
  type V3RuntimeHealth,
  type V3RuntimeStatus,
} from '@/lib/v3-api';

export default function V3RuntimePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState<V3RuntimeStatus | null>(null);
  const [health, setHealth] = useState<V3RuntimeHealth | null>(null);
  const [featureFlag, setFeatureFlag] = useState({ globalEnabled: false, tenantEnabled: false });

  const load = useCallback(async () => {
    const [statusRes, healthRes] = await Promise.all([getV3RuntimeStatus(), getV3RuntimeHealth()]);
    setStatus(statusRes.status);
    setHealth(healthRes.health);
    setFeatureFlag(statusRes.featureFlag);
  }, []);

  useEffect(() => {
    runV3AdminGuard(router)
      .then((ok) => (ok ? load() : undefined))
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load runtime status'))
      .finally(() => setLoading(false));
  }, [router, load]);

  async function onResync() {
    setBusy('resync');
    setError('');
    try {
      await resyncV3Runtime();
      setMessage('Full resync enqueued and processed.');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Resync failed');
    } finally {
      setBusy('');
    }
  }

  async function onRepair() {
    setBusy('repair');
    setError('');
    try {
      const res = await repairV3Runtime();
      setMessage(`Repair completed — ${res.result.count} item(s) fixed.`);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Repair failed');
    } finally {
      setBusy('');
    }
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  const domains = health?.domains || {};

  return (
    <div className="space-y-6">
      <PortalPageHeader
        title="Runtime Telephony"
        description="V3 orchestration layer bridging configuration into the existing production telephony engine."
        actions={
          <div className="flex gap-2">
            <button type="button" disabled={!!busy} onClick={onResync} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium hover:bg-slate-50 disabled:opacity-60">
              <RefreshCw className="h-4 w-4" /> Resync All
            </button>
            <button type="button" disabled={!!busy} onClick={onRepair} className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60">
              <Wrench className="h-4 w-4" /> Repair
            </button>
          </div>
        }
      />

      {!featureFlag.globalEnabled ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Runtime sync is disabled globally (<code className="text-xs">V3_RUNTIME_SYNC_ENABLED=false</code>). Jobs will not enqueue until enabled for your environment.
        </div>
      ) : null}

      {error ? <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}
      {message ? <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{message}</div> : null}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
        <MetricCard label="Runtime Ready" value={domains.runtimeReady || '—'} accent={levelAccent(domains.runtimeReady)} />
        <MetricCard label="Pending Jobs" value={status?.jobs.pending ?? 0} />
        <MetricCard label="Failed / Retry" value={status?.jobs.failed ?? 0} accent={(status?.jobs.failed ?? 0) > 0 ? 'text-amber-600' : undefined} />
        <MetricCard label="Dead Letter" value={status?.jobs.deadLetter ?? 0} accent={(status?.jobs.deadLetter ?? 0) > 0 ? 'text-rose-600' : undefined} />
        <MetricCard label="Runtime Links" value={status?.links.total ?? 0} />
        <MetricCard label="Last Success" value={status?.lastSuccessfulSync ? new Date(status.lastSuccessfulSync).toLocaleString() : '—'} />
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="mb-3 text-sm font-semibold text-slate-900">Sync Health by Domain</h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {Object.entries(domains).map(([key, level]) => (
            <div key={key} className="flex items-center gap-2 text-sm capitalize">
              <HealthDot level={level as HealthLevel} />
              {key.replace(/([A-Z])/g, ' $1')}
            </div>
          ))}
        </div>
      </div>

      <div className="flex gap-4 text-sm">
        <Link href="/v3/runtime/jobs" className="font-medium text-slate-700 underline hover:text-slate-900">View sync jobs</Link>
        <Link href="/v3/runtime/health" className="font-medium text-slate-700 underline hover:text-slate-900">Detailed health</Link>
      </div>
    </div>
  );
}

function levelAccent(level?: string) {
  if (level === 'green') return 'text-emerald-600';
  if (level === 'yellow') return 'text-amber-600';
  if (level === 'red') return 'text-rose-600';
  return undefined;
}
