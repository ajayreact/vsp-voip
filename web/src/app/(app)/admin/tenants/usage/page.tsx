'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Activity, AlertTriangle, DollarSign, Loader2 } from 'lucide-react';
import { DataTable } from '@/components/data-table';
import { KpiCard, KpiSection } from '@/components/kpi-card';
import { AdminPageHeader } from '@/components/admin-page-header';
import {
  getAdminTenantUsage,
  getMe,
  isUnauthorizedError,
  type UsageTenantRow,
} from '@/lib/api';
import { formatPrice } from '@/lib/pricing';

function UsageBar({ percent }: { percent: number }) {
  return (
    <div className="h-2 w-full rounded-full bg-slate-100">
      <div
        className={`h-2 rounded-full ${percent >= 90 ? 'bg-rose-500' : percent >= 70 ? 'bg-amber-500' : 'bg-emerald-500'}`}
        style={{ width: `${Math.min(100, percent)}%` }}
      />
    </div>
  );
}

export default function AdminTenantUsagePage() {
  const router = useRouter();
  const [tenants, setTenants] = useState<UsageTenantRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getMe()
      .then((user) => {
        if (user.role !== 'SUPER_ADMIN') {
          router.replace('/dashboard');
          return;
        }
        return getAdminTenantUsage();
      })
      .then((res) => {
        if (res) setTenants(res.tenants || []);
      })
      .catch((err) => {
        if (isUnauthorizedError(err)) router.replace('/login');
      })
      .finally(() => setLoading(false));
  }, [router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-slate-400">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        Loading usage…
      </div>
    );
  }

  const totalMrc = tenants.reduce((sum, t) => sum + t.monthlyCostEstimate, 0);
  const overLimit = tenants.filter((t) => t.overLimit).length;

  return (
    <div className="space-y-8">
      <AdminPageHeader
        section="Tenants"
        title="Usage monitoring"
        subtitle="Per-tenant usage, quotas, and estimated monthly cost."
      />

      <KpiSection title="Platform usage">
        <KpiCard title="Active tenants" value={tenants.filter((t) => t.isActive).length} subtitle={`${tenants.length} total`} icon={Activity} tone="indigo" />
        <KpiCard title="Over quota" value={overLimit} icon={AlertTriangle} tone={overLimit ? 'amber' : 'emerald'} href="/admin/tenants/quotas" />
        <KpiCard title="Est. monthly total" value={formatPrice(totalMrc)} subtitle="Platform + number fees" icon={DollarSign} tone="violet" />
      </KpiSection>

      <p className="text-sm text-slate-500">
        Quota defaults and per-tenant limits are still editable on{' '}
        <Link href="/admin/tenants/quotas" className="text-indigo-600 hover:text-indigo-500">
          Resource quotas
        </Link>
        .
      </p>

      <DataTable
        title="Tenant usage"
        data={tenants}
        getRowId={(t) => t.id}
        defaultPageSize={15}
        columns={[
          {
            key: 'name',
            header: 'Tenant',
            sortable: true,
            render: (t) => (
              <Link href={`/admin/tenants/${t.id}`} className="font-medium text-indigo-600 hover:text-indigo-500">
                {t.name}
              </Link>
            ),
          },
          { key: 'userCount', header: 'Users', sortable: true },
          { key: 'numberCount', header: 'Numbers', sortable: true },
          { key: 'callsToday', header: 'Calls today', sortable: true },
          { key: 'minutesUsedToday', header: 'Minutes today', sortable: true },
          { key: 'smsToday', header: 'SMS today', sortable: true },
          { key: 'currentPlan', header: 'Plan', sortable: true },
          {
            key: 'monthlyCostEstimate',
            header: 'Est. monthly',
            sortable: true,
            render: (t) => formatPrice(t.monthlyCostEstimate),
          },
          {
            key: 'userUsagePercent',
            header: 'User quota',
            searchable: false,
            render: (t) => (
              <div className="min-w-[80px]">
                <UsageBar percent={t.userUsagePercent} />
                <span className="text-xs text-slate-500">{t.userCount}/{t.maxUsers}</span>
              </div>
            ),
          },
        ]}
      />
    </div>
  );
}
