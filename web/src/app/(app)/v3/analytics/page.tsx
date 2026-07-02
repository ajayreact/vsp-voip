'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { PortalPageHeader } from '@/components/portal/page-header';
import { BarChart, LineTrend, MetricCard, runV3AdminGuard } from '@/components/v3/ops/ops-ui';
import { getV3Analytics, type DashboardCharts } from '@/lib/v3-api';

export default function V3AnalyticsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [charts, setCharts] = useState<DashboardCharts | null>(null);

  const load = useCallback(async () => {
    const res = await getV3Analytics();
    setCharts(res.analytics.charts);
  }, []);

  useEffect(() => {
    runV3AdminGuard(router)
      .then((ok) => (ok ? load() : undefined))
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load analytics'))
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
      <PortalPageHeader title="Analytics" description="Read-only charts derived from tenant database records." />
      {error ? <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}

      {charts ? (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            {Object.entries(charts.healthScore).map(([key, value]) => (
              <MetricCard key={key} label={key.replace(/([A-Z])/g, ' $1')} value={value} />
            ))}
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <LineTrend title="Employee Growth" data={charts.employeeGrowth.map((p) => ({ label: p.label, employeeCount: p.cumulative }))} />
            <LineTrend title="Extension Growth" data={charts.extensionGrowth.map((p) => ({ label: p.label, employeeCount: p.cumulative }))} />
            <BarChart title="Device Types" data={charts.deviceTypes} />
            <BarChart title="Vendor Distribution" data={charts.vendorDistribution} />
            <BarChart title="Phone Model Distribution" data={charts.phoneModelDistribution} />
            <BarChart title="DID Usage" data={charts.didUsage} />
            <BarChart title="Provisioning Success" data={charts.provisioningSuccess} />
            <BarChart title="Presence Distribution" data={charts.presenceDistribution} />
            <BarChart title="Department Distribution" data={charts.departmentDistribution} />
          </div>
        </>
      ) : null}
    </div>
  );
}
