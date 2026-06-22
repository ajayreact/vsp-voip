'use client';

import 'sweetalert2/dist/sweetalert2.min.css';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Building2, Calendar, DollarSign, Loader2, Lock, Mail, Plus, Shield, User } from 'lucide-react';
import Swal from 'sweetalert2';
import { DataTable } from '@/components/data-table';
import { IconInput, SlideOverPanel } from '@/components/slide-over-panel';
import {
  ApiError,
  createAdminTenant,
  cleanupEmptyTenants,
  getAdminTenants,
  getMe,
  isUnauthorizedError,
  updateTenantStatus,
  type AdminTenant,
} from '@/lib/api';
import { formatPrice } from '@/lib/pricing';
import { SWAL_THEME } from '@/lib/swal-theme';

export default function AdminTenantsPage() {
  const router = useRouter();
  const [tenants, setTenants] = useState<AdminTenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');
  const [form, setForm] = useState({
    name: '',
    platformFeeSetup: '0',
    platformFeeFirstMonth: '',
    platformFeeMonthly: '8',
    adminName: '',
    adminEmail: '',
    adminPassword: '',
  });

  async function loadTenants() {
    const list = await getAdminTenants();
    setTenants(list.tenants || []);
  }

  useEffect(() => {
    getMe()
      .then((user) => {
        if (user.role !== 'SUPER_ADMIN') {
          router.replace('/dashboard');
          return;
        }
        return loadTenants();
      })
      .catch((err) => {
        if (isUnauthorizedError(err)) router.replace('/login');
      })
      .finally(() => setLoading(false));
  }, [router]);

  function openCreatePanel() {
    setForm({
      name: '',
      platformFeeSetup: '0',
      platformFeeFirstMonth: '',
      platformFeeMonthly: '8',
      adminName: '',
      adminEmail: '',
      adminPassword: '',
    });
    setCreateError('');
    setCreateOpen(true);
  }

  function closeCreatePanel() {
    if (creating) return;
    setCreateOpen(false);
    setCreateError('');
  }

  async function onSubmitCreate(e: React.FormEvent) {
    e.preventDefault();
    const name = form.name.trim();
    const adminName = form.adminName.trim();
    const adminEmail = form.adminEmail.trim();
    const adminPassword = form.adminPassword;

    if (!name) {
      setCreateError('Company name is required');
      return;
    }
    if (!adminName || !adminEmail || !adminPassword) {
      setCreateError('Tenant admin name, email, and password are required');
      return;
    }
    if (adminPassword.length < 6) {
      setCreateError('Tenant admin password must be at least 6 characters');
      return;
    }

    const payload = {
      name,
      platformFeeSetup: form.platformFeeSetup ? Number(form.platformFeeSetup) : 0,
      platformFeeFirstMonth: form.platformFeeFirstMonth ? Number(form.platformFeeFirstMonth) : null,
      platformFeeMonthly: form.platformFeeMonthly ? Number(form.platformFeeMonthly) : 8,
      adminName,
      adminEmail,
      adminPassword,
    };

    setCreating(true);
    setCreateError('');
    try {
      const res = await createAdminTenant(payload);
      await loadTenants();
      setCreateOpen(false);
      await Swal.fire({
        title: 'Tenant created',
        text: res.adminUser
          ? `${payload.name} is ready. ${res.adminUser.email} can sign in with the password you set.`
          : `${payload.name} is ready. Open it to add users and adjust billing.`,
        icon: 'success',
        ...SWAL_THEME,
      });
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Could not create tenant');
    } finally {
      setCreating(false);
    }
  }

  async function onToggleStatus(tenant: AdminTenant) {
    const suspend = tenant.isActive !== false;
    const result = await Swal.fire({
      title: suspend ? 'Suspend tenant?' : 'Activate tenant?',
      text: suspend
        ? `${tenant.name} users cannot log in or order until reactivated.`
        : `${tenant.name} will be restored.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: suspend ? 'Suspend' : 'Activate',
      ...SWAL_THEME,
    });
    if (!result.isConfirmed) return;

    try {
      await updateTenantStatus(tenant.id, !suspend);
      await loadTenants();
    } catch (err) {
      await Swal.fire({
        title: 'Update failed',
        text: err instanceof Error ? err.message : 'Could not update status',
        icon: 'error',
        ...SWAL_THEME,
      });
    }
  }

  async function onCleanupEmptyTenants() {
    const emptyCount = tenants.filter((t) => t.userCount === 0 && t.numberCount === 0).length;
    if (!emptyCount) return;

    const result = await Swal.fire({
      title: 'Remove empty duplicates?',
      text: `${emptyCount} tenant record(s) have no users and no phone numbers. This keeps your real tenant and deletes the extras.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Remove duplicates',
      ...SWAL_THEME,
    });
    if (!result.isConfirmed) return;

    try {
      const res = await cleanupEmptyTenants();
      await loadTenants();
      await Swal.fire({
        title: 'Cleanup complete',
        text: res.message,
        icon: 'success',
        ...SWAL_THEME,
      });
    } catch (err) {
      const message =
        err instanceof ApiError && err.status === 404
          ? 'Cleanup API not found. Restart the API server (stop port 3000, then run npm run dev:api) and try again.'
          : err instanceof Error
            ? err.message
            : 'Could not remove duplicates';
      await Swal.fire({
        title: 'Cleanup failed',
        text: message,
        icon: 'error',
        ...SWAL_THEME,
      });
    }
  }

  const emptyDuplicateCount = tenants.filter((t) => t.userCount === 0 && t.numberCount === 0).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-slate-400">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        Loading tenants…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 text-sm text-indigo-400">
            <Shield className="h-4 w-4" />
            Super admin
          </div>
          <h2 className="text-lg font-medium text-slate-900">Tenants & billing</h2>
          <p className="text-sm text-slate-400">
            Set per-tenant setup, first-month, and recurring platform fees. Stripe subscriptions renew automatically.
          </p>
        </div>
      </div>

      {emptyDuplicateCount > 0 ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-4">
          <p className="text-sm text-amber-900">
            {emptyDuplicateCount} empty duplicate tenant record{emptyDuplicateCount === 1 ? '' : 's'} found
            (same name, no users or numbers). You only need one real tenant.
          </p>
          <button
            type="button"
            onClick={onCleanupEmptyTenants}
            className="mt-3 btn-secondary px-3 py-1.5 text-sm"
          >
            Remove empty duplicates
          </button>
        </div>
      ) : null}

      <DataTable
        title="Tenant directory"
        data={tenants}
        getRowId={(tenant) => tenant.id}
        emptyMessage="No tenants yet. Create one to get started."
        action={
          <button type="button" onClick={openCreatePanel} className="btn-primary px-3 py-1.5 text-sm">
            <Plus className="h-4 w-4" />
            Add new record
          </button>
        }
        columns={[
          {
            key: 'name',
            header: 'Tenant',
            sortable: true,
            render: (tenant) => <span className="font-medium text-slate-900">{tenant.name}</span>,
          },
          {
            key: 'status',
            header: 'Status',
            sortable: true,
            sortValue: (tenant) => (tenant.isActive !== false ? 'active' : 'suspended'),
            render: (tenant) =>
              tenant.isActive !== false ? (
                <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 ring-1 ring-emerald-200">
                  Active
                </span>
              ) : (
                <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700 ring-1 ring-amber-200">
                  Suspended
                </span>
              ),
          },
          {
            key: 'platformFeeSetup',
            header: 'Setup / number',
            sortable: true,
            sortValue: (tenant) => tenant.platformFeeSetup,
            render: (tenant) => formatPrice(tenant.platformFeeSetup),
          },
          {
            key: 'platformFeeFirstMonth',
            header: 'First month',
            sortable: true,
            sortValue: (tenant) => tenant.platformFeeFirstMonth ?? tenant.platformFeeMonthly,
            render: (tenant) => formatPrice(tenant.platformFeeFirstMonth ?? tenant.platformFeeMonthly),
          },
          {
            key: 'platformFeeMonthly',
            header: 'Recurring / mo',
            sortable: true,
            sortValue: (tenant) => tenant.platformFeeMonthly,
            render: (tenant) => formatPrice(tenant.platformFeeMonthly),
          },
          {
            key: 'numberCount',
            header: 'Numbers',
            sortable: true,
            sortValue: (tenant) => tenant.numberCount,
          },
          {
            key: 'userCount',
            header: 'Users',
            sortable: true,
            sortValue: (tenant) => tenant.userCount,
          },
          {
            key: 'actions',
            header: 'Actions',
            searchable: false,
            sortable: false,
            className: 'text-right',
            render: (tenant) => (
              <div className="space-x-3">
                <button
                  type="button"
                  onClick={() => onToggleStatus(tenant)}
                  className="text-xs font-medium text-slate-500 hover:text-slate-900"
                >
                  {tenant.isActive !== false ? 'Suspend' : 'Activate'}
                </button>
                <Link href={`/admin/tenants/${tenant.id}`} className="font-medium text-indigo-600 hover:text-indigo-500">
                  Manage
                </Link>
              </div>
            ),
          },
        ]}
      />

      <SlideOverPanel
        open={createOpen}
        onClose={closeCreatePanel}
        title="New Record"
        footer={
          <div className="flex items-center gap-3">
            <button
              type="submit"
              form="create-tenant-form"
              disabled={creating}
              className="btn-primary px-5 py-2.5 text-sm disabled:opacity-60"
            >
              {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Add tenant
            </button>
            <button
              type="button"
              onClick={closeCreatePanel}
              disabled={creating}
              className="btn-secondary px-5 py-2.5 text-sm disabled:opacity-60"
            >
              Cancel
            </button>
          </div>
        }
      >
        <form id="create-tenant-form" onSubmit={onSubmitCreate} className="space-y-4">
          <IconInput
            icon={Building2}
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="Company name"
            autoFocus
          />
          <IconInput
            icon={DollarSign}
            inputMode="decimal"
            value={form.platformFeeSetup}
            onChange={(e) => setForm((f) => ({ ...f, platformFeeSetup: e.target.value }))}
            placeholder="Setup fee per number"
          />
          <IconInput
            icon={Calendar}
            inputMode="decimal"
            value={form.platformFeeFirstMonth}
            onChange={(e) => setForm((f) => ({ ...f, platformFeeFirstMonth: e.target.value }))}
            placeholder="First month platform fee"
          />
          <IconInput
            icon={DollarSign}
            inputMode="decimal"
            value={form.platformFeeMonthly}
            onChange={(e) => setForm((f) => ({ ...f, platformFeeMonthly: e.target.value }))}
            placeholder="Recurring monthly fee"
          />

          <div className="border-t border-slate-200 pt-4">
            <p className="mb-3 text-sm font-medium text-slate-900">Tenant admin login</p>
            <p className="mb-3 text-xs text-slate-500">
              This user signs in at the portal to buy numbers and manage the company.
            </p>
            <div className="space-y-3">
              <IconInput
                icon={User}
                value={form.adminName}
                onChange={(e) => setForm((f) => ({ ...f, adminName: e.target.value }))}
                placeholder="Admin full name"
              />
              <IconInput
                icon={Mail}
                type="email"
                value={form.adminEmail}
                onChange={(e) => setForm((f) => ({ ...f, adminEmail: e.target.value }))}
                placeholder="Admin email"
              />
              <IconInput
                icon={Lock}
                type="password"
                value={form.adminPassword}
                onChange={(e) => setForm((f) => ({ ...f, adminPassword: e.target.value }))}
                placeholder="Temporary password (min 6 characters)"
              />
            </div>
          </div>

          {createError ? <p className="text-sm text-red-600">{createError}</p> : null}
        </form>
      </SlideOverPanel>
    </div>
  );
}
