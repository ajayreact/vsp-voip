'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertTriangle,
  DollarSign,
  Loader2,
  RefreshCw,
  Shield,
  TrendingUp,
} from 'lucide-react';
import { AdminPageHeader } from '@/components/admin-page-header';
import { AdminSectionNav, adminBillingTabs } from '@/components/admin-section-nav';
import { KpiCard, KpiSection } from '@/components/kpi-card';
import {
  getAdminRevenueProtection,
  getMe,
  isUnauthorizedError,
  resolveAdminBillingAlert,
  runAdminBillingIntegrity,
  type RevenueProtectionDashboard,
} from '@/lib/api';
import { formatPrice } from '@/lib/pricing';

export default function AdminRevenueProtectionPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [runningCheck, setRunningCheck] = useState(false);
  const [dashboard, setDashboard] = useState<RevenueProtectionDashboard | null>(null);
  const [message, setMessage] = useState('');

  async function load() {
    const res = await getAdminRevenueProtection();
    setDashboard(res.dashboard);
  }

  useEffect(() => {
    getMe()
      .then((user) => {
        if (user.role !== 'SUPER_ADMIN') {
          router.replace('/dashboard');
          return;
        }
        return load();
      })
      .catch((err) => {
        if (isUnauthorizedError(err)) router.replace('/login');
      })
      .finally(() => setLoading(false));
  }, [router]);

  async function onRunIntegrity() {
    setRunningCheck(true);
    setMessage('');
    try {
      const res = await runAdminBillingIntegrity();
      setMessage(`Integrity check complete — ${res.alertCount} alert(s) recorded.`);
      await load();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Integrity check failed');
    } finally {
      setRunningCheck(false);
    }
  }

  if (loading || !dashboard) {
    return (
      <div className="flex items-center justify-center py-24 text-slate-400">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        Loading revenue protection…
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <AdminPageHeader
        section="Billing"
        title="Revenue protection"
        subtitle="Payment integrity, margin analytics, and billing leak detection."
      />
      <AdminSectionNav tabs={adminBillingTabs} />

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={onRunIntegrity}
          disabled={runningCheck}
          className="inline-flex items-center gap-2 rounded-lg bg-indigo-500 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-400 disabled:opacity-50"
        >
          {runningCheck ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Run integrity check now
        </button>
      </div>

      {message ? (
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
          {message}
        </div>
      ) : null}

      <KpiSection title="Payment integrity">
        <KpiCard title="Paid orders" value={dashboard.paidOrders} icon={Shield} tone="emerald" />
        <KpiCard title="Pending payments" value={dashboard.pendingPayments} icon={AlertTriangle} tone="amber" href="/admin/billing/orders" />
        <KpiCard title="Unpaid fulfillments" value={dashboard.unpaidFulfillments} icon={AlertTriangle} tone={dashboard.unpaidFulfillments ? 'red' : 'slate'} />
        <KpiCard title="Numbers without invoice" value={dashboard.numbersWithoutInvoice} icon={AlertTriangle} tone={dashboard.numbersWithoutInvoice ? 'amber' : 'slate'} />
      </KpiSection>

      <KpiSection title="Margin & MRR">
        <KpiCard title="Monthly MRR" value={formatPrice(dashboard.totals.monthlyMrr)} icon={TrendingUp} tone="indigo" />
        <KpiCard title="Carrier cost (MRC)" value={formatPrice(dashboard.totals.carrierMonthlyCost)} icon={DollarSign} tone="slate" />
        <KpiCard title="Gross profit (monthly)" value={formatPrice(dashboard.totals.grossProfitMonthly)} icon={TrendingUp} tone="emerald" />
        <KpiCard title="Numbers tracked" value={dashboard.marginNumbersTracked} icon={Shield} tone="slate" />
      </KpiSection>

      <div className="panel-card overflow-hidden">
        <div className="border-b border-slate-200 px-5 py-4">
          <h3 className="font-medium text-slate-900">Margin per tenant</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-slate-500">
              <tr>
                <th className="px-5 py-3 font-medium">Tenant</th>
                <th className="px-5 py-3 font-medium">Numbers</th>
                <th className="px-5 py-3 font-medium">Customer MRR</th>
                <th className="px-5 py-3 font-medium">Carrier MRC</th>
                <th className="px-5 py-3 font-medium">Gross profit/mo</th>
              </tr>
            </thead>
            <tbody>
              {dashboard.marginByTenant.length ? (
                dashboard.marginByTenant.map((row) => (
                  <tr key={row.tenantId} className="border-t border-slate-100">
                    <td className="px-5 py-3 font-medium text-slate-900">{row.tenantName}</td>
                    <td className="px-5 py-3">{row.numberCount}</td>
                    <td className="px-5 py-3">{formatPrice(row.customerMrr)}</td>
                    <td className="px-5 py-3">{formatPrice(row.carrierMonthlyCost)}</td>
                    <td className="px-5 py-3 text-emerald-700">{formatPrice(row.monthlyGrossProfit)}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="px-5 py-8 text-center text-slate-500">
                    No margin data yet — margins are recorded when numbers are purchased through payment flows.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="panel-card overflow-hidden">
        <div className="border-b border-slate-200 px-5 py-4">
          <h3 className="font-medium text-slate-900">Open integrity alerts</h3>
        </div>
        <ul className="divide-y divide-slate-100">
          {dashboard.recentAlerts.length ? (
            dashboard.recentAlerts.map((alert) => (
              <li key={alert.id} className="flex flex-wrap items-start justify-between gap-3 px-5 py-4">
                <div>
                  <p className="text-sm font-medium text-slate-900">{alert.message}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {alert.type} · {alert.severity} · {new Date(alert.createdAt).toLocaleString()}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={async () => {
                    await resolveAdminBillingAlert(alert.id);
                    await load();
                  }}
                  className="text-xs font-medium text-indigo-600 hover:text-indigo-500"
                >
                  Resolve
                </button>
              </li>
            ))
          ) : (
            <li className="px-5 py-8 text-center text-sm text-slate-500">No open alerts.</li>
          )}
        </ul>
      </div>
    </div>
  );
}
