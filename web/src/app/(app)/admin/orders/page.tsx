'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Loader2, Package } from 'lucide-react';
import { DataTable } from '@/components/data-table';
import { AdminSectionNav, adminBillingTabs } from '@/components/admin-section-nav';
import { AdminPageHeader } from '@/components/admin-page-header';
import { getAdminOrders, getMe, isUnauthorizedError, type NumberOrder } from '@/lib/api';
import { formatPrice } from '@/lib/pricing';

function statusBadge(status: string) {
  const map: Record<string, string> = {
    PENDING: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200',
    PAID: 'bg-blue-50 text-blue-700 ring-1 ring-blue-200',
    FULFILLED: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200',
    PARTIAL: 'bg-orange-50 text-orange-700 ring-1 ring-orange-200',
    FAILED: 'bg-red-50 text-red-700 ring-1 ring-red-200',
    CANCELLED: 'bg-slate-100 text-slate-600',
  };
  return map[status] || 'bg-slate-100 text-slate-600';
}

function paymentLabel(method: string, reference?: string | null) {
  if (reference === 'ADMIN_DIRECT') return 'Admin direct';
  if (method === 'MANUAL_BANK') return 'Bank transfer';
  if (method === 'STRIPE') return 'Stripe';
  if (method === 'RAZORPAY') return 'Razorpay';
  return method;
}

export default function AdminOrdersPage() {
  const router = useRouter();
  const pathname = usePathname();
  const inBillingSection = pathname.startsWith('/admin/billing');
  const [orders, setOrders] = useState<NumberOrder[]>([]);
  const [statusFilter, setStatusFilter] = useState('PENDING');
  const [paymentFilter, setPaymentFilter] = useState('ALL');
  const [loading, setLoading] = useState(true);

  async function loadOrders(status?: string, payment?: string) {
    const params: { status?: string; paymentMethod?: string } = {};
    if (status && status !== 'ALL') params.status = status;
    if (payment && payment !== 'ALL') params.paymentMethod = payment;
    const res = await getAdminOrders(params);
    setOrders(res.orders || []);
  }

  useEffect(() => {
    getMe()
      .then((user) => {
        if (user.role !== 'SUPER_ADMIN') {
          router.replace('/dashboard');
          return;
        }
        return loadOrders(statusFilter, paymentFilter);
      })
      .catch((err) => {
        if (isUnauthorizedError(err)) router.replace('/login');
      })
      .finally(() => setLoading(false));
  }, [router, statusFilter, paymentFilter]);

  function applyFilters(status: string, payment: string) {
    setLoading(true);
    setStatusFilter(status);
    setPaymentFilter(payment);
    loadOrders(status, payment).finally(() => setLoading(false));
  }

  if (loading && !orders.length) {
    return (
      <div className="flex items-center justify-center py-24 text-slate-400">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        Loading orders…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {inBillingSection ? (
        <>
          <AdminPageHeader
            section="Billing"
            title="Orders & invoices"
            subtitle="Bank transfer and Stripe orders across all tenants."
          />
          <AdminSectionNav tabs={adminBillingTabs} />
        </>
      ) : (
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="page-title">All orders</h2>
            <p className="page-subtitle">Bank transfer and Stripe orders across all tenants.</p>
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-50 text-indigo-400">
            <Package className="h-5 w-5" />
          </div>
        </div>
      )}

      <DataTable
        title="Order directory"
        data={orders}
        getRowId={(order) => order.id}
        emptyMessage="No orders found for these filters."
        toolbar={
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <span className="self-center text-xs font-medium text-slate-500">Status</span>
              {['PENDING', 'FULFILLED', 'CANCELLED', 'ALL'].map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => applyFilters(s, paymentFilter)}
                  className={statusFilter === s ? 'filter-btn filter-btn-active' : 'filter-btn'}
                >
                  {s === 'ALL' ? 'All' : s.charAt(0) + s.slice(1).toLowerCase()}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              <span className="self-center text-xs font-medium text-slate-500">Payment</span>
              {[
                { id: 'ALL', label: 'All methods' },
                { id: 'MANUAL_BANK', label: 'Bank transfer' },
                { id: 'STRIPE', label: 'Stripe' },
                { id: 'RAZORPAY', label: 'Razorpay' },
              ].map(({ id, label }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => applyFilters(statusFilter, id)}
                  className={paymentFilter === id ? 'filter-btn filter-btn-active' : 'filter-btn'}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        }
        columns={[
          {
            key: 'createdAt',
            header: 'Date',
            sortable: true,
            sortValue: (order) => new Date(order.createdAt),
            render: (order) => new Date(order.createdAt).toLocaleString(),
          },
          {
            key: 'tenantName',
            header: 'Tenant',
            sortable: true,
            render: (order) => order.tenantName || '—',
          },
          {
            key: 'paymentMethod',
            header: 'Payment',
            sortable: true,
            render: (order) => paymentLabel(order.paymentMethod, order.paymentReference),
          },
          {
            key: 'invoiceNumber',
            header: 'Invoice',
            sortable: true,
            render: (order) => (
              <span className="font-mono text-xs">{order.invoiceNumber || '—'}</span>
            ),
          },
          {
            key: 'totalCharged',
            header: 'Total',
            sortable: true,
            sortValue: (order) => order.totalCharged,
            render: (order) => formatPrice(order.totalCharged),
          },
          {
            key: 'status',
            header: 'Status',
            sortable: true,
            render: (order) => (
              <span className={`rounded-full px-2.5 py-1 text-xs font-medium capitalize ${statusBadge(order.status)}`}>
                {order.status.toLowerCase()}
              </span>
            ),
          },
          {
            key: 'paymentReference',
            header: 'Reference',
            sortable: true,
            render: (order) => (
              <span className="font-mono text-xs text-slate-500">{order.paymentReference || '—'}</span>
            ),
          },
          {
            key: 'actions',
            header: 'Actions',
            searchable: false,
            sortable: false,
            className: 'text-right',
            render: (order) => (
              <Link href={`/admin/orders/${order.id}`} className="font-medium text-indigo-600 hover:text-indigo-500">
                Manage
              </Link>
            ),
          },
        ]}
      />
    </div>
  );
}
