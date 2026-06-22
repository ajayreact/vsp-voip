'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Gauge, Loader2, PhoneCall, Radio, TrendingDown } from 'lucide-react';
import { DataTable } from '@/components/data-table';
import { KpiCard, KpiSection } from '@/components/kpi-card';
import { AdminPageHeader } from '@/components/admin-page-header';
import { AdminSectionNav, adminMonitoringTabs } from '@/components/admin-section-nav';
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
            <div className="w-full rounded-t-md bg-indigo-500/80 transition-all" style={{ height }} title={`${count} calls`} />
            <span className="truncate text-[10px] text-slate-500">{String(item[labelKey])}</span>
          </div>
        );
      })}
    </div>
  );
}

export default function AdminMonitoringQualityPage() {
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
        else setError(err instanceof Error ? err.message : 'Could not load voice quality');
      })
      .finally(() => setLoading(false));
  }, [router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-slate-400">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        Loading call quality…
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className="mx-auto max-w-lg rounded-xl border border-red-200 bg-red-50 p-6 text-center">
        <p className="font-medium text-red-700">Call quality unavailable</p>
        <p className="mt-2 text-sm text-slate-600">{error || 'No data'}</p>
      </div>
    );
  }

  const mosWarn = report.summary.averageMos != null && report.summary.averageMos < 4;

  return (
    <div className="space-y-8">
      <AdminPageHeader section="Monitoring" title="Call quality" subtitle="MOS, volume, and failure rates (24h)." />
      <AdminSectionNav tabs={adminMonitoringTabs} />

      <KpiSection title="Voice health">
        <KpiCard
          title="Average MOS"
          value={report.summary.averageMos != null ? report.summary.averageMos.toFixed(1) : '—'}
          trend={
            report.summary.averageMos != null
              ? { label: mosWarn ? 'Below 4.0' : 'Healthy', positive: !mosWarn }
              : undefined
          }
          icon={Gauge}
          tone={mosWarn ? 'amber' : 'emerald'}
        />
        <KpiCard title="Calls (24h)" value={report.summary.callsLast24h} icon={PhoneCall} tone="sky" />
        <KpiCard title="Failure rate" value={`${report.summary.failedRate}%`} icon={TrendingDown} tone="indigo" />
      </KpiSection>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="panel-card p-5">
          <h3 className="mb-4 flex items-center gap-2 font-medium text-slate-900">
            <Radio className="h-4 w-4 text-indigo-600" />
            Hourly volume
          </h3>
          <VolumeBars items={report.hourlyVolume} labelKey="hour" />
        </div>
        <div className="panel-card p-5">
          <h3 className="mb-4 flex items-center gap-2 font-medium text-slate-900">
            <Radio className="h-4 w-4 text-indigo-600" />
            Daily volume (7d)
          </h3>
          <VolumeBars items={report.dailyVolume} labelKey="day" />
        </div>
      </div>

      <DataTable
        title="Per-tenant breakdown"
        data={report.tenantBreakdown}
        getRowId={(row) => row.tenantId || row.tenantName}
        columns={[
          { key: 'tenantName', header: 'Tenant', sortable: true },
          { key: 'calls', header: 'Calls', sortable: true },
          { key: 'failedRate', header: 'Fail %', render: (r) => `${r.failedRate}%` },
        ]}
      />

      <Link href="/admin/operations" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900">
        <ArrowLeft className="h-4 w-4" />
        Live operations
      </Link>
    </div>
  );
}
