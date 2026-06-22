'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { ArrowLeft, DollarSign, Loader2 } from 'lucide-react';
import { DataTable } from '@/components/data-table';
import { AdminSectionNav, adminBillingTabs } from '@/components/admin-section-nav';
import { AdminPageHeader } from '@/components/admin-page-header';
import { getAdminRevenue, getMe, isUnauthorizedError, type AdminRevenueReport } from '@/lib/api';
import { formatPrice } from '@/lib/pricing';

export default function AdminRevenuePage() {
  const router = useRouter();
  const pathname = usePathname();
  const inBillingSection = pathname.startsWith('/admin/billing');
  const [report, setReport] = useState<AdminRevenueReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    getMe()
      .then((user) => {
        if (user.role !== 'SUPER_ADMIN') {
          router.replace('/dashboard');
          return;
        }
        return getAdminRevenue();
      })
      .then((res) => {
        if (res) setReport(res);
      })
      .catch((err) => {
        if (isUnauthorizedError(err)) {
          router.replace('/login');
          return;
        }
        setError(err instanceof Error ? err.message : 'Could not load revenue report');
      })
      .finally(() => setLoading(false));
  }, [router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-slate-400">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        Loading revenue report…
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-lg rounded-xl border border-red-200 bg-red-50 p-6 text-center">
        <p className="font-medium text-red-700">Revenue report unavailable</p>
        <p className="mt-2 text-sm text-slate-400">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {inBillingSection ? (
        <>
          <AdminPageHeader
            section="Billing"
            title="Revenue analytics"
            subtitle="Fulfilled and paid orders by tenant and month."
          />
          <AdminSectionNav tabs={adminBillingTabs} />
        </>
      ) : (
        <div>
          <Link
            href="/admin"
            className="mb-2 inline-flex items-center gap-1 text-sm text-slate-400 hover:text-slate-900"
          >
            <ArrowLeft className="h-4 w-4" />
            Platform overview
          </Link>
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-medium text-slate-900">Revenue report</h2>
              <p className="text-sm text-slate-400">
                Fulfilled and paid orders by tenant and month.
              </p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-50 text-indigo-400">
              <DollarSign className="h-5 w-5" />
            </div>
          </div>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="panel-card p-5">
          <p className="text-sm text-slate-500">Total revenue</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">
            {formatPrice(report?.summary.totalRevenue || 0)}
          </p>
        </div>
        <div className="panel-card p-5">
          <p className="text-sm text-slate-500">Paid orders</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">
            {report?.summary.orderCount || 0}
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <DataTable
          title="By tenant"
          data={report?.byTenant || []}
          getRowId={(row) => row.tenantId}
          defaultPageSize={10}
          emptyMessage="No revenue yet."
          columns={[
            { key: 'tenantName', header: 'Tenant', sortable: true },
            {
              key: 'orderCount',
              header: 'Orders',
              sortable: true,
              sortValue: (row) => row.orderCount,
            },
            {
              key: 'revenue',
              header: 'Revenue',
              sortable: true,
              sortValue: (row) => row.revenue,
              headerClassName: 'text-right',
              className: 'text-right',
              render: (row) => formatPrice(row.revenue),
            },
          ]}
        />

        <DataTable
          title="By month"
          data={report?.byMonth || []}
          getRowId={(row) => row.month}
          defaultPageSize={10}
          emptyMessage="No revenue yet."
          columns={[
            { key: 'month', header: 'Month', sortable: true },
            {
              key: 'orderCount',
              header: 'Orders',
              sortable: true,
              sortValue: (row) => row.orderCount,
            },
            {
              key: 'revenue',
              header: 'Revenue',
              sortable: true,
              sortValue: (row) => row.revenue,
              headerClassName: 'text-right',
              className: 'text-right',
              render: (row) => formatPrice(row.revenue),
            },
          ]}
        />
      </div>
    </div>
  );
}
