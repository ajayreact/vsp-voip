'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertTriangle,
  Building2,
  Hash,
  Loader2,
  MessageSquare,
  PhoneCall,
  Shield,
  TrendingUp,
  Users,
} from 'lucide-react';
import { DataTable } from '@/components/data-table';
import { KpiCard, KpiSection } from '@/components/kpi-card';
import { SimpleTrendChart } from '@/components/simple-trend-chart';
import { AdminPageHeader } from '@/components/admin-page-header';
import {
  getAdminExecutiveDashboard,
  getMe,
  isUnauthorizedError,
  type AdminDashboardStats,
  type AdminRecentTenant,
  type AdminSystemAlert,
  type AdminTimeseriesPoint,
  type NumberOrder,
} from '@/lib/api';
import { formatPrice } from '@/lib/pricing';

function formatDuration(seconds: number | null | undefined) {
  if (seconds == null || seconds <= 0) return '—';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s}s`;
}

function healthLabel(status: string) {
  if (status === 'healthy') return 'Healthy';
  if (status === 'warning') return 'Warning';
  return 'Degraded';
}

export default function ExecutiveDashboardPage() {
  const router = useRouter();
  const [stats, setStats] = useState<AdminDashboardStats | null>(null);
  const [recentOrders, setRecentOrders] = useState<NumberOrder[]>([]);
  const [recentTenants, setRecentTenants] = useState<AdminRecentTenant[]>([]);
  const [systemAlerts, setSystemAlerts] = useState<AdminSystemAlert[]>([]);
  const [timeseries, setTimeseries] = useState<AdminTimeseriesPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    getMe()
      .then((user) => {
        if (user.role !== 'SUPER_ADMIN') {
          router.replace('/dashboard');
          return;
        }
        return getAdminExecutiveDashboard();
      })
      .then((res) => {
        if (!res) return;
        setStats(res.stats);
        setRecentOrders(res.recentOrders || []);
        setRecentTenants(res.recentTenants || []);
        setSystemAlerts(res.systemAlerts || []);
        setTimeseries(res.timeseries || []);
      })
      .catch((err) => {
        if (isUnauthorizedError(err)) router.replace('/login');
        else setError(err instanceof Error ? err.message : 'Could not load dashboard');
      })
      .finally(() => setLoading(false));
  }, [router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-slate-500">
        <Loader2 className="mr-2 h-5 w-5 animate-spin text-indigo-600" />
        Loading executive dashboard…
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="mx-auto max-w-lg rounded-xl border border-red-200 bg-red-50 p-6 text-center">
        <p className="font-medium text-red-700">Dashboard unavailable</p>
        <p className="mt-2 text-sm text-slate-600">{error || 'No data'}</p>
      </div>
    );
  }

  const kpis = stats.kpis;
  const growth = kpis?.tenantGrowthPercent ?? 0;
  const health = stats.platformHealth;

  return (
    <div className="space-y-8">
      <div className="hero-banner overflow-hidden p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-white/20 px-3 py-1 text-xs font-medium text-white">
              <Shield className="h-3.5 w-3.5" />
              Executive dashboard
            </div>
            <h2 className="text-2xl font-semibold tracking-tight text-white">Platform overview</h2>
            <p className="mt-1 text-sm text-indigo-50">Business-critical KPIs across all tenants</p>
          </div>
          <Link
            href="/admin/operations"
            className="rounded-xl bg-white/20 px-4 py-3 text-sm font-medium text-white backdrop-blur-sm hover:bg-white/30"
          >
            Live operations →
          </Link>
        </div>
      </div>

      <KpiSection title="Business metrics" description="Core platform footprint and revenue.">
        <KpiCard
          title="Total tenants"
          value={stats.tenantCount}
          subtitle={`${stats.activeTenantCount} active · ${stats.suspendedTenantCount} suspended`}
          trend={{ label: `${growth >= 0 ? '+' : ''}${growth}% vs last month`, positive: growth >= 0 }}
          icon={Building2}
          tone="indigo"
          href="/admin/tenants"
        />
        <KpiCard
          title="Total users"
          value={kpis?.totalUsers ?? kpis?.totalExtensions ?? 0}
          subtitle="Registered tenant users"
          icon={Users}
          tone="violet"
          href="/admin/support/users"
        />
        <KpiCard
          title="Active calls"
          value={kpis?.activeConcurrentCalls ?? 0}
          subtitle="Sessions in last 5 min (estimate)"
          icon={PhoneCall}
          tone="sky"
          badge="Live"
          href="/admin/operations"
        />
        <KpiCard
          title="Monthly recurring revenue"
          value={formatPrice(kpis?.mrrEstimate ?? 0)}
          subtitle={`${kpis?.activeStripeSubscriptions ?? 0} Stripe subscriptions`}
          icon={TrendingUp}
          tone="emerald"
          href="/admin/billing/revenue"
        />
      </KpiSection>

      <KpiSection title="Inventory & messaging">
        <KpiCard
          title="Number inventory"
          value={kpis?.inventoryPurchased ?? stats.phoneNumberCount}
          subtitle={`${kpis?.availableDidPool ?? 0} available in pool`}
          icon={Hash}
          tone="violet"
          href="/admin/numbers"
        />
        <KpiCard
          title="Assigned numbers"
          value={stats.assignedNumbers ?? stats.phoneNumberCount}
          subtitle={`${stats.releasedNumbers ?? 0} released`}
          icon={Hash}
          tone="indigo"
          href="/admin/numbers"
        />
        <KpiCard
          title="SMS sent today"
          value={kpis?.smsToday ?? 0}
          subtitle="Across all tenants"
          icon={MessageSquare}
          tone="sky"
        />
        <KpiCard
          title="Platform health"
          value={health ? healthLabel(health.status) : '—'}
          subtitle={health ? `Score ${health.score}/100` : 'Checking services…'}
          icon={Shield}
          tone={health?.status === 'healthy' ? 'emerald' : 'amber'}
          href="/admin/monitoring/registrations"
        />
      </KpiSection>

      <KpiSection title="Call performance" description="Today and month-to-date call activity.">
        <KpiCard title="Calls today" value={kpis?.callsToday ?? 0} icon={PhoneCall} tone="indigo" />
        <KpiCard title="Calls this month" value={kpis?.callsThisMonth ?? 0} icon={PhoneCall} tone="violet" />
        <KpiCard
          title="Success rate"
          value={kpis?.callSuccessRate != null ? `${kpis.callSuccessRate}%` : '—'}
          subtitle="Completed vs failed today"
          icon={TrendingUp}
          tone="emerald"
        />
        <KpiCard
          title="Failure rate"
          value={kpis?.callFailureRate != null ? `${kpis.callFailureRate}%` : '—'}
          icon={AlertTriangle}
          tone="amber"
        />
        <KpiCard
          title="Avg call duration"
          value={formatDuration(kpis?.avgCallDurationSeconds)}
          subtitle="Month to date"
          icon={PhoneCall}
          tone="slate"
        />
        <KpiCard
          title="Avg MOS score"
          value={kpis?.averageMos != null ? kpis.averageMos.toFixed(1) : '—'}
          subtitle="See Live operations for detail"
          icon={Shield}
          tone="slate"
          href="/admin/monitoring/quality"
        />
      </KpiSection>

      {timeseries.length ? (
        <div className="grid gap-4 lg:grid-cols-3">
          <SimpleTrendChart
            title="Revenue trend (30d)"
            points={timeseries.map((t) => ({ date: t.date, value: t.revenue }))}
            formatValue={(n) => formatPrice(n)}
            color="bg-emerald-500"
          />
          <SimpleTrendChart
            title="Tenant growth (30d)"
            points={timeseries.map((t) => ({ date: t.date, value: t.newTenants }))}
            color="bg-violet-500"
          />
          <SimpleTrendChart
            title="Call volume (30d)"
            points={timeseries.map((t) => ({ date: t.date, value: t.calls }))}
            color="bg-indigo-500"
          />
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <DataTable
          title="Latest orders"
          data={recentOrders}
          getRowId={(o) => o.id}
          defaultPageSize={5}
          emptyMessage="No orders yet"
          columns={[
            {
              key: 'createdAt',
              header: 'Date',
              render: (o) => new Date(o.createdAt).toLocaleDateString(),
            },
            { key: 'tenantName', header: 'Tenant', render: (o) => o.tenantName || '—' },
            {
              key: 'totalCharged',
              header: 'Total',
              render: (o) => formatPrice(o.totalCharged),
            },
            {
              key: 'actions',
              header: '',
              searchable: false,
              sortable: false,
              render: (o) => (
                <Link href={`/admin/orders/${o.id}`} className="text-indigo-600 hover:text-indigo-500">
                  View
                </Link>
              ),
            },
          ]}
        />
        <DataTable
          title="Latest tenant signups"
          data={recentTenants}
          getRowId={(t) => t.id}
          defaultPageSize={5}
          emptyMessage="No recent signups"
          columns={[
            { key: 'name', header: 'Tenant', sortable: true },
            {
              key: 'createdAt',
              header: 'Created',
              render: (t) => new Date(t.createdAt).toLocaleDateString(),
            },
            {
              key: 'isActive',
              header: 'Status',
              render: (t) => (t.isActive ? 'Active' : 'Suspended'),
            },
            {
              key: 'actions',
              header: '',
              searchable: false,
              sortable: false,
              render: (t) => (
                <Link href={`/admin/tenants/${t.id}`} className="text-indigo-600 hover:text-indigo-500">
                  Open
                </Link>
              ),
            },
          ]}
        />
      </div>

      {systemAlerts.length ? (
        <div className="panel-card overflow-hidden">
          <div className="border-b border-slate-200 px-5 py-4">
            <h3 className="section-title flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              System alerts
            </h3>
          </div>
          <ul className="divide-y divide-slate-100">
            {systemAlerts.map((alert) => (
              <li key={alert.id} className="px-5 py-3 text-sm text-slate-700">
                <span className="font-medium capitalize">{alert.type}</span>
                <span className="mx-2 text-slate-400">·</span>
                {alert.message}
                <span className="ml-2 text-xs text-slate-400">
                  {new Date(alert.createdAt).toLocaleString()}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
