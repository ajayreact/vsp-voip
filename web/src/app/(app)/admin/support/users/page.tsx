'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Users } from 'lucide-react';
import { DataTable } from '@/components/data-table';
import { KpiCard, KpiSection } from '@/components/kpi-card';
import { AdminPageHeader } from '@/components/admin-page-header';
import { getAdminSecurity, getMe, isUnauthorizedError, type SecurityReport } from '@/lib/api';

export default function AdminSupportUsersPage() {
  const router = useRouter();
  const [report, setReport] = useState<SecurityReport | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getMe()
      .then((user) => {
        if (user.role !== 'SUPER_ADMIN') {
          router.replace('/dashboard');
          return;
        }
        return getAdminSecurity();
      })
      .then((res) => {
        if (res) setReport(res.report);
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
        Loading users…
      </div>
    );
  }

  if (!report) return null;

  return (
    <div className="space-y-8">
      <AdminPageHeader
        section="Support"
        title="User management"
        subtitle="Cross-tenant user directory and role assignments."
      />

      <KpiSection title="Role distribution">
        <KpiCard title="Total users" value={report.summary.totalUsers} icon={Users} tone="indigo" />
        <KpiCard title="Tenant admins" value={report.summary.tenantAdmins} icon={Users} tone="violet" />
        <KpiCard title="Tenant users" value={report.summary.tenantUsers} icon={Users} tone="sky" />
      </KpiSection>

      <DataTable
        title="All platform users"
        data={report.users}
        getRowId={(u) => u.id}
        defaultPageSize={15}
        columns={[
          { key: 'name', header: 'Name', sortable: true },
          { key: 'email', header: 'Email', sortable: true },
          {
            key: 'role',
            header: 'Role',
            sortable: true,
            render: (u) => (
              <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-700">
                {u.role.replace(/_/g, ' ')}
              </span>
            ),
          },
          { key: 'tenantName', header: 'Organization', sortable: true },
          {
            key: 'createdAt',
            header: 'Created',
            sortable: true,
            render: (u) => new Date(u.createdAt).toLocaleDateString(),
          },
          {
            key: 'actions',
            header: '',
            searchable: false,
            sortable: false,
            render: (u) =>
              u.tenantId ? (
                <Link href={`/admin/tenants/${u.tenantId}`} className="text-indigo-600 hover:text-indigo-500">
                  Tenant
                </Link>
              ) : null,
          },
        ]}
      />
    </div>
  );
}
