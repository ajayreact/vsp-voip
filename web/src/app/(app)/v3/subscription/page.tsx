'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { PortalPageHeader } from '@/components/portal/page-header';
import { MetricCard, runV3AdminGuard } from '@/components/v3/ops/ops-ui';
import { getV3Subscription, updateV3Subscription, type V3SubscriptionOverview } from '@/lib/v3-api';

export default function V3SubscriptionPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [sub, setSub] = useState<V3SubscriptionOverview | null>(null);

  const load = useCallback(async () => {
    const res = await getV3Subscription();
    setSub(res.subscription);
  }, []);

  useEffect(() => {
    runV3AdminGuard(router).then((ok) => (ok ? load() : undefined))
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load subscription'))
      .finally(() => setLoading(false));
  }, [router, load]);

  async function changeTier(tier: string) {
    setSaving(true);
    setError('');
    try {
      const res = await updateV3Subscription({ tier });
      setSub(res.subscription);
      setMessage(`Plan updated to ${tier}.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Update failed');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="flex h-64 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  const plan = sub?.currentPlan || {};
  const limits = sub?.limits || {};
  const usage = sub?.usage || {};

  return (
    <div className="space-y-6">
      <PortalPageHeader title="Subscription" description="Manage tenant plan limits — configuration only, reuses existing billing data." />
      {error ? <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}
      {message ? <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{message}</div> : null}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <MetricCard label="Current Plan" value={plan.label || plan.tier || '—'} />
        <MetricCard label="Seats" value={`${usage.seats}/${limits.seats}`} />
        <MetricCard label="Numbers" value={`${usage.numbers}/${limits.numbers}`} />
        <MetricCard label="Renewal" value={plan.renewalDate ? new Date(plan.renewalDate).toLocaleDateString() : '—'} />
      </div>
      <div className="flex flex-wrap gap-2">
        {(sub?.availableTiers || []).map((t) => (
          <button key={t.tier} type="button" disabled={saving || plan.tier === t.tier} onClick={() => changeTier(t.tier)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium hover:bg-slate-50 disabled:opacity-60">
            {plan.tier === t.tier ? `${t.label} (current)` : `Switch to ${t.label}`}
          </button>
        ))}
      </div>
      <FeatureMatrix matrix={sub?.featureMatrix || {}} />
    </div>
  );
}

function FeatureMatrix({ matrix }: { matrix: Record<string, boolean> }) {
  const entries = Object.entries(matrix);
  if (!entries.length) return null;
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="mb-3 text-sm font-semibold text-slate-900">Feature Matrix</h3>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 text-sm">
        {entries.map(([key, enabled]) => (
          <div key={key} className="flex items-center gap-2">
            <span className={`h-2 w-2 rounded-full ${enabled ? 'bg-emerald-500' : 'bg-slate-300'}`} />
            <span className="capitalize">{key.replace(/([A-Z])/g, ' $1')}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
