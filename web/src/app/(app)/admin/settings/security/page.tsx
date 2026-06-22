'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Lock, Shield, Users } from 'lucide-react';
import { DataTable } from '@/components/data-table';
import { KpiCard, KpiSection } from '@/components/kpi-card';
import { AdminPageHeader } from '@/components/admin-page-header';
import { AdminSectionNav, adminSettingsTabs } from '@/components/admin-section-nav';
import { getAdminSecurity, getMe, isUnauthorizedError, type SecurityReport } from '@/lib/api';

function Check({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${ok ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
      {ok ? '✓' : '○'} {label}
    </span>
  );
}

export default function AdminSettingsSecurityPage() {
  const router = useRouter();
  const [report, setReport] = useState<SecurityReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    getMe()
      .then((user) => {
        if (user.role !== 'SUPER_ADMIN') {
          router.replace('/dashboard');
          return;
        }
        return getAdminSecurity();
      })
      .then((res) => {
        if (res) setReport(res.report);
      })
      .catch((err) => {
        if (isUnauthorizedError(err)) router.replace('/login');
        else setError(err instanceof Error ? err.message : 'Could not load security report');
      })
      .finally(() => setLoading(false));
  }, [router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-slate-400">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        Loading security…
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className="mx-auto max-w-lg rounded-xl border border-red-200 bg-red-50 p-6 text-center">
        <p className="font-medium text-red-700">Security report unavailable</p>
        <p className="mt-2 text-sm text-slate-600">{error || 'No data'}</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <AdminPageHeader
        section="Settings"
        title="Security & compliance"
        subtitle="Role-based access and per-tenant voice compliance checklist."
      />
      <AdminSectionNav tabs={adminSettingsTabs} />

      <KpiSection title="Access control">
        <KpiCard title="Total users" value={report.summary.totalUsers} icon={Users} tone="indigo" />
        <KpiCard title="Super admins" value={report.summary.superAdmins} icon={Shield} tone="violet" />
        <KpiCard
          title="Tenants below 60% compliance"
          value={report.summary.tenantsBelowCompliance}
          icon={Lock}
          tone={report.summary.tenantsBelowCompliance ? 'amber' : 'emerald'}
        />
      </KpiSection>

      <DataTable
        title="Tenant compliance checklist"
        data={report.tenantCompliance}
        getRowId={(t) => t.tenantId}
        defaultPageSize={10}
        columns={[
          { key: 'tenantName', header: 'Tenant', sortable: true },
          {
            key: 'complianceScore',
            header: 'Score',
            sortable: true,
            render: (t) => (
              <span className={t.complianceScore >= 60 ? 'text-emerald-700' : 'text-amber-700'}>
                {t.complianceScore}%
              </span>
            ),
          },
          {
            key: 'checks',
            header: 'Checks',
            searchable: false,
            sortable: false,
            render: (t) => (
              <div className="flex flex-wrap gap-1">
                <Check ok={t.checks.callRecordingNotice} label="Recording notice" />
                <Check ok={t.checks.voicemailEnabled} label="Voicemail" />
                <Check ok={t.checks.hasRouting} label="Routing" />
              </div>
            ),
          },
        ]}
      />
    </div>
  );
}
