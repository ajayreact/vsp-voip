'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, RefreshCw } from 'lucide-react';
import { PortalPageHeader } from '@/components/portal/page-header';
import { BarChart, MetricCard, runV3AdminGuard } from '@/components/v3/ops/ops-ui';
import { getV3Metrics, type V3MetricsOverview } from '@/lib/v3-api';

export default function V3MetricsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [windowHours, setWindowHours] = useState(24);
  const [metrics, setMetrics] = useState<V3MetricsOverview | null>(null);

  const load = useCallback(async (hours = windowHours) => {
    const res = await getV3Metrics(hours);
    setMetrics(res.metrics);
  }, [windowHours]);

  useEffect(() => {
    runV3AdminGuard(router)
      .then((ok) => (ok ? load() : undefined))
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load metrics'))
      .finally(() => setLoading(false));
  }, [router, load]);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  const sync = metrics?.sync;
  const migration = metrics?.migration;

  return (
    <div className="space-y-6">
      <PortalPageHeader
        title="Operational Metrics"
        description="Sync, repair, migration, provisioning, and registration metrics over a rolling window."
        actions={
          <div className="flex items-center gap-2">
            <select
              value={windowHours}
              onChange={(e) => {
                const h = Number(e.target.value);
                setWindowHours(h);
                load(h).catch(() => undefined);
              }}
              className="rounded-lg border border-slate-300 px-2 py-2 text-sm"
            >
              <option value={6}>6 hours</option>
              <option value={24}>24 hours</option>
              <option value={72}>72 hours</option>
              <option value={168}>7 days</option>
            </select>
            <button type="button" onClick={() => load().catch(() => undefined)} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium hover:bg-slate-50">
              <RefreshCw className="h-4 w-4" /> Refresh
            </button>
          </div>
        }
      />

      {error ? <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
        <MetricCard label="Sync Jobs" value={sync?.total ?? 0} />
        <MetricCard label="Sync Success" value={sync?.success ?? 0} accent="text-emerald-600" />
        <MetricCard label="Sync Failed" value={sync?.failed ?? 0} accent={(sync?.failed ?? 0) > 0 ? 'text-rose-600' : undefined} />
        <MetricCard label="Avg Sync (ms)" value={sync?.avgDurationMs ?? '—'} />
        <MetricCard label="Queue Length" value={sync?.queueLength ?? 0} />
        <MetricCard label="Registration Rate" value={`${metrics?.registration?.rate ?? 0}%`} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <BarChart
          title="Sync Outcomes"
          data={[
            { label: 'Success', value: sync?.success ?? 0 },
            { label: 'Failed', value: sync?.failed ?? 0 },
            { label: 'Queue', value: sync?.queueLength ?? 0 },
          ]}
        />
        <BarChart
          title="Migration & Provisioning"
          data={[
            { label: 'Migrations', value: migration?.total ?? 0 },
            { label: 'Mig. Success', value: migration?.success ?? 0 },
            { label: 'Prov. Fail Est.', value: metrics?.provisioning?.failureEstimate ?? 0 },
          ]}
        />
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <MetricCard label="Migration Total" value={migration?.total ?? 0} />
        <MetricCard label="Migration Success" value={migration?.success ?? 0} />
        <MetricCard label="Avg Migration (ms)" value={migration?.avgDurationMs ?? '—'} />
        <MetricCard label="Provision Success" value={metrics?.provisioning?.successRate != null ? `${metrics.provisioning.successRate}%` : '—'} />
      </div>
    </div>
  );
}
