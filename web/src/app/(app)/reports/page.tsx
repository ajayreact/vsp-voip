'use client';

import { useEffect, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { PortalPageHeader } from '@/components/portal/page-header';
import { StatCard } from '@/components/stat-card';
import { getCalls } from '@/lib/api';
import { loadPortalDashboardSnapshot } from '@/lib/portal-dashboard';

type Period = 'daily' | 'weekly' | 'monthly';

function filterCallsByPeriod(
  calls: Awaited<ReturnType<typeof getCalls>>['calls'],
  period: Period,
) {
  const now = Date.now();
  const ms = period === 'daily' ? 86400000 : period === 'weekly' ? 604800000 : 2592000000;
  return (calls || []).filter((call) => now - new Date(call.createdAt).getTime() <= ms);
}

export default function ReportsPage() {
  const [period, setPeriod] = useState<Period>('weekly');
  const [loading, setLoading] = useState(true);
  const [snapshot, setSnapshot] = useState<Awaited<ReturnType<typeof loadPortalDashboardSnapshot>> | null>(null);
  const [calls, setCalls] = useState<Awaited<ReturnType<typeof getCalls>>['calls']>([]);

  useEffect(() => {
    Promise.all([loadPortalDashboardSnapshot(true), getCalls(200)])
      .then(([dash, callsRes]) => {
        setSnapshot(dash);
        setCalls(callsRes.calls || []);
      })
      .finally(() => setLoading(false));
  }, []);

  const periodCalls = useMemo(() => filterCallsByPeriod(calls, period), [calls, period]);

  const periodStats = useMemo(() => {
    const inbound = periodCalls.filter((c) => c.direction === 'inbound').length;
    const outbound = periodCalls.filter((c) => c.direction === 'outbound').length;
    const answered = periodCalls.filter((c) =>
      ['answered', 'completed', 'connected'].includes(String(c.status).toLowerCase()),
    ).length;
    const missed = periodCalls.filter((c) =>
      ['no-answer', 'busy', 'failed', 'canceled', 'cancelled'].includes(String(c.status).toLowerCase()),
    ).length;
    return { inbound, outbound, answered, missed };
  }, [periodCalls]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-slate-400">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        Loading reports…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PortalPageHeader
        title="Reports"
        description="Dashboard statistics and call activity summary. Read-only — no telephony controls."
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
        <StatCard label="Registered extensions" value={snapshot?.onlineExtensions ?? '—'} accent="green" />
        <StatCard label="Active employees" value={snapshot?.activeEmployees ?? '—'} accent="blue" />
        <StatCard label="Phone numbers" value={snapshot?.phoneNumbers ?? '—'} accent="orange" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label={`Inbound (${period})`} value={periodStats.inbound} accent="blue" />
        <StatCard label={`Outbound (${period})`} value={periodStats.outbound} accent="green" />
        <StatCard label={`Answered (${period})`} value={periodStats.answered} accent="indigo" />
        <StatCard label={`Missed (${period})`} value={periodStats.missed} accent="orange" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Extensions" value={snapshot?.extensions ?? '—'} accent="indigo" />
        <StatCard label="Registered devices" value={snapshot?.registeredDevices ?? '—'} accent="green" />
        <StatCard label="Ring groups" value={snapshot?.ringGroups ?? '—'} accent="blue" />
        <StatCard label="Unread voicemail" value={snapshot?.unreadVoicemail ?? '—'} accent="orange" />
      </div>
    </div>
  );
}
