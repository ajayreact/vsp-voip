'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, RefreshCw } from 'lucide-react';
import { PortalPageHeader } from '@/components/portal/page-header';
import { MetricCard, runV3AdminGuard } from '@/components/v3/ops/ops-ui';
import { getV3Dashboard, type DashboardCards } from '@/lib/v3-api';

const CARD_LABELS: Array<{ key: keyof DashboardCards; label: string }> = [
  { key: 'employees', label: 'Employees' },
  { key: 'extensions', label: 'Extensions' },
  { key: 'activeDevices', label: 'Active Devices' },
  { key: 'registeredDevices', label: 'Registered Devices' },
  { key: 'availableNumbers', label: 'Available Numbers' },
  { key: 'assignedNumbers', label: 'Assigned Numbers' },
  { key: 'deskPhones', label: 'Desk Phones' },
  { key: 'ringGroups', label: 'Ring Groups' },
  { key: 'queues', label: 'Queues' },
  { key: 'businessHours', label: 'Business Hours' },
  { key: 'holidays', label: 'Holidays' },
  { key: 'voicemailBoxes', label: 'Voicemail Boxes' },
  { key: 'callFlows', label: 'Call Flows' },
  { key: 'softphoneProfiles', label: 'Softphone Profiles' },
];

export default function V3DashboardPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [cards, setCards] = useState<DashboardCards | null>(null);
  const [healthIssues, setHealthIssues] = useState(0);
  const [repairTotal, setRepairTotal] = useState(0);
  const [healthScore, setHealthScore] = useState<number | null>(null);

  const load = useCallback(async () => {
    const res = await getV3Dashboard();
    setCards(res.dashboard.cards);
    setHealthIssues(res.dashboard.healthIssues.total);
    setRepairTotal(res.dashboard.repairRecommendations.total);
    setHealthScore(res.dashboard.charts?.healthScore?.overall ?? null);
  }, []);

  useEffect(() => {
    runV3AdminGuard(router)
      .then((ok) => (ok ? load() : undefined))
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load dashboard'))
      .finally(() => setLoading(false));
  }, [router, load]);

  async function onRefresh() {
    setRefreshing(true);
    setError('');
    try {
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Refresh failed');
    } finally {
      setRefreshing(false);
    }
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center text-slate-500">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PortalPageHeader
        title="Operations Dashboard"
        description="Tenant-wide inventory, health, and readiness — read-only, sourced from existing database records."
        actions={
          <button type="button" onClick={onRefresh} disabled={refreshing} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60">
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        }
      />

      {error ? <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-5">
        <MetricCard label="Health Score" value={healthScore ?? '—'} accent="text-emerald-600" />
        <MetricCard label="Health Issues" value={healthIssues} accent={healthIssues ? 'text-amber-600' : undefined} />
        <MetricCard label="Repair Recommendations" value={repairTotal} accent={repairTotal ? 'text-amber-600' : undefined} />
      </div>

      {cards ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {CARD_LABELS.map(({ key, label }) => (
            <MetricCard key={key} label={label} value={cards[key]} />
          ))}
        </div>
      ) : null}
    </div>
  );
}
