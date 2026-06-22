'use client';

import 'sweetalert2/dist/sweetalert2.min.css';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Loader2, Save, Users } from 'lucide-react';
import Swal from 'sweetalert2';
import { DataTable } from '@/components/data-table';
import { KpiCard, KpiSection } from '@/components/kpi-card';
import {
  getAdminQuotas,
  getMe,
  isUnauthorizedError,
  updateAdminQuotaDefaults,
  updateTenantQuotas,
  type QuotaTenantRow,
} from '@/lib/api';
import { SWAL_THEME } from '@/lib/swal-theme';

function UsageBar({ percent, overLimit }: { percent: number; overLimit?: boolean }) {
  return (
    <div className="h-2 w-full rounded-full bg-slate-100">
      <div
        className={`h-2 rounded-full ${overLimit || percent >= 90 ? 'bg-rose-500' : percent >= 70 ? 'bg-amber-500' : 'bg-emerald-500'}`}
        style={{ width: `${Math.min(100, percent)}%` }}
      />
    </div>
  );
}

export default function AdminQuotasPage() {
  const router = useRouter();
  const [tenants, setTenants] = useState<QuotaTenantRow[]>([]);
  const [defaults, setDefaults] = useState({ maxUsers: 25, maxPhoneNumbers: 20, maxConcurrentCalls: 5 });
  const [draftDefaults, setDraftDefaults] = useState(defaults);
  const [drafts, setDrafts] = useState<Record<string, { maxUsers: string; maxPhoneNumbers: string; maxConcurrentCalls: string }>>({});
  const [loading, setLoading] = useState(true);
  const [savingDefaults, setSavingDefaults] = useState(false);
  const [savingTenantId, setSavingTenantId] = useState<string | null>(null);

  async function load() {
    const res = await getAdminQuotas();
    setTenants(res.tenants || []);
    setDefaults(res.defaults);
    setDraftDefaults(res.defaults);
    setDrafts(
      Object.fromEntries(
        (res.tenants || []).map((t) => [
          t.id,
          {
            maxUsers: t.customMaxUsers != null ? String(t.customMaxUsers) : '',
            maxPhoneNumbers: t.customMaxPhoneNumbers != null ? String(t.customMaxPhoneNumbers) : '',
            maxConcurrentCalls: t.customMaxConcurrentCalls != null ? String(t.customMaxConcurrentCalls) : '',
          },
        ]),
      ),
    );
  }

  useEffect(() => {
    getMe()
      .then((user) => {
        if (user.role !== 'SUPER_ADMIN') {
          router.replace('/dashboard');
          return;
        }
        return load();
      })
      .catch((err) => {
        if (isUnauthorizedError(err)) router.replace('/login');
      })
      .finally(() => setLoading(false));
  }, [router]);

  async function onSaveDefaults() {
    setSavingDefaults(true);
    try {
      const res = await updateAdminQuotaDefaults({
        defaultMaxUsers: Number(draftDefaults.maxUsers) || 25,
        defaultMaxPhoneNumbers: Number(draftDefaults.maxPhoneNumbers) || 20,
        defaultMaxConcurrentCalls: Number(draftDefaults.maxConcurrentCalls) || 5,
      });
      setTenants(res.tenants || []);
      setDefaults(res.defaults);
      await Swal.fire({ title: 'Defaults saved', icon: 'success', timer: 1500, showConfirmButton: false, ...SWAL_THEME });
    } catch (err) {
      await Swal.fire({
        title: 'Save failed',
        text: err instanceof Error ? err.message : 'Could not save defaults',
        icon: 'error',
        ...SWAL_THEME,
      });
    } finally {
      setSavingDefaults(false);
    }
  }

  async function onSaveTenant(tenantId: string) {
    const draft = drafts[tenantId];
    if (!draft) return;
    setSavingTenantId(tenantId);
    try {
      const res = await updateTenantQuotas(tenantId, {
        maxUsers: draft.maxUsers === '' ? null : Number(draft.maxUsers),
        maxPhoneNumbers: draft.maxPhoneNumbers === '' ? null : Number(draft.maxPhoneNumbers),
        maxConcurrentCalls: draft.maxConcurrentCalls === '' ? null : Number(draft.maxConcurrentCalls),
      });
      setTenants(res.tenants || []);
      await Swal.fire({ title: 'Tenant quotas saved', icon: 'success', timer: 1500, showConfirmButton: false, ...SWAL_THEME });
    } catch (err) {
      await Swal.fire({
        title: 'Save failed',
        text: err instanceof Error ? err.message : 'Could not save tenant quotas',
        icon: 'error',
        ...SWAL_THEME,
      });
    } finally {
      setSavingTenantId(null);
    }
  }

  const overLimitCount = tenants.filter((t) => t.overLimit).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-slate-400">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        Loading quotas…
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <Link href="/admin/tenants" className="mb-2 inline-flex items-center gap-1 text-sm text-slate-400 hover:text-slate-900">
          <ArrowLeft className="h-4 w-4" />
          Company directory
        </Link>
        <h2 className="page-title">Resource quotas</h2>
        <p className="page-subtitle">
          Platform defaults and per-tenant limits for users, phone numbers, and concurrent calls.
        </p>
      </div>

      <KpiSection title="Quota overview">
        <KpiCard title="Tenants tracked" value={tenants.length} icon={Users} tone="indigo" />
        <KpiCard
          title="Over limit"
          value={overLimitCount}
          subtitle="Tenants exceeding any quota"
          icon={Users}
          tone={overLimitCount ? 'rose' : 'emerald'}
        />
        <KpiCard
          title="Default user cap"
          value={defaults.maxUsers}
          subtitle={`${defaults.maxPhoneNumbers} numbers · ${defaults.maxConcurrentCalls} concurrent`}
          icon={Users}
          tone="violet"
        />
      </KpiSection>

      <div className="panel-card p-5">
        <h3 className="font-medium text-slate-900">Platform defaults</h3>
        <p className="mt-1 text-sm text-slate-500">Used when a tenant has no custom override (blank = default).</p>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          {(['maxUsers', 'maxPhoneNumbers', 'maxConcurrentCalls'] as const).map((key) => (
            <label key={key} className="block text-sm">
              <span className="mb-1.5 block text-slate-600">
                {key === 'maxUsers' ? 'Max users' : key === 'maxPhoneNumbers' ? 'Max numbers' : 'Max concurrent calls'}
              </span>
              <input
                type="number"
                min="1"
                value={draftDefaults[key]}
                onChange={(e) => setDraftDefaults((prev) => ({ ...prev, [key]: Number(e.target.value) || 0 }))}
                className="w-full rounded-lg input-field"
              />
            </label>
          ))}
        </div>
        <button
          type="button"
          onClick={onSaveDefaults}
          disabled={savingDefaults}
          className="btn-primary mt-4 px-4 py-2 text-sm"
        >
          {savingDefaults ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save defaults
        </button>
      </div>

      <DataTable
        title="Tenant quota usage"
        data={tenants}
        getRowId={(t) => t.id}
        emptyMessage="No tenants yet"
        columns={[
          {
            key: 'name',
            header: 'Tenant',
            sortable: true,
            render: (t) => (
              <div>
                <p className="font-medium text-slate-900">{t.name}</p>
                {t.overLimit ? <p className="text-xs text-rose-600">Over limit</p> : null}
              </div>
            ),
          },
          {
            key: 'users',
            header: 'Users',
            sortable: true,
            sortValue: (t) => t.userUsagePercent,
            render: (t) => (
              <div className="min-w-[120px] space-y-1">
                <p className="text-sm">{t.userCount} / {t.maxUsers}</p>
                <UsageBar percent={t.userUsagePercent} overLimit={t.userCount > t.maxUsers} />
              </div>
            ),
          },
          {
            key: 'numbers',
            header: 'Numbers',
            sortable: true,
            sortValue: (t) => t.numberUsagePercent,
            render: (t) => (
              <div className="min-w-[120px] space-y-1">
                <p className="text-sm">{t.numberCount} / {t.maxPhoneNumbers}</p>
                <UsageBar percent={t.numberUsagePercent} overLimit={t.numberCount > t.maxPhoneNumbers} />
              </div>
            ),
          },
          {
            key: 'concurrent',
            header: 'Concurrent',
            sortable: true,
            sortValue: (t) => t.concurrentUsagePercent,
            render: (t) => (
              <div className="min-w-[120px] space-y-1">
                <p className="text-sm">{t.concurrentCalls} / {t.maxConcurrentCalls}</p>
                <UsageBar percent={t.concurrentUsagePercent} overLimit={t.concurrentCalls > t.maxConcurrentCalls} />
              </div>
            ),
          },
          {
            key: 'override',
            header: 'Custom limits',
            searchable: false,
            sortable: false,
            render: (t) => {
              const draft = drafts[t.id] || { maxUsers: '', maxPhoneNumbers: '', maxConcurrentCalls: '' };
              return (
                <div className="flex flex-wrap items-end gap-2">
                  <input
                    type="number"
                    min="1"
                    placeholder={`Users (${defaults.maxUsers})`}
                    value={draft.maxUsers}
                    onChange={(e) =>
                      setDrafts((prev) => ({ ...prev, [t.id]: { ...draft, maxUsers: e.target.value } }))
                    }
                    className="w-24 rounded-lg input-field text-xs"
                  />
                  <input
                    type="number"
                    min="1"
                    placeholder={`Nums (${defaults.maxPhoneNumbers})`}
                    value={draft.maxPhoneNumbers}
                    onChange={(e) =>
                      setDrafts((prev) => ({ ...prev, [t.id]: { ...draft, maxPhoneNumbers: e.target.value } }))
                    }
                    className="w-24 rounded-lg input-field text-xs"
                  />
                  <input
                    type="number"
                    min="1"
                    placeholder={`Calls (${defaults.maxConcurrentCalls})`}
                    value={draft.maxConcurrentCalls}
                    onChange={(e) =>
                      setDrafts((prev) => ({ ...prev, [t.id]: { ...draft, maxConcurrentCalls: e.target.value } }))
                    }
                    className="w-24 rounded-lg input-field text-xs"
                  />
                  <button
                    type="button"
                    onClick={() => onSaveTenant(t.id)}
                    disabled={savingTenantId === t.id}
                    className="rounded-lg border border-slate-300 px-2 py-1 text-xs text-slate-700 hover:bg-slate-100"
                  >
                    {savingTenantId === t.id ? 'Saving…' : 'Save'}
                  </button>
                </div>
              );
            },
          },
        ]}
      />
    </div>
  );
}
