'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { PortalPageHeader } from '@/components/portal/page-header';
import { HealthDot, LineTrend, MetricCard, runV3AdminGuard } from '@/components/v3/ops/ops-ui';
import { getV3SystemHealth, type HealthLevel, type SystemHealthResponse } from '@/lib/v3-api';

export default function SystemHealthPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [health, setHealth] = useState<SystemHealthResponse | null>(null);

  const load = useCallback(async () => {
    const res = await getV3SystemHealth();
    setHealth(res.systemHealth);
  }, []);

  useEffect(() => {
    runV3AdminGuard(router)
      .then((ok) => (ok ? load() : undefined))
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load system health'))
      .finally(() => setLoading(false));
  }, [router, load]);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center text-slate-500">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PortalPageHeader title="System Health" description="Unified health score across employees, numbers, devices, PBX, and softphone UX." />
      {error ? <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}

      {health ? (
        <>
          <div className="flex flex-wrap items-center gap-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <HealthDot level={health.overallLevel as HealthLevel} />
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500">Overall Health Score</p>
              <p className="text-3xl font-semibold text-slate-900">{health.overallScore}%</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {Object.entries(health.domains).map(([key, domain]) => (
              <MetricCard key={key} label={key} value={`${domain.score}%`} accent={domain.level === 'green' ? 'text-emerald-600' : domain.level === 'yellow' ? 'text-amber-600' : 'text-rose-600'} />
            ))}
          </div>

          <LineTrend title="Historical Trend (proxy)" data={health.historicalTrend} />

          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 px-4 py-2 text-sm font-medium text-slate-700">Department Health</div>
            <table className="min-w-full divide-y divide-slate-100 text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-2">Dept</th>
                  <th className="px-4 py-2">Employees</th>
                  <th className="px-4 py-2">Ready</th>
                  <th className="px-4 py-2">Warnings</th>
                  <th className="px-4 py-2">Errors</th>
                </tr>
              </thead>
              <tbody>
                {health.departmentHealth.map((dept) => (
                  <tr key={dept.department}>
                    <td className="px-4 py-2 font-medium">{dept.department}</td>
                    <td className="px-4 py-2">{dept.employeeCount}</td>
                    <td className="px-4 py-2">{dept.ready}</td>
                    <td className="px-4 py-2">{dept.warnings}</td>
                    <td className="px-4 py-2">{dept.errors}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {health.repairSuggestions.length > 0 ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
              <h3 className="text-sm font-semibold text-amber-900">Repair Suggestions</h3>
              <ul className="mt-2 space-y-1 text-sm text-amber-900">
                {health.repairSuggestions.slice(0, 10).map((s, i) => (
                  <li key={`${s.type}-${s.ref}-${i}`}>{s.type}: {s.detail} ({s.ref})</li>
                ))}
              </ul>
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
