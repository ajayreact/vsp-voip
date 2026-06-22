'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { getBillingConfig, getBillingOrders, getMe, type BillingConfig, type NumberOrder } from '@/lib/api';
import { SettingsNav } from '@/components/settings-nav';
import { DataTable } from '@/components/data-table';
import { formatPrice } from '@/lib/pricing';
import { orderStatusBadgeClass, orderStatusLabel, orderStatusTone } from '@/lib/orderStatus';

export default function SettingsPage() {
  const [billing, setBilling] = useState<BillingConfig | null>(null);
  const [orders, setOrders] = useState<NumberOrder[]>([]);
  const [role, setRole] = useState<string | undefined>();

  useEffect(() => {
    getMe().then((user) => setRole(user.role)).catch(() => {});
    getBillingConfig()
      .then((res) =>
        setBilling({
          platformFeeSetup: res.platformFeeSetup,
          platformFeeMonthly: res.platformFeeMonthly,
          platformFeeFirstMonth: res.platformFeeFirstMonth,
          currency: res.currency,
          stripeEnabled: res.stripeEnabled,
          manualPaymentEnabled: res.manualPaymentEnabled,
        }),
      )
      .catch(() => {});

    getBillingOrders()
      .then((res) => setOrders(res.orders || []))
      .catch(() => setOrders([]));
  }, []);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h2 className="text-lg font-medium text-slate-900">Settings</h2>
        <p className="text-sm text-slate-400">Billing, company profile, and team</p>
      </div>

      <SettingsNav role={role} />

      <div className="panel-card p-6">
        <h3 className="font-medium text-slate-900">VSP-VOIP Billing</h3>
        <p className="mt-1 text-sm text-slate-400">
          Phone numbers are billed to your organization. Carrier costs plus your assigned platform
          fees apply at checkout; recurring charges run on your subscription or monthly invoice.
        </p>
        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
          <div className="rounded-lg bg-white/50 px-4 py-3">
            <dt className="text-slate-500">Setup fee</dt>
            <dd className="mt-1 text-lg font-semibold text-slate-900">
              {billing ? formatPrice(billing.platformFeeSetup) : '—'}/number
            </dd>
          </div>
          <div className="rounded-lg bg-white/50 px-4 py-3">
            <dt className="text-slate-500">First month platform fee</dt>
            <dd className="mt-1 text-lg font-semibold text-slate-900">
              {billing ? formatPrice(billing.platformFeeFirstMonth) : '—'}/number
            </dd>
          </div>
          <div className="rounded-lg bg-white/50 px-4 py-3">
            <dt className="text-slate-500">Recurring monthly fee</dt>
            <dd className="mt-1 text-lg font-semibold text-slate-900">
              {billing ? formatPrice(billing.platformFeeMonthly) : '—'}/number
            </dd>
          </div>
          <div className="rounded-lg bg-white/50 px-4 py-3">
            <dt className="text-slate-500">Payment options</dt>
            <dd className="mt-1 text-sm font-medium text-slate-900">
              {billing?.stripeEnabled ? 'Card' : 'Card not available'}
              {billing?.manualPaymentEnabled ? ' · Bank transfer' : ''}
            </dd>
          </div>
        </dl>
      </div>

      <DataTable
        title="Recent orders"
        data={orders}
        getRowId={(order) => order.id}
        emptyMessage="No orders yet"
        columns={[
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
            header: 'Total',
            sortable: true,
            sortValue: (order) => order.totalCharged,
            render: (order) => formatPrice(order.totalCharged),
          },
          {
            key: 'actions',
            header: 'Actions',
            searchable: false,
            sortable: false,
            className: 'text-right',
            render: (order) => (
              <Link href={`/settings/orders/${order.id}`} className="text-indigo-600 hover:text-indigo-500">
                View
              </Link>
            ),
          },
        ]}
      />
    </div>
  );
}
