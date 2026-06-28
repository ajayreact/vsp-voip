'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { DataTable, type DataTableColumn } from '@/components/data-table';
import { PortalPageHeader } from '@/components/portal/page-header';
import { StatCard } from '@/components/stat-card';
import {
  getCalls,
  getExtensionAnalytics,
  getExtensions,
  getMe,
  getTenantUsers,
} from '@/lib/api';
import { loadPortalDashboardSnapshot } from '@/lib/portal-dashboard';

function filterCallsByPeriod(
  calls: Awaited<ReturnType<typeof getCalls>>['calls'],
  ms: number,
) {
  const now = Date.now();
  return (calls || []).filter((call) => now - new Date(call.createdAt).getTime() <= ms);
}

function averageDurationSeconds(calls: Awaited<ReturnType<typeof getCalls>>['calls']) {
  const withDuration = (calls || []).filter(
    (c) => c.durationSeconds != null && c.durationSeconds > 0,
  );
  if (!withDuration.length) return 0;
  const total = withDuration.reduce((sum, c) => sum + (c.durationSeconds || 0), 0);
  return Math.round(total / withDuration.length);
}

function formatAvgDuration(seconds: number) {
  if (!seconds) return '—';
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
}

type ExtensionActivityRow = {
  id: string;
  extensionNumber: string;
  name: string;
  inbound: number;
  outbound: number;
  missed: number;
  avgDuration: number;
};

type EmployeeActivityRow = {
  id: string;
  name: string;
  email: string;
  extensionNumber: string;
  callCount: number;
};

export default function ReportsPage() {
  const [loading, setLoading] = useState(true);
  const [snapshot, setSnapshot] = useState<Awaited<ReturnType<typeof loadPortalDashboardSnapshot>> | null>(null);
  const [calls, setCalls] = useState<Awaited<ReturnType<typeof getCalls>>['calls']>([]);
  const [extensionActivity, setExtensionActivity] = useState<ExtensionActivityRow[]>([]);
  const [employeeActivity, setEmployeeActivity] = useState<EmployeeActivityRow[]>([]);

  useEffect(() => {
    Promise.all([
      getMe().then((u) => loadPortalDashboardSnapshot(u.role === 'TENANT_ADMIN' || u.role === 'SUPER_ADMIN')),
      getCalls(500),
      getExtensions(),
      getTenantUsers().catch(() => ({ users: [] })),
    ])
      .then(async ([dash, callsRes, extRes, usersRes]) => {
        setSnapshot(dash);
        setCalls(callsRes.calls || []);

        const extensions = (extRes.extensions || []).slice(0, 25);
        const analytics = await Promise.all(
          extensions.map(async (ext) => {
            try {
              const res = await getExtensionAnalytics(ext.id);
              return {
                id: ext.id,
                extensionNumber: ext.extensionNumber,
                name: ext.displayName,
                inbound: res.analytics.inboundCalls,
                outbound: res.analytics.outboundCalls,
                missed: res.analytics.missedCalls,
                avgDuration: res.analytics.averageDurationSeconds,
              };
            } catch {
              return {
                id: ext.id,
                extensionNumber: ext.extensionNumber,
                name: ext.displayName,
                inbound: 0,
                outbound: 0,
                missed: 0,
                avgDuration: 0,
              };
            }
          }),
        );
        setExtensionActivity(analytics);

        const extByUser = new Map(
          (extRes.extensions || [])
            .filter((e) => e.userId)
            .map((e) => [e.userId!, e]),
        );
        setEmployeeActivity(
          (usersRes.users || []).map((user) => {
            const ext = extByUser.get(user.id);
            const related = analytics.find((a) => a.id === ext?.id);
            const callCount = related
              ? related.inbound + related.outbound
              : 0;
            return {
              id: user.id,
              name: user.name,
              email: user.email,
              extensionNumber: ext?.extensionNumber || '—',
              callCount,
            };
          }),
        );
      })
      .finally(() => setLoading(false));
  }, []);

  const dailyCalls = useMemo(() => filterCallsByPeriod(calls, 86400000), [calls]);
  const weeklyCalls = useMemo(() => filterCallsByPeriod(calls, 604800000), [calls]);
  const monthlyCalls = useMemo(() => filterCallsByPeriod(calls, 2592000000), [calls]);

  const periodStats = useMemo(() => {
    const answered = monthlyCalls.filter((c) =>
      ['answered', 'completed', 'connected'].includes(String(c.status).toLowerCase()),
    ).length;
    const missed = monthlyCalls.filter((c) =>
      ['no-answer', 'busy', 'failed', 'canceled', 'cancelled'].includes(String(c.status).toLowerCase()),
    ).length;
    return {
      answered,
      missed,
      avgDuration: averageDurationSeconds(monthlyCalls),
    };
  }, [monthlyCalls]);

  const extColumns: DataTableColumn<ExtensionActivityRow>[] = [
    { key: 'extensionNumber', header: 'Extension', sortable: true, sortValue: (r) => Number(r.extensionNumber) },
    { key: 'name', header: 'Name', sortable: true },
    { key: 'inbound', header: 'Inbound', sortable: true },
    { key: 'outbound', header: 'Outbound', sortable: true },
    { key: 'missed', header: 'Missed', sortable: true },
    {
      key: 'avgDuration',
      header: 'Avg duration',
      sortable: true,
      render: (r) => formatAvgDuration(r.avgDuration),
    },
  ];

  const empColumns: DataTableColumn<EmployeeActivityRow>[] = [
    { key: 'name', header: 'Employee', sortable: true },
    { key: 'extensionNumber', header: 'Extension', sortable: true },
    { key: 'callCount', header: 'Call activity', sortable: true },
    {
      key: 'email',
      header: 'Email',
      sortable: true,
      headerClassName: 'hidden md:table-cell',
      className: 'hidden md:table-cell text-slate-500',
    },
  ];

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
        description="Dashboard analytics and activity summaries. Read-only — no telephony controls."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Daily calls" value={dailyCalls.length} accent="indigo" />
        <StatCard label="Weekly calls" value={weeklyCalls.length} accent="blue" />
        <StatCard label="Monthly calls" value={monthlyCalls.length} accent="green" />
        <StatCard label="Average duration (monthly)" value={formatAvgDuration(periodStats.avgDuration)} accent="orange" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Answered calls (monthly)" value={periodStats.answered} accent="green" />
        <StatCard label="Missed calls (monthly)" value={periodStats.missed} accent="orange" />
        <StatCard label="Registered extensions" value={snapshot?.onlineExtensions ?? '—'} accent="indigo" />
        <StatCard label="Total calls (all time)" value={snapshot?.totalCalls ?? '—'} accent="blue" />
      </div>

      <DataTable
        title="Extension activity"
        data={extensionActivity}
        getRowId={(row) => row.id}
        emptyMessage="No extension analytics yet."
        columns={extColumns}
      />

      <DataTable
        title="Employee activity"
        data={employeeActivity}
        getRowId={(row) => row.id}
        emptyMessage="No employees configured."
        columns={empColumns}
      />

      <p className="text-sm text-slate-500">
        Per-extension detail is available on each{' '}
        <Link href="/extensions" className="text-indigo-600 hover:text-indigo-700">
          extension
        </Link>
        . Call logs are in{' '}
        <Link href="/calls" className="text-indigo-600 hover:text-indigo-700">
          Call history
        </Link>
        .
      </p>
    </div>
  );
}
