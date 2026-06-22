'use client';

import 'sweetalert2/dist/sweetalert2.min.css';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Building2, Loader2, Save } from 'lucide-react';
import Swal from 'sweetalert2';
import { SettingsNav } from '@/components/settings-nav';
import { getMe, getTenantProfile, isUnauthorizedError, updateTenantProfile } from '@/lib/api';
import { SWAL_THEME } from '@/lib/swal-theme';

const TIMEZONES = [
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Phoenix',
  'America/Anchorage',
  'Pacific/Honolulu',
  'Europe/London',
  'Europe/Paris',
  'Asia/Dubai',
  'Asia/Kolkata',
  'Asia/Singapore',
  'Australia/Sydney',
  'UTC',
];

export default function CompanyProfilePage() {
  const router = useRouter();
  const [role, setRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [companyName, setCompanyName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [timezone, setTimezone] = useState('America/New_York');
  const [error, setError] = useState('');

  const canEdit = role === 'TENANT_ADMIN';

  useEffect(() => {
    getMe()
      .then((user) => {
        if (!user.tenantId) {
          router.replace('/dashboard');
          return;
        }
        setRole(user.role);
        return getTenantProfile();
      })
      .then((res) => {
        if (!res?.profile) return;
        setCompanyName(res.profile.name);
        setContactEmail(res.profile.contactEmail || '');
        setTimezone(res.profile.timezone || 'America/New_York');
      })
      .catch((err) => {
        if (isUnauthorizedError(err)) {
          router.replace('/login');
          return;
        }
        setError(err instanceof Error ? err.message : 'Could not load company profile');
      })
      .finally(() => setLoading(false));
  }, [router]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canEdit) return;

    setSaving(true);
    try {
      const res = await updateTenantProfile({ contactEmail, timezone });
      setCompanyName(res.profile.name);
      await Swal.fire({
        title: 'Profile saved',
        text: 'Company contact details updated.',
        icon: 'success',
        timer: 1800,
        showConfirmButton: false,
        ...SWAL_THEME,
      });
    } catch (err) {
      await Swal.fire({
        title: 'Save failed',
        text: err instanceof Error ? err.message : 'Could not save profile',
        icon: 'error',
        ...SWAL_THEME,
      });
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-slate-400">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        Loading company profile…
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-lg rounded-xl border border-red-200 bg-red-50 p-6 text-center">
        <p className="font-medium text-red-700">Company profile unavailable</p>
        <p className="mt-2 text-sm text-slate-400">{error}</p>
        <p className="mt-3 text-xs text-slate-500">
          Restart the API server on port 3000 if you recently added profile features.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h2 className="text-lg font-medium text-slate-900">Settings</h2>
        <p className="text-sm text-slate-400">Organization profile and team</p>
      </div>

      <SettingsNav role={role || undefined} />

      <form onSubmit={onSubmit} className="panel-card p-6 space-y-5">
        <div className="flex items-center gap-2">
          <Building2 className="h-5 w-5 text-indigo-400" />
          <h3 className="font-medium text-slate-900">Company profile</h3>
        </div>
        <p className="text-sm text-slate-400">
          Contact details for billing and support. Company name is managed by VSP-VOIP platform admin.
        </p>

        <label className="block">
          <span className="mb-1.5 block text-sm text-slate-700">Company name</span>
          <input
            type="text"
            value={companyName}
            readOnly
            className="w-full rounded-lg border border-slate-200 bg-white/50 px-3 py-2.5 text-slate-400"
          />
        </label>

        <label className="block">
          <span className="mb-1.5 block text-sm text-slate-700">Contact email</span>
          <input
            type="email"
            value={contactEmail}
            onChange={(e) => setContactEmail(e.target.value)}
            readOnly={!canEdit}
            placeholder="billing@yourcompany.com"
            className="w-full rounded-lg input-field disabled:opacity-70"
          />
          <p className="mt-1 text-xs text-slate-500">Used on invoices and order notifications</p>
        </label>

        <label className="block">
          <span className="mb-1.5 block text-sm text-slate-700">Timezone</span>
          <select
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
            disabled={!canEdit}
            className="w-full rounded-lg input-field disabled:opacity-70"
          >
            {TIMEZONES.map((tz) => (
              <option key={tz} value={tz}>
                {tz.replace(/_/g, ' ')}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-slate-500">For future business hours and call routing features</p>
        </label>

        {canEdit ? (
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-500 px-5 py-2.5 text-sm font-medium text-white hover:bg-indigo-400 disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save profile
          </button>
        ) : (
          <p className="text-sm text-slate-500">Only tenant admins can edit company profile.</p>
        )}
      </form>
    </div>
  );
}
