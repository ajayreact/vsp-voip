'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ClipboardList, Loader2 } from 'lucide-react';
import { DataTable } from '@/components/data-table';
import { getAdminAuditLog, getMe, isUnauthorizedError, type AdminAuditEntry } from '@/lib/api';

function formatAction(action: string) {
  return action.replace(/\./g, ' · ').replace(/_/g, ' ');
}

export default function AdminAuditPage() {
  const router = useRouter();
  const [logs, setLogs] = useState<AdminAuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    getMe()
      .then((user) => {
        if (user.role !== 'SUPER_ADMIN') {
          router.replace('/dashboard');
          return;
        }
        return getAdminAuditLog(100);
      })
      .then((res) => {
        if (res) setLogs(res.logs || []);
      })
      .catch((err) => {
        if (isUnauthorizedError(err)) {
          router.replace('/login');
          return;
        }
        setError(err instanceof Error ? err.message : 'Could not load audit log');
      })
      .finally(() => setLoading(false));
  }, [router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-slate-400">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        Loading audit log…
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-lg rounded-xl border border-red-200 bg-red-50 p-6 text-center">
        <p className="font-medium text-red-700">Audit log unavailable</p>
        <p className="mt-2 text-sm text-slate-400">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
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
            <h2 className="text-lg font-medium text-slate-900">Audit log</h2>
            <p className="text-sm text-slate-400">
              Recent super admin actions across tenants, orders, and settings.
            </p>
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-50 text-indigo-400">
            <ClipboardList className="h-5 w-5" />
          </div>
        </div>
      </div>

      <DataTable
        title="Audit log"
        data={logs}
        getRowId={(log) => log.id}
        emptyMessage="No audit entries yet. Actions will appear here as you manage the platform."
        columns={[
          {
            key: 'createdAt',
            header: 'When',
            sortable: true,
            sortValue: (log) => new Date(log.createdAt),
            render: (log) => new Date(log.createdAt).toLocaleString(),
          },
          {
            key: 'userEmail',
            header: 'Admin',
            sortable: true,
            render: (log) => log.userEmail || '—',
          },
          {
            key: 'action',
            header: 'Action',
            sortable: true,
            render: (log) => <span className="capitalize">{formatAction(log.action)}</span>,
          },
          {
            key: 'entityType',
            header: 'Entity',
            sortable: true,
            render: (log) => (
              <>
                <span className="text-slate-500">{log.entityType}</span>
                {log.entityId ? (
                  <span className="ml-1 font-mono text-xs text-slate-500">{log.entityId.slice(0, 8)}</span>
                ) : null}
              </>
            ),
          },
          {
            key: 'details',
            header: 'Details',
            sortable: false,
            render: (log) => (
              <span className="block max-w-xs truncate text-xs text-slate-500">
                {log.details ? JSON.stringify(log.details) : '—'}
              </span>
            ),
          },
        ]}
      />
    </div>
  );
}
