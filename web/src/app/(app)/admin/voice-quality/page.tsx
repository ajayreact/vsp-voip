'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Gauge, Loader2, PhoneCall, Radio, TrendingDown } from 'lucide-react';
import { DataTable } from '@/components/data-table';
import { KpiCard, KpiSection } from '@/components/kpi-card';
import { getAdminVoiceQuality, getMe, isUnauthorizedError, type VoiceQualityReport } from '@/lib/api';

function VolumeBars({ items, labelKey }: { items: { [key: string]: string | number }[]; labelKey: string }) {
  const max = Math.max(1, ...items.map((item) => Number(item.count) || 0));
  return (
    <div className="flex h-40 items-end gap-1.5">
      {items.map((item) => {
        const count = Number(item.count) || 0;
        const height = `${Math.max(8, Math.round((count / max) * 100))}%`;
        return (
          <div key={String(item[labelKey])} className="flex min-w-0 flex-1 flex-col items-center gap-2">
            <div
              className="w-full rounded-t-md bg-indigo-500/80 transition-all"
              style={{ height }}
              title={`${count} calls`}
            />
            <span className="truncate text-[10px] text-slate-500">{String(item[labelKey])}</span>
          </div>
        );
      })}
    </div>
  );
}

export default function AdminVoiceQualityPage() {
  const router = useRouter();
  const [report, setReport] = useState<VoiceQualityReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    getMe()
      .then((user) => {
        if (user.role !== 'SUPER_ADMIN') {
          router.replace('/dashboard');
          return;
        }
        return getAdminVoiceQuality();
      })
      .then((res) => {
        if (res) setReport(res.report);
      })
      .catch((err) => {
        if (isUnauthorizedError(err)) router.replace('/login');
        else setError(err instanceof Error ? err.message : 'Could not load voice quality report');
      })
      .finally(() => setLoading(false));
  }, [router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-slate-400">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        Loading voice quality…
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className="mx-auto max-w-lg rounded-xl border border-red-200 bg-red-50 p-6 text-center">
        <p className="font-medium text-red-700">Voice quality unavailable</p>
        <p className="mt-2 text-sm text-slate-600">{error || 'No data'}</p>
      </div>
    );
  }

  const mosWarn = report.summary.averageMos != null && report.summary.averageMos < 4;

  return (
    <div className="space-y-8">
      <div>
        <Link href="/admin" className="mb-2 inline-flex items-center gap-1 text-sm text-slate-400 hover:text-slate-900">
          <ArrowLeft className="h-4 w-4" />
          Platform overview
        </Link>
        <h2 className="page-title">Voice quality & heatmaps</h2>
        <p className="page-subtitle">
          Call volume, failure rates, and estimated MOS from platform call logs (last 24 hours).
        </p>
      </div>

      <KpiSection title="Voice health" description="Live metrics derived from CallLog records across all tenants.">
        <KpiCard
          title="Estimated average MOS"
          value={report.summary.averageMos != null ? report.summary.averageMos.toFixed(1) : '—'}
          subtitle={
            report.summary.averageMosSamples
              ? `${report.summary.averageMosSamples} Telnyx call samples (24h)`
              : report.summary.averageMosSource === 'call_log_estimate'
                ? 'Estimated from call failure rate until hangup samples arrive'
                : 'Connect Telnyx and complete calls for MOS telemetry'
          }
          trend={
            report.summary.averageMos != null
              ? { label: mosWarn ? 'Below 4.0 — review routing' : 'Voice quality healthy', positive: !mosWarn }
              : undefined
          }
          icon={Gauge}
          tone={mosWarn ? 'amber' : 'emerald'}
        />
        <KpiCard
          title="Calls (24h)"
          value={report.summary.callsLast24h}
          subtitle={`${report.summary.answeredRate ?? 0}% answered · avg ${report.summary.avgDurationSeconds}s`}
          icon={PhoneCall}
          tone="sky"
        />
        <KpiCard
          title="Failure rate"
          value={`${report.summary.failedRate}%`}
          subtitle="Busy, no-answer, failed, or cancelled"
          trend={{ label: `${report.summary.activeConcurrent} active now`, positive: report.summary.failedRate < 10 }}
          icon={TrendingDown}
          tone={report.summary.failedRate > 15 ? 'rose' : 'indigo'}
        />
      </KpiSection>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="panel-card p-5">
          <div className="mb-4 flex items-center gap-2">
            <Radio className="h-4 w-4 text-indigo-600" />
            <h3 className="font-medium text-slate-900">Hourly call volume (24h)</h3>
          </div>
          <VolumeBars items={report.hourlyVolume} labelKey="hour" />
        </div>
        <div className="panel-card p-5">
          <div className="mb-4 flex items-center gap-2">
            <Radio className="h-4 w-4 text-indigo-600" />
            <h3 className="font-medium text-slate-900">Daily call volume (7d)</h3>
          </div>
          <VolumeBars items={report.dailyVolume} labelKey="day" />
        </div>
      </div>

      <DataTable
        title="Per-tenant breakdown (24h)"
        data={report.tenantBreakdown}
        getRowId={(row) => row.tenantId || row.tenantName}
        emptyMessage="No calls logged in the last 24 hours"
        columns={[
          { key: 'tenantName', header: 'Tenant', sortable: true },
          { key: 'calls', header: 'Calls', sortable: true },
          { key: 'failed', header: 'Failed', sortable: true },
          {
            key: 'failedRate',
            header: 'Fail %',
            sortable: true,
            render: (row) => `${row.failedRate}%`,
          },
          {
            key: 'avgDurationSeconds',
            header: 'Avg duration',
            sortable: true,
            render: (row) => `${row.avgDurationSeconds}s`,
          },
        ]}
      />

      <DataTable
        title="Telnyx MOS samples (24h)"
        data={report.telemetrySamples || []}
        getRowId={(row) => row.id}
        emptyMessage="No Telnyx call.hangup quality samples yet — complete calls via Call Control or credential connection."
        columns={[
          {
            key: 'occurredAt',
            header: 'Time',
            sortable: true,
            render: (row) => new Date(row.occurredAt).toLocaleString(),
          },
          { key: 'tenantName', header: 'Tenant', sortable: true },
          { key: 'from', header: 'From', sortable: true },
          { key: 'to', header: 'To', sortable: true },
          {
            key: 'mosInbound',
            header: 'MOS in',
            sortable: true,
            render: (row) => (row.mosInbound != null ? row.mosInbound.toFixed(2) : '—'),
          },
          {
            key: 'mosOutbound',
            header: 'MOS out',
            sortable: true,
            render: (row) => (row.mosOutbound != null ? row.mosOutbound.toFixed(2) : '—'),
          },
          {
            key: 'jitterMaxVariance',
            header: 'Jitter',
            sortable: true,
            render: (row) => (row.jitterMaxVariance != null ? row.jitterMaxVariance.toFixed(2) : '—'),
          },
          {
            key: 'packetLoss',
            header: 'Loss %',
            sortable: true,
            render: (row) => (row.packetLoss != null ? `${row.packetLoss}%` : '—'),
          },
        ]}
      />

      <DataTable
        title="Recent problem calls"
        data={report.recentIssues}
        getRowId={(row) => row.callSid}
        emptyMessage="No failed calls in the last 24 hours"
        columns={[
          {
            key: 'createdAt',
            header: 'Time',
            sortable: true,
            render: (row) => new Date(row.createdAt).toLocaleString(),
          },
          { key: 'tenantName', header: 'Tenant', sortable: true },
          { key: 'from', header: 'From', sortable: true },
          { key: 'to', header: 'To', sortable: true },
          {
            key: 'status',
            header: 'Status',
            sortable: true,
            render: (row) => <span className="capitalize text-rose-700">{row.status}</span>,
          },
        ]}
      />
    </div>
  );
}
