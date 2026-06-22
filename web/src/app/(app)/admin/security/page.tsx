'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Loader2, Lock, Shield, Users } from 'lucide-react';
import { DataTable } from '@/components/data-table';
import { KpiCard, KpiSection } from '@/components/kpi-card';
import { getAdminSecurity, getMe, isUnauthorizedError, type SecurityReport } from '@/lib/api';

function Check({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${ok ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
      {ok ? '✓' : '○'} {label}
    </span>
  );
}

export default function AdminSecurityPage() {
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
        Loading RBAC & compliance…
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
      <div>
        <Link href="/admin" className="mb-2 inline-flex items-center gap-1 text-sm text-slate-400 hover:text-slate-900">
          <ArrowLeft className="h-4 w-4" />
          Platform overview
        </Link>
        <h2 className="page-title">RBAC & compliance</h2>
        <p className="page-subtitle">
          Role-based access across the platform and per-tenant voice compliance checklist.
        </p>
      </div>

      <KpiSection title="Access control">
        <KpiCard title="Total users" value={report.summary.totalUsers} icon={Users} tone="indigo" />
        <KpiCard title="Super admins" value={report.summary.superAdmins} icon={Shield} tone="violet" />
        <KpiCard
          title="Tenants below 60% compliance"
          value={report.summary.tenantsBelowCompliance}
          subtitle="Review call recording & routing settings"
          icon={Lock}
          tone={report.summary.tenantsBelowCompliance ? 'amber' : 'emerald'}
        />
      </KpiSection>

      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { role: 'SUPER_ADMIN', label: 'Super admin', count: report.summary.superAdmins },
          { role: 'TENANT_ADMIN', label: 'Tenant admin', count: report.summary.tenantAdmins },
          { role: 'TENANT_USER', label: 'Tenant user', count: report.summary.tenantUsers },
        ].map(({ role, label, count }) => (
          <div key={role} className="panel-card p-4">
            <p className="text-sm text-slate-500">{label}</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">{count}</p>
            <p className="mt-1 text-xs uppercase tracking-wide text-slate-400">{role}</p>
          </div>
        ))}
      </div>

      <DataTable
        title="Platform users (RBAC)"
        data={report.users}
        getRowId={(u) => u.id}
        defaultPageSize={10}
        columns={[
          { key: 'name', header: 'Name', sortable: true },
          { key: 'email', header: 'Email', sortable: true },
          {
            key: 'role',
            header: 'Role',
            sortable: true,
            render: (u) => (
              <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-700">
                {u.role.replace(/_/g, ' ')}
              </span>
            ),
          },
          { key: 'tenantName', header: 'Organization', sortable: true },
          {
            key: 'createdAt',
            header: 'Created',
            sortable: true,
            render: (u) => new Date(u.createdAt).toLocaleDateString(),
          },
        ]}
      />

      <DataTable
        title="Tenant compliance checklist"
        data={report.tenantCompliance}
        getRowId={(t) => t.tenantId}
        defaultPageSize={10}
        columns={[
          {
            key: 'tenantName',
            header: 'Tenant',
            sortable: true,
            render: (t) => (
              <div>
                <p className="font-medium text-slate-900">{t.tenantName}</p>
                <p className="text-xs text-slate-500">
                  {t.userCount} users · {t.numberCount} numbers
                </p>
              </div>
            ),
          },
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
                <Check ok={t.checks.callRecordingEnabled} label="Recording" />
                <Check ok={t.checks.voicemailEnabled} label="Voicemail" />
                <Check ok={t.checks.businessHoursConfigured} label="Business hours" />
                <Check ok={t.checks.hasRouting} label="Routing" />
              </div>
            ),
          },
          {
            key: 'status',
            header: 'Status',
            sortable: true,
            sortValue: (t) => (t.isActive ? 'active' : 'suspended'),
            render: (t) => (t.isActive ? 'Active' : 'Suspended'),
          },
        ]}
      />
    </div>
  );
}
