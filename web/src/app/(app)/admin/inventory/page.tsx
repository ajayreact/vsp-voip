'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Hash, Loader2, Phone } from 'lucide-react';
import { DataTable } from '@/components/data-table';
import { KpiCard, KpiSection } from '@/components/kpi-card';
import { getAdminTenants, getMe, isUnauthorizedError, type AdminTenant } from '@/lib/api';

export default function AdminInventoryPage() {
  const router = useRouter();
  const [tenants, setTenants] = useState<AdminTenant[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getMe()
      .then((user) => {
        if (user.role !== 'SUPER_ADMIN') {
          router.replace('/dashboard');
          return;
        }
        return getAdminTenants();
      })
      .then((res) => {
        if (res) setTenants(res.tenants || []);
      })
      .catch((err) => {
        if (isUnauthorizedError(err)) router.replace('/login');
      })
      .finally(() => setLoading(false));
  }, [router]);

  const assignedNumbers = tenants.reduce((sum, t) => sum + t.numberCount, 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-slate-500">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        Loading inventory…
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="page-title">DID number pool</h2>
        <p className="page-subtitle">
          Warehouse view of assigned numbers across tenants. Wholesale Telnyx search is on the tenant buy-numbers flow.
        </p>
      </div>

      <KpiSection title="Inventory snapshot">
        <KpiCard
          title="Assigned DIDs"
          value={assignedNumbers}
          subtitle="Live on tenant accounts"
          icon={Phone}
          tone="indigo"
        />
        <KpiCard
          title="Active tenants with numbers"
          value={tenants.filter((t) => t.numberCount > 0).length}
          subtitle={`${tenants.length} total tenant records`}
          icon={Hash}
          tone="violet"
        />
        <KpiCard
          title="Wholesale pool"
          value="Telnyx"
          subtitle="Search & purchase via tenant portal → Buy Numbers"
          icon={Hash}
          tone="sky"
          badge="External"
        />
      </KpiSection>

      <DataTable
        title="Tenant number allocation"
        data={tenants}
        getRowId={(t) => t.id}
        emptyMessage="No tenants yet."
        columns={[
          {
            key: 'name',
            header: 'Tenant',
            sortable: true,
            render: (t) => <span className="font-medium text-slate-900">{t.name}</span>,
          },
          {
            key: 'numberCount',
            header: 'Numbers',
            sortable: true,
            sortValue: (t) => t.numberCount,
          },
          {
            key: 'userCount',
            header: 'Users',
            sortable: true,
            sortValue: (t) => t.userCount,
          },
          {
            key: 'status',
            header: 'Status',
            sortable: true,
            render: (t) => (
              <span
                className={
                  t.isActive !== false
                    ? 'rounded-full bg-emerald-50 px-2 py-1 text-xs text-emerald-700'
                    : 'rounded-full bg-amber-50 px-2 py-1 text-xs text-amber-700'
                }
              >
                {t.isActive !== false ? 'Active' : 'Suspended'}
              </span>
            ),
          },
          {
            key: 'actions',
            header: 'Actions',
            searchable: false,
            sortable: false,
            className: 'text-right',
            render: (t) => (
              <Link href={`/admin/tenants/${t.id}`} className="text-indigo-600 hover:text-indigo-500">
                Manage
              </Link>
            ),
          },
        ]}
      />
    </div>
  );
}
