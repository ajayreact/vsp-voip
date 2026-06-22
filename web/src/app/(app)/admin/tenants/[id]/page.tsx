'use client';

import 'sweetalert2/dist/sweetalert2.min.css';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Loader2, Plus, Save, UserPlus, Ban, CheckCircle2 } from 'lucide-react';
import Swal from 'sweetalert2';
import { DataTable } from '@/components/data-table';
import {
  createTenantUser,
  getAdminTenant,
  getMe,
  updateAdminTenant,
  updateTenantBilling,
  updateTenantStatus,
} from '@/lib/api';
import { formatPrice } from '@/lib/pricing';
import { SWAL_THEME } from '@/lib/swal-theme';

type TenantDetail = Awaited<ReturnType<typeof getAdminTenant>>['tenant'];

export default function AdminTenantDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [tenant, setTenant] = useState<TenantDetail | null>(null);
  const [tenantName, setTenantName] = useState('');
  const [setup, setSetup] = useState('0');
  const [firstMonth, setFirstMonth] = useState('');
  const [monthly, setMonthly] = useState('8');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [statusUpdating, setStatusUpdating] = useState(false);

  async function reload() {
    const res = await getAdminTenant(id);
    setTenant(res.tenant);
    setTenantName(res.tenant.name);
    setSetup(String(res.tenant.platformFeeSetup));
    setMonthly(String(res.tenant.platformFeeMonthly));
    setFirstMonth(
      res.tenant.platformFeeFirstMonth != null
        ? String(res.tenant.platformFeeFirstMonth)
        : '',
    );
  }

  useEffect(() => {
    getMe()
      .then((user) => {
        if (user.role !== 'SUPER_ADMIN') {
          router.replace('/dashboard');
          return;
        }
        return reload();
      })
      .catch(() => router.replace('/admin/tenants'))
      .finally(() => setLoading(false));
  }, [id, router]);

  async function onSaveName() {
    if (!tenantName.trim()) return;
    setSaving(true);
    try {
      await updateAdminTenant(id, { name: tenantName.trim() });
      await reload();
      await Swal.fire({
        title: 'Saved',
        text: 'Tenant name updated.',
        icon: 'success',
        timer: 1500,
        showConfirmButton: false,
        ...SWAL_THEME,
      });
    } catch (err) {
      await Swal.fire({
        title: 'Save failed',
        text: err instanceof Error ? err.message : 'Could not update tenant',
        icon: 'error',
        ...SWAL_THEME,
      });
    } finally {
      setSaving(false);
    }
  }

  async function onToggleStatus() {
    if (!tenant) return;
    const suspend = tenant.isActive !== false;
    const result = await Swal.fire({
      title: suspend ? 'Suspend tenant?' : 'Activate tenant?',
      text: suspend
        ? `${tenant.name} users cannot log in or place orders until reactivated.`
        : `${tenant.name} will be able to use the portal again.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: suspend ? 'Suspend' : 'Activate',
      ...SWAL_THEME,
    });
    if (!result.isConfirmed) return;

    setStatusUpdating(true);
    try {
      await updateTenantStatus(id, !suspend);
      await reload();
    } catch (err) {
      await Swal.fire({
        title: 'Update failed',
        text: err instanceof Error ? err.message : 'Could not update status',
        icon: 'error',
        ...SWAL_THEME,
      });
    } finally {
      setStatusUpdating(false);
    }
  }

  async function onSaveBilling() {
    setSaving(true);
    try {
      const res = await updateTenantBilling(id, {
        platformFeeSetup: Number(setup) || 0,
        platformFeeMonthly: Number(monthly) || 0,
        platformFeeFirstMonth: firstMonth === '' ? null : Number(firstMonth),
      });
      setTenant((prev) => (prev ? { ...prev, ...res.tenant } : prev));
      await Swal.fire({
        title: 'Billing updated',
        text: 'New rates apply to the next checkout for this tenant.',
        icon: 'success',
        timer: 2000,
        showConfirmButton: false,
        ...SWAL_THEME,
      });
    } catch (err) {
      await Swal.fire({
        title: 'Save failed',
        text: err instanceof Error ? err.message : 'Could not update billing',
        icon: 'error',
        ...SWAL_THEME,
      });
    } finally {
      setSaving(false);
    }
  }

  async function onAddUser() {
    const result = await Swal.fire({
      title: 'Add tenant user',
      html: `
        <input id="user-name" class="swal2-input" placeholder="Full name" />
        <input id="user-email" class="swal2-input" type="email" placeholder="Email" />
        <input id="user-password" class="swal2-input" type="password" placeholder="Temporary password" />
        <select id="user-role" class="swal2-input">
          <option value="TENANT_ADMIN">Tenant admin</option>
          <option value="TENANT_USER">Tenant user</option>
        </select>
      `,
      focusConfirm: false,
      showCancelButton: true,
      confirmButtonText: 'Create user',
      preConfirm: () => {
        const name = (document.getElementById('user-name') as HTMLInputElement)?.value?.trim();
        const email = (document.getElementById('user-email') as HTMLInputElement)?.value?.trim();
        const password = (document.getElementById('user-password') as HTMLInputElement)?.value;
        const role = (document.getElementById('user-role') as HTMLSelectElement)?.value;
        if (!name || !email || !password) {
          Swal.showValidationMessage('Name, email, and password are required');
          return false;
        }
        if (password.length < 6) {
          Swal.showValidationMessage('Password must be at least 6 characters');
          return false;
        }
        return { name, email, password, role };
      },
      ...SWAL_THEME,
    });

    if (!result.isConfirmed || !result.value) return;

    try {
      await createTenantUser(id, result.value);
      await reload();
      await Swal.fire({
        title: 'User created',
        text: `${result.value.email} can now sign in to the tenant portal.`,
        icon: 'success',
        ...SWAL_THEME,
      });
    } catch (err) {
      await Swal.fire({
        title: 'Could not create user',
        text: err instanceof Error ? err.message : 'Unknown error',
        icon: 'error',
        ...SWAL_THEME,
      });
    }
  }

  if (loading || !tenant) {
    return (
      <div className="flex items-center justify-center py-24 text-slate-400">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        Loading tenant…
      </div>
    );
  }

  const isActive = tenant.isActive !== false;
  const effectiveFirstMonth = firstMonth === '' ? Number(monthly) : Number(firstMonth);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link
          href="/admin/tenants"
          className="mb-2 inline-flex items-center gap-1 text-sm text-slate-400 hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" />
          All tenants
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-medium text-slate-900">{tenant.name}</h2>
            <p className="text-sm text-slate-400">
              {isActive ? (
                <span className="text-indigo-400">Active</span>
              ) : (
                <span className="text-amber-400">Suspended</span>
              )}
              {' · '}Billing, users, and phone numbers
            </p>
          </div>
          <button
            type="button"
            onClick={onToggleStatus}
            disabled={statusUpdating}
            className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${
              isActive
                ? 'border border-amber-500/30 text-amber-400 hover:bg-amber-500/10'
                : 'border border-indigo-500/30 text-indigo-400 hover:bg-indigo-50'
            }`}
          >
            {statusUpdating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : isActive ? (
              <Ban className="h-4 w-4" />
            ) : (
              <CheckCircle2 className="h-4 w-4" />
            )}
            {isActive ? 'Suspend tenant' : 'Activate tenant'}
          </button>
        </div>
      </div>

      <div className="panel-card p-6 space-y-4">
        <h3 className="font-medium text-slate-900">Organization</h3>
        <label className="block">
          <span className="mb-1.5 block text-sm text-slate-700">Company name</span>
          <input
            type="text"
            value={tenantName}
            onChange={(e) => setTenantName(e.target.value)}
            className="w-full rounded-lg input-field"
          />
        </label>
        <button
          type="button"
          onClick={onSaveName}
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-100"
        >
          <Save className="h-4 w-4" />
          Save name
        </button>
      </div>

      <div className="panel-card p-6 space-y-5">
        <h3 className="font-medium text-slate-900">Platform fees (per phone number)</h3>
        <p className="text-sm text-slate-400">
          Carrier costs come from Telnyx search results. These fields are your VSP-VOIP markup charged on top.
        </p>

        <div className="grid gap-4 sm:grid-cols-3">
          <label className="block">
            <span className="mb-1.5 block text-sm text-slate-700">Setup (one-time)</span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={setup}
              onChange={(e) => setSetup(e.target.value)}
              className="w-full rounded-lg input-field"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm text-slate-700">First month</span>
            <input
              type="number"
              min="0"
              step="0.01"
              placeholder={`Same as recurring (${monthly})`}
              value={firstMonth}
              onChange={(e) => setFirstMonth(e.target.value)}
              className="w-full rounded-lg input-field placeholder:text-slate-600"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm text-slate-700">Recurring monthly</span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={monthly}
              onChange={(e) => setMonthly(e.target.value)}
              className="w-full rounded-lg input-field"
            />
          </label>
        </div>

        <div className="rounded-lg bg-white/50 px-4 py-3 text-sm text-slate-400">
          Example for one number: due today includes carrier upfront + first carrier month + setup + first-month
          platform fee ({formatPrice(effectiveFirstMonth)}). Then{' '}
          {formatPrice(Number(monthly) || 0)}/mo platform fee plus carrier monthly.
        </div>

        <button
          type="button"
          onClick={onSaveBilling}
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-lg bg-indigo-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-400 disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save billing rates
        </button>
      </div>

      <DataTable
        title={`Users (${tenant.users?.length ?? 0})`}
        data={tenant.users || []}
        getRowId={(user) => user.id}
        emptyMessage="No users yet — add a tenant admin to get started."
        action={
          <button
            type="button"
            onClick={onAddUser}
            className="btn-primary px-3 py-1.5 text-sm"
          >
            <UserPlus className="h-4 w-4" />
            Add new record
          </button>
        }
        columns={[
          { key: 'name', header: 'Name', sortable: true },
          { key: 'email', header: 'Email', sortable: true },
          { key: 'role', header: 'Role', sortable: true },
        ]}
      />

      <DataTable
        title={`Phone numbers (${tenant.phoneNumbers?.length ?? 0})`}
        data={tenant.phoneNumbers || []}
        getRowId={(num) => num.id}
        emptyMessage="No numbers assigned yet"
        columns={[
          {
            key: 'number',
            header: 'Number',
            sortable: true,
            render: (num) => <span className="font-medium text-slate-900">{num.number}</span>,
          },
          {
            key: 'tenantMonthlyTotal',
            header: 'Monthly total',
            sortable: true,
            sortValue: (num) => num.tenantMonthlyTotal ?? 0,
            render: (num) =>
              num.tenantMonthlyTotal != null ? formatPrice(num.tenantMonthlyTotal) : '—',
          },
        ]}
      />
    </div>
  );
}
