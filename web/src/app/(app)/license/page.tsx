'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { PortalPageHeader } from '@/components/portal/page-header';
import { HealthDot, MetricCard, runV3AdminGuard } from '@/components/v3/ops/ops-ui';
import { getV3License, type HealthLevel, type V3LicenseOverview } from '@/lib/v3-api';

export default function LicensePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [license, setLicense] = useState<V3LicenseOverview | null>(null);

  useEffect(() => {
    runV3AdminGuard(router).then((ok) => (ok ? getV3License().then((r) => setLicense(r.license)) : undefined))
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load license'))
      .finally(() => setLoading(false));
  }, [router]);

  if (loading) return <div className="flex h-64 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  const health = license?.health || {};
  const util = license?.utilization || {};

  return (
    <div className="space-y-6">
      <PortalPageHeader title="License" description="Seat, number, and extension limits with expiration warnings." />
      {error ? <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <MetricCard label="Seat Utilization" value={`${util.seats ?? 0}%`} />
        <MetricCard label="Number Utilization" value={`${util.numbers ?? 0}%`} />
        <MetricCard label="Extension Utilization" value={`${util.extensions ?? 0}%`} />
        <MetricCard label="Warnings" value={license?.warnings?.length ?? 0} accent={(license?.warnings?.length ?? 0) ? 'text-amber-600' : undefined} />
      </div>
      <div className="flex flex-wrap gap-4 text-sm">
        {Object.entries(health).map(([key, level]) => (
          <span key={key} className="inline-flex items-center gap-2 capitalize">
            <HealthDot level={level as HealthLevel} /> {key}
          </span>
        ))}
      </div>
      {(license?.warnings || []).map((w) => (
        <div key={w.code} className={`flex items-start gap-2 rounded-lg border p-3 text-sm ${w.severity === 'error' ? 'border-rose-200 bg-rose-50 text-rose-800' : 'border-amber-200 bg-amber-50 text-amber-900'}`}>
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          {w.message}
        </div>
      ))}
    </div>
  );
}
