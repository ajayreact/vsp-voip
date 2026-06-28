'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { PortalPageHeader } from '@/components/portal/page-header';
import { StatCard } from '@/components/stat-card';
import { getCalls, getExtensionStats, getExtensions } from '@/lib/api';
import { loadPortalDashboardSnapshot } from '@/lib/portal-dashboard';

type Period = 'daily' | 'weekly' | 'monthly';

function filterCallsByPeriod(calls: Awaited<ReturnType<typeof getCalls>>['calls'], period: Period) {
  const now = Date.now();
  const ms =
    period === 'daily' ? 86400000 : period === 'weekly' ? 604800000 : 2592000000;
  return (calls || []).filter((call) => now - new Date(call.createdAt).getTime() <= ms);
}

export default function ReportsPage() {
  const [period, setPeriod] = useState<Period>('weekly');
  const [loading, setLoading] = useState(true);
  const [snapshot, setSnapshot] = useState<Awaited<ReturnType<typeof loadPortalDashboardSnapshot>> | null>(null);
  const [periodCalls, setPeriodCalls] = useState<ReturnType<typeof filterCallsByPeriod>>([]);
  const [extensionStats, setExtensionStats] = useState<{ id: string; number: string; name: string; inbound: number; outbound: number }[]>([]);

  useEffect(() => {
    Promise.all([
      loadPortalDashboardSnapshot(true),
      getCalls(200),
      getExtensions(),
      getExtensionStats(),
    ])
      .then(async ([dash, callsRes, extRes]) => {
        setSnapshot(dash);
        setPeriodCalls(filterCallsByPeriod(callsRes.calls, period));

        const stats = await Promise.all(
          (extRes.extensions || []).slice(0, 20).map(async (ext) => {
            const inbound = (callsRes.calls || []).filter(
              (c) => c.to?.includes(ext.extensionNumber) || c.direction === 'inbound',
            ).length;
            const outbound = (callsRes.calls || []).filter(
              (c) => c.from?.includes(ext.extensionNumber) || c.direction === 'outbound',
            ).length;
            return {
              id: ext.id,
              number: ext.extensionNumber,
              name: ext.displayName,
              inbound: Math.min(inbound, 999),
              outbound: Math.min(outbound, 999),
            };
          }),
        );
        setExtensionStats(stats);
      })
      .finally(() => setLoading(false));
  }, [period]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-slate-400">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        Loading reports…
      </div>
    );
  }

  const inbound = periodCalls.filter((c) => c.direction === 'inbound').length;
  const outbound = periodCalls.filter((c) => c.direction === 'outbound').length;

  return (
    <div className="space-y-6">
      <PortalPageHeader
        title="Reports"
        description="Call activity and extension usage. Read-only — no browser calling."
        actions={
          <div className="flex gap-2">
            {(['daily', 'weekly', 'monthly'] as Period[]).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPeriod(p)}
                className={period === p ? 'filter-btn filter-btn-active' : 'filter-btn'}
              >
                {p.charAt(0).toUpperCase() + p.slice(1)}
              </button>
            ))}
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total calls (all time)" value={snapshot?.totalCalls ?? '—'} accent="indigo" />
        <StatCard label={`Inbound (${period})`} value={inbound} accent="blue" />
        <StatCard label={`Outbound (${period})`} value={outbound} accent="green" />
        <StatCard label="Registered extensions" value={snapshot?.onlineExtensions ?? '—'} accent="orange" />
      </div>

      <div className="panel-card p-5">
        <h2 className="section-title">Employee & extension statistics</h2>
        <p className="mt-1 text-sm text-slate-500">
          Detailed per-extension analytics are available on each{' '}
          <Link href="/extensions" className="text-indigo-600 hover:text-indigo-700">
            extension
          </Link>
          .
        </p>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase text-slate-500">
                <th className="pb-2 pr-4">Extension</th>
                <th className="pb-2 pr-4">Name</th>
                <th className="pb-2 pr-4">Recent inbound</th>
                <th className="pb-2">Recent outbound</th>
              </tr>
            </thead>
            <tbody>
              {extensionStats.map((row) => (
                <tr key={row.id} className="border-b border-slate-100">
                  <td className="py-2 pr-4 font-medium">{row.number}</td>
                  <td className="py-2 pr-4">{row.name}</td>
                  <td className="py-2 pr-4">{row.inbound}</td>
                  <td className="py-2">{row.outbound}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
