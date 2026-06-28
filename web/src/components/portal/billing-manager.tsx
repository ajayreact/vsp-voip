'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CreditCard, Loader2, Phone } from 'lucide-react';
import { DataTable, type DataTableColumn } from '@/components/data-table';
import { PortalPageHeader } from '@/components/portal/page-header';
import {
  getBillingConfig,
  getBillingInvoiceDownloadUrl,
  getBillingOrders,
  getExtensionStats,
  getMe,
  getTenantSubscription,
  isUnauthorizedError,
  type BillingConfig,
  type NumberOrder,
  type TenantSubscriptionSummary,
} from '@/lib/api';
import { orderStatusBadgeClass, orderStatusLabel, orderStatusTone } from '@/lib/orderStatus';
import { formatPrice } from '@/lib/pricing';

function planLabel(summary: TenantSubscriptionSummary) {
  if (summary.stripeSubscription?.status === 'active') return 'Active — card billing';
  if (summary.stripeSubscription?.status === 'past_due') return 'Past due';
  if (summary.hasStripeSubscription) return `Stripe: ${summary.stripeSubscription?.status || 'linked'}`;
  if (summary.numberCount > 0) return 'Manual / bank billing';
  return 'No active plan';
}

export function BillingManagerPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [summary, setSummary] = useState<TenantSubscriptionSummary | null>(null);
  const [billing, setBilling] = useState<BillingConfig | null>(null);
  const [orders, setOrders] = useState<NumberOrder[]>([]);
  const [extensionCount, setExtensionCount] = useState(0);

  useEffect(() => {
    getMe()
      .then((user) => {
        if (!user.tenantId) {
          router.replace('/dashboard');
          return;
        }
        return Promise.all([
          getTenantSubscription(),
          getBillingConfig().catch(() => null),
          getBillingOrders().catch(() => ({ orders: [] })),
          getExtensionStats().catch(() => null),
        ]);
      })
      .then((res) => {
        if (!res) return;
        const [subRes, configRes, ordersRes, extStats] = res;
        if (subRes?.summary) setSummary(subRes.summary);
        if (configRes) setBilling(configRes);
        setOrders(ordersRes?.orders || []);
        setExtensionCount(extStats?.stats?.totalExtensions ?? 0);
      })
      .catch((err) => {
        if (isUnauthorizedError(err)) router.replace('/login');
        else setError(err instanceof Error ? err.message : 'Could not load billing');
      })
      .finally(() => setLoading(false));
  }, [router]);

  const orderColumns: DataTableColumn<NumberOrder>[] = [
    {
      key: 'createdAt',
      header: 'Date',
      sortable: true,
      sortValue: (order) => new Date(order.createdAt),
      render: (order) => new Date(order.createdAt).toLocaleString(),
    },
    {
      key: 'invoiceNumber',
      header: 'Invoice',
      sortable: true,
      render: (order) => <span className="font-mono text-xs">{order.invoiceNumber || '—'}</span>,
    },
    {
      key: 'paymentMethod',
      header: 'Payment',
      sortable: true,
      render: (order) => (order.paymentMethod === 'MANUAL_BANK' ? 'Bank transfer' : 'Card'),
    },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      render: (order) => {
        const tone = orderStatusTone(order.status);
        return (
          <span className={`rounded-full px-2 py-1 text-xs ${orderStatusBadgeClass(tone)}`}>
            {orderStatusLabel(order)}
          </span>
        );
      },
    },
    {
      key: 'totalCharged',
      header: 'Amount',
      sortable: true,
      sortValue: (order) => order.totalCharged,
      render: (order) => formatPrice(order.totalCharged),
    },
    {
      key: 'actions',
      header: 'Actions',
      searchable: false,
      sortable: false,
      render: (order) => (
        <div className="flex flex-wrap gap-2 text-xs">
          <Link href={`/settings/orders/${order.id}`} className="text-indigo-600 hover:text-indigo-700">
            View
          </Link>
          {order.invoiceNumber ? (
            <a
              href={getBillingInvoiceDownloadUrl(order.id)}
              className="text-slate-600 hover:text-slate-800"
              target="_blank"
              rel="noopener noreferrer"
            >
              Invoice
            </a>
          ) : null}
        </div>
      ),
    },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-slate-400">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        Loading billing…
      </div>
    );
  }

  if (error || !summary) {
    return (
      <div className="panel-card mx-auto max-w-lg p-6 text-center">
        <p className="font-medium text-red-700">Billing unavailable</p>
        <p className="mt-2 text-sm text-slate-500">{error || 'Could not load billing data'}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PortalPageHeader
        title="Billing"
        description="Tenant subscription and invoice history. View-only — no payment processing on this page."
        actions={
          <Link
            href="/settings/payment-methods"
            className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <CreditCard className="h-4 w-4" />
            Payment methods
          </Link>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="panel-card p-4">
          <p className="text-xs uppercase text-slate-500">Current plan</p>
          <p className="mt-1 text-lg font-semibold text-slate-900">{planLabel(summary)}</p>
        </div>
        <div className="panel-card p-4">
          <p className="text-xs uppercase text-slate-500">Phone numbers</p>
          <p className="mt-1 text-2xl font-semibold">{summary.numberCount}</p>
        </div>
        <div className="panel-card p-4">
          <p className="text-xs uppercase text-slate-500">Extensions</p>
          <p className="mt-1 text-2xl font-semibold">{extensionCount}</p>
        </div>
        <div className="panel-card p-4">
          <p className="text-xs uppercase text-slate-500">Monthly charges</p>
          <p className="mt-1 text-2xl font-semibold">{formatPrice(summary.estimatedMonthlyTotal)}</p>
          {billing ? (
            <p className="mt-1 text-xs text-slate-500">
              Platform fee {formatPrice(billing.platformFeeMonthly)}/number
            </p>
          ) : null}
        </div>
      </div>

      {summary.stripeSubscription?.currentPeriodEnd ? (
        <p className="text-sm text-slate-500">
          Current billing period ends{' '}
          {new Date(summary.stripeSubscription.currentPeriodEnd).toLocaleDateString()}
        </p>
      ) : null}

      <DataTable
        title="Numbers on recurring billing"
        data={summary.activeNumbers}
        getRowId={(n) => n.id}
        emptyMessage="No numbers on recurring billing."
        columns={[
          {
            key: 'number',
            header: 'Number',
            sortable: true,
            render: (n) => (
              <span className="inline-flex items-center gap-2">
                <Phone className="h-4 w-4 text-indigo-400" />
                {n.number}
              </span>
            ),
          },
          {
            key: 'tenantMonthlyTotal',
            header: 'Monthly',
            sortable: true,
            sortValue: (n) => n.tenantMonthlyTotal ?? n.platformMonthly ?? 0,
            render: (n) => formatPrice(n.tenantMonthlyTotal ?? n.platformMonthly ?? 0),
          },
          {
            key: 'hasStripeBilling',
            header: 'Billing',
            render: (n) => (n.hasStripeBilling ? 'Stripe' : 'Manual'),
          },
        ]}
      />

      <DataTable
        title="Payment history"
        data={orders}
        getRowId={(order) => order.id}
        emptyMessage="No payment history yet"
        columns={orderColumns}
      />
    </div>
  );
}
