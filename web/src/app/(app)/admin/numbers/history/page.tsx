'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { DataTable } from '@/components/data-table';
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
  return method;
}

export default function AdminNumberPurchaseHistoryPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<NumberOrder[]>([]);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [loading, setLoading] = useState(true);

  async function loadOrders(status?: string) {
    const params: { status?: string } = {};
    if (status && status !== 'ALL') params.status = status;
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
        return loadOrders(statusFilter);
      })
      .catch((err) => {
        if (isUnauthorizedError(err)) router.replace('/login');
      })
      .finally(() => setLoading(false));
  }, [router, statusFilter]);

  if (loading && !orders.length) {
    return (
      <div className="flex items-center justify-center py-24 text-slate-400">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        Loading purchase history…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <AdminPageHeader
        section="Numbers"
        title="Purchase history"
        subtitle="Number orders across all tenants — Stripe, bank transfer, and super admin direct purchases."
      />

      <DataTable
        title="All number orders"
        data={orders}
        getRowId={(order) => order.id}
        emptyMessage="No purchase orders found."
        toolbar={
          <div className="flex flex-wrap gap-2">
            {['ALL', 'FULFILLED', 'PENDING', 'PARTIAL', 'CANCELLED'].map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => {
                  setLoading(true);
                  setStatusFilter(s);
                  loadOrders(s).finally(() => setLoading(false));
                }}
                className={statusFilter === s ? 'filter-btn filter-btn-active' : 'filter-btn'}
              >
                {s === 'ALL' ? 'All' : s.charAt(0) + s.slice(1).toLowerCase()}
              </button>
            ))}
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
            key: 'numbers',
            header: 'Numbers',
            render: (order) => (
              <span className="text-xs text-slate-600">
                {Array.isArray(order.phoneNumbers) ? order.phoneNumbers.join(', ') : '—'}
              </span>
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
            key: 'actions',
            header: 'Actions',
            searchable: false,
            sortable: false,
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
