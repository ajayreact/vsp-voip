'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CreditCard, DollarSign, Loader2, Package, RotateCcw, XCircle } from 'lucide-react';
import { AdminPageHeader } from '@/components/admin-page-header';
import { AdminSectionNav, adminBillingTabs } from '@/components/admin-section-nav';
import { KpiCard, KpiSection } from '@/components/kpi-card';
import {
  getAdminRazorpayPaymentsReport,
  getAdminRazorpayRefundsReport,
  getAdminRevenueByGatewayReport,
  getMe,
  isUnauthorizedError,
} from '@/lib/api';
import { formatPrice } from '@/lib/pricing';

export default function AdminRazorpayReportsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [payments, setPayments] = useState<Awaited<ReturnType<typeof getAdminRazorpayPaymentsReport>> | null>(null);
  const [refunds, setRefunds] = useState<Awaited<ReturnType<typeof getAdminRazorpayRefundsReport>> | null>(null);
  const [byGateway, setByGateway] = useState<Awaited<ReturnType<typeof getAdminRevenueByGatewayReport>> | null>(null);

  useEffect(() => {
    getMe()
      .then(async (user) => {
        if (user.role !== 'SUPER_ADMIN') {
          router.replace('/dashboard');
          return;
        }
        const [p, r, g] = await Promise.all([
          getAdminRazorpayPaymentsReport(),
          getAdminRazorpayRefundsReport(),
          getAdminRevenueByGatewayReport(),
        ]);
        setPayments(p);
        setRefunds(r);
        setByGateway(g);
      })
      .catch((err) => {
        if (isUnauthorizedError(err)) router.replace('/login');
      })
      .finally(() => setLoading(false));
  }, [router]);

  if (loading || !payments || !refunds || !byGateway) {
    return (
      <div className="flex items-center justify-center py-24 text-slate-400">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        Loading Razorpay reports…
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <AdminPageHeader
        section="Billing"
        title="Razorpay & gateway reports"
        subtitle="Payments, refunds, and revenue breakdown by payment gateway."
      />
      <AdminSectionNav tabs={adminBillingTabs} />

      <KpiSection title="Razorpay payments">
        <KpiCard title="Total orders" value={payments.summary.totalOrders} icon={Package} />
        <KpiCard title="Paid" value={payments.summary.paid} icon={CreditCard} tone="emerald" />
        <KpiCard title="Pending" value={payments.summary.pending} icon={CreditCard} tone="amber" />
        <KpiCard title="Failed" value={payments.summary.failed} icon={XCircle} tone={payments.summary.failed ? 'rose' : 'slate'} />
        <KpiCard title="Collected" value={formatPrice(payments.summary.totalCollected)} icon={DollarSign} tone="indigo" />
        <KpiCard title="Refunded" value={formatPrice(payments.summary.totalRefunded)} icon={RotateCcw} tone="slate" />
      </KpiSection>

      <KpiSection title="Revenue by gateway">
        {byGateway.gateways.map((g) => (
          <KpiCard
            key={g.paymentMethod}
            title={g.paymentMethod}
            value={formatPrice(g.net)}
            subtitle={`${g.orderCount} orders · ${formatPrice(g.refunds)} refunds`}
            icon={CreditCard}
            tone="indigo"
          />
        ))}
      </KpiSection>

      <div className="panel-card overflow-hidden">
        <div className="border-b border-slate-200 px-5 py-4">
          <h3 className="font-medium text-slate-900">Recent Razorpay payments</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-slate-500">
              <tr>
                <th className="px-5 py-3">Invoice</th>
                <th className="px-5 py-3">Tenant</th>
                <th className="px-5 py-3">Amount</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Payment ID</th>
              </tr>
            </thead>
            <tbody>
              {payments.payments.length ? payments.payments.slice(0, 20).map((p) => (
                <tr key={String(p.id)} className="border-t border-slate-100">
                  <td className="px-5 py-3">{String(p.invoiceNumber || p.id)}</td>
                  <td className="px-5 py-3">{String(p.tenantName || '—')}</td>
                  <td className="px-5 py-3">{formatPrice(Number(p.amount))}</td>
                  <td className="px-5 py-3">{String(p.status)}</td>
                  <td className="px-5 py-3 font-mono text-xs">{String(p.razorpayPaymentId || '—')}</td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={5} className="px-5 py-8 text-center text-slate-500">No Razorpay payments yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="panel-card overflow-hidden">
        <div className="border-b border-slate-200 px-5 py-4">
          <h3 className="font-medium text-slate-900">Razorpay refunds</h3>
        </div>
        <ul className="divide-y divide-slate-100">
          {refunds.refunds.length ? refunds.refunds.map((r) => (
            <li key={String(r.id)} className="px-5 py-4 text-sm">
              <p className="font-medium text-slate-900">{String(r.invoiceNumber || r.orderId)} · {formatPrice(Number(r.amount))}</p>
              <p className="text-xs text-slate-500">{String(r.reason || 'Refund')} · {new Date(String(r.createdAt)).toLocaleString()}</p>
            </li>
          )) : (
            <li className="px-5 py-8 text-center text-sm text-slate-500">No refunds recorded.</li>
          )}
        </ul>
      </div>
    </div>
  );
}
