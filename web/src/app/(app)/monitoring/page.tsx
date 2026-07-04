'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Loader2, RefreshCw } from 'lucide-react';
import { PortalPageHeader } from '@/components/portal/page-header';
import { HealthDot, MetricCard, runV3AdminGuard } from '@/components/v3/ops/ops-ui';
import { getV3Monitoring, type HealthLevel, type V3MonitoringOverview } from '@/lib/v3-api';

export default function MonitoringPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [monitoring, setMonitoring] = useState<V3MonitoringOverview | null>(null);

  const load = useCallback(async () => {
    const res = await getV3Monitoring();
    setMonitoring(res.monitoring);
  }, []);

  useEffect(() => {
    runV3AdminGuard(router)
      .then((ok) => (ok ? load() : undefined))
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load monitoring'))
      .finally(() => setLoading(false));
  }, [router, load]);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  const queue = monitoring?.runtimeSyncQueue;
  const failed = monitoring?.failedSyncs;

  return (
    <div className="space-y-6">
      <PortalPageHeader
        title="Live Monitoring"
        description="Runtime sync queue, failed jobs, provisioning issues, and migration activity."
        actions={
          <button type="button" onClick={() => load().catch(() => undefined)} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium hover:bg-slate-50">
            <RefreshCw className="h-4 w-4" /> Refresh
          </button>
        }
      />

      {error ? <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
        <MetricCard label="Pending Sync" value={queue?.pending ?? 0} />
        <MetricCard label="Running" value={queue?.running ?? 0} />
        <MetricCard label="Failed Syncs" value={failed?.total ?? 0} accent={(failed?.total ?? 0) > 0 ? 'text-rose-600' : undefined} />
        <MetricCard label="Retry Queue" value={monitoring?.retryQueue?.total ?? 0} />
        <MetricCard label="Provision Failures" value={monitoring?.provisioningFailures ?? 0} accent={(monitoring?.provisioningFailures ?? 0) > 0 ? 'text-amber-600' : undefined} />
        <MetricCard label="Registration Issues" value={monitoring?.registrationIssues ?? 0} accent={(monitoring?.registrationIssues ?? 0) > 0 ? 'text-amber-600' : undefined} />
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center gap-2">
          <HealthDot level={monitoring?.runtimeHealth?.overall || 'yellow'} />
          <h3 className="text-sm font-semibold text-slate-900">Runtime Health</h3>
          {!monitoring?.runtimeHealth?.enabled ? (
            <span className="text-xs text-amber-700">Runtime sync disabled</span>
          ) : null}
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          {Object.entries(monitoring?.runtimeHealth?.domains || {}).map(([key, level]) => (
            <div key={key} className="flex items-center gap-2 text-sm capitalize">
              <HealthDot level={level as HealthLevel} />
              <span>{key.replace(/([A-Z])/g, ' $1')}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <JobList title="Sync Queue (sample)" items={queue?.items || []} empty="Queue is empty" />
        <JobList title="Recent Failures" items={failed?.recent || []} empty="No recent failures" />
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="mb-3 text-sm font-semibold text-slate-900">Migration Queue</h3>
        {(monitoring?.migrationQueue || []).length === 0 ? (
          <p className="text-sm text-slate-500">No active migrations</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {(monitoring?.migrationQueue || []).map((row, i) => {
              const job = row as Record<string, unknown>;
              return (
              <li key={String(job.id || i)} className="flex justify-between rounded-lg bg-slate-50 px-3 py-2">
                <span>{String(job.runType || 'migrate')}</span>
                <span className="font-mono text-xs text-slate-500">{String(job.status)}</span>
              </li>
              );
            })}
          </ul>
        )}
      </div>

      <Link href="/runtime" className="text-sm text-slate-600 underline hover:text-slate-900">
        Open Runtime Sync center
      </Link>
    </div>
  );
}

function JobList({ title, items, empty }: { title: string; items: unknown[]; empty: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="mb-3 text-sm font-semibold text-slate-900">{title}</h3>
      {items.length === 0 ? (
        <p className="text-sm text-slate-500">{empty}</p>
      ) : (
        <ul className="space-y-2 text-sm">
          {items.map((row, i) => {
            const job = row as Record<string, unknown>;
            return (
              <li key={String(job.id || i)} className="rounded-lg bg-slate-50 px-3 py-2">
                <div className="flex justify-between">
                  <span className="capitalize">{String(job.entityType || 'job')}</span>
                  <span className="font-mono text-xs text-slate-500">{String(job.status)}</span>
                </div>
                {job.lastError ? <p className="mt-1 truncate text-xs text-rose-600">{String(job.lastError)}</p> : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
