'use client';

import 'sweetalert2/dist/sweetalert2.min.css';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Loader2, Package, Plus } from 'lucide-react';
import Swal from 'sweetalert2';
import { DataTable } from '@/components/data-table';
import { KpiCard, KpiSection } from '@/components/kpi-card';
import { IconInput, SlideOverPanel } from '@/components/slide-over-panel';
import {
  createAdminPortRequest,
  getAdminPortRequests,
  getAdminTenants,
  getMe,
  isUnauthorizedError,
  updateAdminPortRequest,
  type AdminTenant,
  type PortRequest,
} from '@/lib/api';
import { SWAL_THEME } from '@/lib/swal-theme';

const STATUSES = ['ALL', 'SUBMITTED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'FAILED'] as const;

function statusClass(status: string) {
  const map: Record<string, string> = {
    SUBMITTED: 'bg-amber-50 text-amber-700 ring-amber-200',
    IN_PROGRESS: 'bg-blue-50 text-blue-700 ring-blue-200',
    COMPLETED: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
    CANCELLED: 'bg-slate-100 text-slate-600',
    FAILED: 'bg-red-50 text-red-700 ring-red-200',
    DRAFT: 'bg-slate-100 text-slate-600',
  };
  return map[status] || 'bg-slate-100 text-slate-600';
}

export default function AdminPortingPage() {
  const router = useRouter();
  const [requests, setRequests] = useState<PortRequest[]>([]);
  const [tenants, setTenants] = useState<AdminTenant[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    tenantId: '',
    phoneNumbers: '',
    currentCarrier: '',
    billingTelephoneNumber: '',
    requestedByEmail: '',
    adminNotes: '',
  });

  async function loadRequests(status = statusFilter) {
    const res = await getAdminPortRequests(status);
    setRequests(res.requests || []);
  }

  useEffect(() => {
    getMe()
      .then((user) => {
        if (user.role !== 'SUPER_ADMIN') {
          router.replace('/dashboard');
          return;
        }
        return Promise.all([loadRequests(), getAdminTenants()]);
      })
      .then((results) => {
        if (results?.[1]) setTenants(results[1].tenants || []);
      })
      .catch((err) => {
        if (isUnauthorizedError(err)) router.replace('/login');
      })
      .finally(() => setLoading(false));
  }, [router]);

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    const phoneNumbers = form.phoneNumbers
      .split(/[\n,;]+/)
      .map((n) => n.trim())
      .filter(Boolean);
    if (!form.tenantId || !phoneNumbers.length) {
      await Swal.fire({ title: 'Tenant and at least one number required', icon: 'warning', ...SWAL_THEME });
      return;
    }

    setCreating(true);
    try {
      await createAdminPortRequest({
        tenantId: form.tenantId,
        phoneNumbers,
        currentCarrier: form.currentCarrier || undefined,
        billingTelephoneNumber: form.billingTelephoneNumber || undefined,
        requestedByEmail: form.requestedByEmail || undefined,
        adminNotes: form.adminNotes || undefined,
      });
      setCreateOpen(false);
      setForm({
        tenantId: '',
        phoneNumbers: '',
        currentCarrier: '',
        billingTelephoneNumber: '',
        requestedByEmail: '',
        adminNotes: '',
      });
      await loadRequests();
      await Swal.fire({ title: 'Port request created', icon: 'success', timer: 1500, showConfirmButton: false, ...SWAL_THEME });
    } catch (err) {
      await Swal.fire({
        title: 'Create failed',
        text: err instanceof Error ? err.message : 'Could not create port request',
        icon: 'error',
        ...SWAL_THEME,
      });
    } finally {
      setCreating(false);
    }
  }

  async function onUpdateStatus(request: PortRequest, status: PortRequest['status']) {
    try {
      await updateAdminPortRequest(request.id, { status });
      await loadRequests();
    } catch (err) {
      await Swal.fire({
        title: 'Update failed',
        text: err instanceof Error ? err.message : 'Could not update status',
        icon: 'error',
        ...SWAL_THEME,
      });
    }
  }

  const openCount = requests.filter((r) => r.status === 'SUBMITTED' || r.status === 'IN_PROGRESS').length;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-slate-400">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        Loading port requests…
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href="/admin/inventory" className="mb-2 inline-flex items-center gap-1 text-sm text-slate-400 hover:text-slate-900">
            <ArrowLeft className="h-4 w-4" />
            DID number pool
          </Link>
          <h2 className="page-title">Number porting (LNP)</h2>
          <p className="page-subtitle">Track local number portability requests from tenants to Telnyx.</p>
        </div>
        <button type="button" onClick={() => setCreateOpen(true)} className="btn-primary px-4 py-2 text-sm">
          <Plus className="h-4 w-4" />
          New port request
        </button>
      </div>

      <KpiSection title="Porting pipeline">
        <KpiCard title="Open requests" value={openCount} subtitle="Submitted or in progress" icon={Package} tone="amber" />
        <KpiCard title="Total tracked" value={requests.length} icon={Package} tone="indigo" />
        <KpiCard
          title="Completed"
          value={requests.filter((r) => r.status === 'COMPLETED').length}
          icon={Package}
          tone="emerald"
        />
      </KpiSection>

      <div className="flex flex-wrap gap-2">
        {STATUSES.map((status) => (
          <button
            key={status}
            type="button"
            onClick={() => {
              setStatusFilter(status);
              setLoading(true);
              loadRequests(status).finally(() => setLoading(false));
            }}
            className={`rounded-lg px-3 py-1.5 text-sm ${
              statusFilter === status ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {status === 'ALL' ? 'All' : status.replace(/_/g, ' ')}
          </button>
        ))}
      </div>

      <DataTable
        title="Port requests"
        data={requests}
        getRowId={(r) => r.id}
        emptyMessage="No port requests yet"
        columns={[
          {
            key: 'createdAt',
            header: 'Created',
            sortable: true,
            render: (r) => new Date(r.createdAt).toLocaleString(),
          },
          { key: 'tenantName', header: 'Tenant', sortable: true },
          {
            key: 'phoneNumbers',
            header: 'Numbers',
            render: (r) => r.phoneNumbers.join(', '),
          },
          { key: 'currentCarrier', header: 'Losing carrier', sortable: true, render: (r) => r.currentCarrier || '—' },
          {
            key: 'status',
            header: 'Status',
            sortable: true,
            render: (r) => (
              <span className={`rounded-full px-2.5 py-1 text-xs font-medium ring-1 ${statusClass(r.status)}`}>
                {r.status.replace(/_/g, ' ')}
              </span>
            ),
          },
          {
            key: 'actions',
            header: 'Actions',
            searchable: false,
            sortable: false,
            className: 'text-right',
            render: (r) => (
              <select
                value={r.status}
                onChange={(e) => onUpdateStatus(r, e.target.value as PortRequest['status'])}
                className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs"
              >
                {STATUSES.filter((s) => s !== 'ALL').map((s) => (
                  <option key={s} value={s}>
                    {s.replace(/_/g, ' ')}
                  </option>
                ))}
              </select>
            ),
          },
        ]}
      />

      <SlideOverPanel
        open={createOpen}
        onClose={() => !creating && setCreateOpen(false)}
        title="New port request"
        footer={
          <div className="flex gap-3">
            <button type="submit" form="port-request-form" disabled={creating} className="btn-primary px-5 py-2.5 text-sm">
              {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Create request
            </button>
            <button type="button" onClick={() => setCreateOpen(false)} disabled={creating} className="btn-secondary px-5 py-2.5 text-sm">
              Cancel
            </button>
          </div>
        }
      >
        <form id="port-request-form" onSubmit={onCreate} className="space-y-4">
          <label className="block text-sm">
            <span className="mb-1.5 block text-slate-600">Tenant</span>
            <select
              value={form.tenantId}
              onChange={(e) => setForm((f) => ({ ...f, tenantId: e.target.value }))}
              className="w-full rounded-lg input-field"
              required
            >
              <option value="">Select tenant…</option>
              {tenants.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="mb-1.5 block text-slate-600">Numbers to port (one per line)</span>
            <textarea
              value={form.phoneNumbers}
              onChange={(e) => setForm((f) => ({ ...f, phoneNumbers: e.target.value }))}
              rows={4}
              placeholder="+15551234567&#10;+15559876543"
              className="w-full rounded-lg input-field"
              required
            />
          </label>
          <IconInput
            icon={Package}
            value={form.currentCarrier}
            onChange={(e) => setForm((f) => ({ ...f, currentCarrier: e.target.value }))}
            placeholder="Current carrier (e.g. AT&T)"
          />
          <IconInput
            icon={Package}
            value={form.billingTelephoneNumber}
            onChange={(e) => setForm((f) => ({ ...f, billingTelephoneNumber: e.target.value }))}
            placeholder="Billing telephone number (BTN)"
          />
          <IconInput
            icon={Package}
            type="email"
            value={form.requestedByEmail}
            onChange={(e) => setForm((f) => ({ ...f, requestedByEmail: e.target.value }))}
            placeholder="Tenant contact email"
          />
          <label className="block text-sm">
            <span className="mb-1.5 block text-slate-600">Admin notes</span>
            <textarea
              value={form.adminNotes}
              onChange={(e) => setForm((f) => ({ ...f, adminNotes: e.target.value }))}
              rows={3}
              className="w-full rounded-lg input-field"
            />
          </label>
        </form>
      </SlideOverPanel>
    </div>
  );
}
