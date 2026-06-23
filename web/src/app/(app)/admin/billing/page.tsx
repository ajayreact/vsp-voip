'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, CheckCircle2, CreditCard, DollarSign, Loader2, Package, XCircle } from 'lucide-react';
import { KpiCard, KpiSection } from '@/components/kpi-card';
import { AdminPageHeader } from '@/components/admin-page-header';
import { AdminSectionNav, adminBillingTabs } from '@/components/admin-section-nav';
import {
  getAdminExecutiveDashboard,
  getMe,
  isUnauthorizedError,
} from '@/lib/api';
import { formatPrice } from '@/lib/pricing';

export default function AdminBillingOverviewPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [mrr, setMrr] = useState(0);
  const [revenueTotal, setRevenueTotal] = useState(0);
  const [pendingOrders, setPendingOrders] = useState(0);
  const [bankPending, setBankPending] = useState(0);
  const [bankApproved, setBankApproved] = useState(0);
  const [bankRejected, setBankRejected] = useState(0);
  const [stripeEnabled, setStripeEnabled] = useState(false);
  const [bankEnabled, setBankEnabled] = useState(false);

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
        setMrr(res.stats.kpis?.mrrEstimate ?? 0);
        setRevenueTotal(res.stats.revenueTotal);
        setPendingOrders(res.stats.pendingBankOrders);
        setBankPending(res.stats.bankPaymentsPending ?? res.stats.pendingBankOrders);
        setBankApproved(res.stats.bankPaymentsApproved ?? 0);
        setBankRejected(res.stats.bankPaymentsRejected ?? 0);
        setStripeEnabled(res.stats.stripeEnabled);
        setBankEnabled(res.stats.manualPaymentEnabled);
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
        Loading billing…
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <AdminPageHeader
        section="Billing"
        title="Billing overview"
        subtitle="Revenue summary and payment configuration status."
      />
      <AdminSectionNav tabs={adminBillingTabs} />

      <KpiSection title="Bank transfer reviews">
        <KpiCard
          title="Pending review"
          value={bankPending}
          icon={Package}
          tone={bankPending ? 'amber' : 'slate'}
          href="/admin/billing/orders?paymentMethod=MANUAL_BANK"
        />
        <KpiCard
          title="Approved payments"
          value={bankApproved}
          icon={CheckCircle2}
          tone="emerald"
          href="/admin/billing/orders?paymentMethod=MANUAL_BANK"
        />
        <KpiCard
          title="Rejected payments"
          value={bankRejected}
          icon={XCircle}
          tone={bankRejected ? 'rose' : 'slate'}
          href="/admin/billing/orders?paymentMethod=MANUAL_BANK"
        />
      </KpiSection>

      <KpiSection title="Revenue">
        <KpiCard title="MRR (estimate)" value={formatPrice(mrr)} icon={DollarSign} tone="emerald" href="/admin/billing/revenue" />
        <KpiCard title="Lifetime order revenue" value={formatPrice(revenueTotal)} icon={DollarSign} tone="indigo" href="/admin/billing/revenue" />
        <KpiCard
          title="Open bank orders"
          value={pendingOrders}
          icon={Package}
          tone={pendingOrders ? 'amber' : 'slate'}
          href="/admin/billing/orders"
        />
      </KpiSection>

      <div className="grid gap-4 md:grid-cols-2">
        <Link href="/admin/billing/payment-gateways" className="panel-card block p-5 hover:shadow-md">
          <div className="flex items-center gap-2 text-sm font-medium text-slate-500">
            <CreditCard className="h-4 w-4 text-indigo-600" />
            Stripe payments
          </div>
          <p className={`mt-2 text-lg font-semibold ${stripeEnabled ? 'text-emerald-600' : 'text-slate-800'}`}>
            {stripeEnabled ? 'Enabled at checkout' : 'Disabled'}
          </p>
        </Link>
        <Link href="/admin/billing/payment-gateways" className="panel-card block p-5 hover:shadow-md">
          <div className="flex items-center gap-2 text-sm font-medium text-slate-500">
            <AlertTriangle className="h-4 w-4 text-indigo-600" />
            Bank transfer
          </div>
          <p className={`mt-2 text-lg font-semibold ${bankEnabled ? 'text-emerald-600' : 'text-slate-800'}`}>
            {bankEnabled ? 'Enabled (default)' : 'Not configured'}
          </p>
        </Link>
      </div>

      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
        Subscription plans, usage billing, and ticket-based support billing are scheduled for Phase 2.
      </div>
    </div>
  );
}
