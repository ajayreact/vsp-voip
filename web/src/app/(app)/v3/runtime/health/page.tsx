'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { PortalPageHeader } from '@/components/portal/page-header';
import { HealthDot, runV3AdminGuard } from '@/components/v3/ops/ops-ui';
import { getV3RuntimeHealth, type HealthLevel, type V3RuntimeHealth } from '@/lib/v3-api';

export default function V3RuntimeHealthPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [health, setHealth] = useState<V3RuntimeHealth | null>(null);

  const load = useCallback(async () => {
    const res = await getV3RuntimeHealth();
    setHealth(res.health);
  }, []);

  useEffect(() => {
    runV3AdminGuard(router)
      .then((ok) => (ok ? load() : undefined))
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load runtime health'))
      .finally(() => setLoading(false));
  }, [router, load]);

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
      <PortalPageHeader title="Runtime Health" description="Per-domain sync status between V3 configuration and the production telephony engine." />
      {error ? <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}

      <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <HealthDot level={(health?.overall || 'yellow') as HealthLevel} />
        <div>
          <p className="font-medium text-slate-900">Overall Runtime Health</p>
          <p className="text-sm text-slate-600">{health?.enabled ? 'Sync enabled for tenant' : 'Sync disabled — enable V3_RUNTIME_SYNC_ENABLED to activate'}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {Object.entries(domains).map(([key, level]) => (
          <div key={key} className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
            <div className="flex items-center gap-2">
              <HealthDot level={level as HealthLevel} />
              <span className="text-sm capitalize text-slate-700">{key.replace(/([A-Z])/g, ' $1')}</span>
            </div>
          </div>
        ))}
      </div>

      {(health?.details || []).map((domain) => (
        <div key={domain.entityType} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-semibold capitalize text-slate-900">{domain.entityType.replace(/_/g, ' ')}</h3>
            <HealthDot level={domain.level as HealthLevel} />
          </div>
          <p className="text-xs text-slate-500">
            {domain.synced}/{domain.total} synced · {domain.warnings} warnings · {domain.errors} errors
          </p>
        </div>
      ))}
    </div>
  );
}
