'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, RefreshCw } from 'lucide-react';
import { PortalPageHeader } from '@/components/portal/page-header';
import { MetricCard, runV3AdminGuard } from '@/components/v3/ops/ops-ui';
import { getV3Diagnostics, type V3DiagnosticsReport } from '@/lib/v3-api';

export default function V3DiagnosticsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [diagnostics, setDiagnostics] = useState<V3DiagnosticsReport | null>(null);

  const load = useCallback(async () => {
    const res = await getV3Diagnostics();
    setDiagnostics(res.diagnostics);
  }, []);

  useEffect(() => {
    runV3AdminGuard(router)
      .then((ok) => (ok ? load() : undefined))
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load diagnostics'))
      .finally(() => setLoading(false));
  }, [router, load]);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  const issues = diagnostics?.issues || [];
  const critical = issues.filter((i) => i.severity === 'critical');
  const warnings = issues.filter((i) => i.severity === 'warning');

  return (
    <div className="space-y-6">
      <PortalPageHeader
        title="Diagnostics Center"
        description="Configuration drift, missing runtime links, provisioning gaps, and repair recommendations."
        actions={
          <button type="button" onClick={() => load().catch(() => undefined)} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium hover:bg-slate-50">
            <RefreshCw className="h-4 w-4" /> Refresh
          </button>
        }
      />

      {error ? <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <MetricCard label="Config Version" value={diagnostics?.configurationVersion ?? '—'} />
        <MetricCard label="Critical" value={critical.length} accent={critical.length ? 'text-rose-600' : undefined} />
        <MetricCard label="Warnings" value={warnings.length} accent={warnings.length ? 'text-amber-600' : undefined} />
        <MetricCard label="Latest Backup" value={diagnostics?.backupFreshness?.createdAt ? new Date(diagnostics.backupFreshness.createdAt).toLocaleDateString() : 'None'} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <IssueList title="Configuration Issues" items={issues} empty="No issues detected" />
        <RecommendationList items={diagnostics?.repairRecommendations || []} />
      </div>
    </div>
  );
}

function IssueList({ title, items, empty }: { title: string; items: Array<{ severity: string; code: string; message: string }>; empty: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="mb-3 text-sm font-semibold text-slate-900">{title}</h3>
      {items.length === 0 ? (
        <p className="text-sm text-slate-500">{empty}</p>
      ) : (
        <ul className="space-y-2 text-sm">
          {items.map((item, i) => (
            <li key={`${item.code}-${i}`} className="rounded-lg bg-slate-50 px-3 py-2">
              <span className={`mr-2 rounded px-1.5 py-0.5 text-xs font-medium ${item.severity === 'critical' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-800'}`}>
                {item.severity}
              </span>
              <span className="font-mono text-xs text-slate-500">{item.code}</span>
              <p className="mt-1 text-slate-700">{item.message}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function RecommendationList({ items }: { items: Array<{ action: string; reason: string; target?: string }> }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="mb-3 text-sm font-semibold text-slate-900">Repair Recommendations</h3>
      {items.length === 0 ? (
        <p className="text-sm text-slate-500">No recommendations</p>
      ) : (
        <ul className="space-y-2 text-sm">
          {items.map((item, i) => (
            <li key={`${item.action}-${i}`} className="rounded-lg border border-slate-100 px-3 py-2">
              <p className="font-medium capitalize text-slate-900">{item.action.replace(/_/g, ' ')}{item.target ? ` — ${item.target}` : ''}</p>
              <p className="text-slate-600">{item.reason}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
