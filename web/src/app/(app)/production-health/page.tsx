'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Loader2, RefreshCw } from 'lucide-react';
import { PortalPageHeader } from '@/components/portal/page-header';
import { HealthDot, MetricCard, runV3AdminGuard } from '@/components/v3/ops/ops-ui';
import { getV3ProductionHealth, type HealthLevel, type V3ProductionHealth } from '@/lib/v3-api';

export default function ProductionHealthPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [health, setHealth] = useState<V3ProductionHealth | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const res = await getV3ProductionHealth();
    setHealth(res.health);
  }, []);

  useEffect(() => {
    runV3AdminGuard(router)
      .then((ok) => (ok ? load() : undefined))
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load production health'))
      .finally(() => setLoading(false));
  }, [router, load]);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  const domains = health?.healthyDomains || {};

  return (
    <div className="space-y-6">
      <PortalPageHeader
        title="Production Health"
        description="Overall readiness scorecard for deployment, runtime sync, backups, licensing, and validation."
        actions={
          <button type="button" onClick={() => load().catch(() => undefined)} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium hover:bg-slate-50">
            <RefreshCw className="h-4 w-4" /> Refresh
          </button>
        }
      />

      {error ? <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}

      <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <HealthDot level={health?.overall || 'yellow'} title="Overall status" />
        <div>
          <p className="text-sm font-medium text-slate-900">Overall Status</p>
          <p className="text-xs text-slate-500 capitalize">{health?.overall || 'unknown'}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
        {Object.entries(domains).map(([key, level]) => (
          <MetricCard key={key} label={formatLabel(key)} value={String(level)} accent={levelAccent(level as HealthLevel)} />
        ))}
        <MetricCard label="Failed Syncs" value={health?.runtime?.failedSyncs ?? 0} accent={(health?.runtime?.failedSyncs ?? 0) > 0 ? 'text-amber-600' : undefined} />
        <MetricCard label="Sync Success" value={health?.metrics?.syncSuccessRate != null ? `${health.metrics.syncSuccessRate}%` : '—'} />
        <MetricCard label="Provision Rate" value={health?.metrics?.provisioningSuccessRate != null ? `${health.metrics.provisioningSuccessRate}%` : '—'} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <IssuePanel title="Critical Issues" items={health?.criticalIssues || []} empty="No critical issues" tone="rose" />
        <IssuePanel title="Warnings" items={health?.warnings || []} empty="No warnings" tone="amber" />
      </div>

      <div className="flex flex-wrap gap-2 text-sm">
        <QuickLink href="/monitoring" label="Monitoring" />
        <QuickLink href="/diagnostics" label="Diagnostics" />
        <QuickLink href="/runtime-validation" label="Runtime Validation" />
        <QuickLink href="/migration" label="Migration" />
      </div>
    </div>
  );
}

function IssuePanel({ title, items, empty, tone }: { title: string; items: Array<{ message: string; code?: string }>; empty: string; tone: 'rose' | 'amber' }) {
  const border = tone === 'rose' ? 'border-rose-200' : 'border-amber-200';
  return (
    <div className={`rounded-xl border ${border} bg-white p-4 shadow-sm`}>
      <h3 className="mb-3 text-sm font-semibold text-slate-900">{title}</h3>
      {items.length === 0 ? (
        <p className="text-sm text-slate-500">{empty}</p>
      ) : (
        <ul className="space-y-2 text-sm text-slate-700">
          {items.map((item, i) => (
            <li key={`${item.code || 'issue'}-${i}`}>
              {item.code ? <span className="font-mono text-xs text-slate-500">{item.code}: </span> : null}
              {item.message}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function QuickLink({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className="rounded-lg border border-slate-200 px-3 py-1.5 hover:bg-slate-50">
      {label}
    </Link>
  );
}

function formatLabel(key: string) {
  return key.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase());
}

function levelAccent(level?: HealthLevel) {
  if (level === 'green') return 'text-emerald-600';
  if (level === 'yellow') return 'text-amber-600';
  if (level === 'red') return 'text-rose-600';
  return undefined;
}
