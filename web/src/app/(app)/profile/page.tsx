'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Save } from 'lucide-react';
import { PortalPageHeader } from '@/components/portal/page-header';
import { getMe, isUnauthorizedError } from '@/lib/api';
import { getV3Profile, updateV3Profile, type SoftphoneProfile } from '@/lib/v3-api';

const DEVICE_OPTIONS = [
  { value: '', label: 'Not set' },
  { value: 'desktop', label: 'Desktop' },
  { value: 'laptop', label: 'Laptop' },
  { value: 'desk_phone', label: 'Desk Phone' },
  { value: 'mobile', label: 'Mobile' },
  { value: 'tablet', label: 'Tablet' },
];

const THEME_OPTIONS = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];

const RECORDING_OPTIONS = [
  { value: 'inherit', label: 'Inherit tenant default' },
  { value: 'always', label: 'Always record' },
  { value: 'never', label: 'Never record' },
  { value: 'on_demand', label: 'On demand' },
];

export default function ProfilePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [form, setForm] = useState<Partial<SoftphoneProfile>>({});

  const load = useCallback(async () => {
    const res = await getV3Profile();
    setForm(res.profile);
  }, []);

  useEffect(() => {getMe()
      .then(() => load())
      .catch((err) => {
        if (isUnauthorizedError(err)) router.replace('/login');
        else setError(err instanceof Error ? err.message : 'Could not load profile');
      })
      .finally(() => setLoading(false));
  }, [router, load]);

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const res = await updateV3Profile(form);
      setForm(res.profile);
      setMessage('Profile saved.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  function setField<K extends keyof SoftphoneProfile>(key: K, value: SoftphoneProfile[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center text-slate-500">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PortalPageHeader
        title="Softphone Profile"
        description="Configure caller ID, devices, and call behavior — management only, not connected to live telephony yet."
      />

      {error ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
      ) : null}
      {message ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{message}</div>
      ) : null}

      <form onSubmit={onSave} className="space-y-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <section className="grid gap-4 sm:grid-cols-2">
          <Field label="Preferred Caller ID">
            <input
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              value={form.preferredCallerId || ''}
              onChange={(e) => setField('preferredCallerId', e.target.value || null)}
              placeholder="+1..."
            />
          </Field>
          <Field label="Preferred Device">
            <select
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              value={form.preferredDevice || ''}
              onChange={(e) => setField('preferredDevice', e.target.value || null)}
            >
              {DEVICE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </Field>
          <Field label="Default Audio Device">
            <input
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              value={form.defaultAudioDevice || ''}
              onChange={(e) => setField('defaultAudioDevice', e.target.value || null)}
            />
          </Field>
          <Field label="Ring Device">
            <input
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              value={form.ringDevice || ''}
              onChange={(e) => setField('ringDevice', e.target.value || null)}
            />
          </Field>
          <Field label="Theme">
            <select
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              value={form.theme || 'system'}
              onChange={(e) => setField('theme', e.target.value)}
            >
              {THEME_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </Field>
          <Field label="Language">
            <input
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              value={form.language || 'en'}
              onChange={(e) => setField('language', e.target.value)}
            />
          </Field>
          <Field label="Timezone">
            <input
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              value={form.timezone || ''}
              onChange={(e) => setField('timezone', e.target.value || null)}
              placeholder="America/New_York"
            />
          </Field>
          <Field label="Call Recording">
            <select
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              value={form.callRecordingPreference || 'inherit'}
              onChange={(e) => setField('callRecordingPreference', e.target.value)}
            >
              {RECORDING_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </Field>
        </section>

        <section className="flex flex-wrap gap-6">
          <Toggle label="Auto Answer" checked={!!form.autoAnswer} onChange={(v) => setField('autoAnswer', v)} />
          <Toggle label="Do Not Disturb" checked={!!form.dnd} onChange={(v) => setField('dnd', v)} />
          <Toggle label="Busy" checked={!!form.busy} onChange={(v) => setField('busy', v)} />
          <Toggle label="Away" checked={!!form.away} onChange={(v) => setField('away', v)} />
        </section>

        <Field label="Presence Visibility">
          <select
            className="w-full max-w-xs rounded-lg border border-slate-300 px-3 py-2 text-sm"
            value={form.presenceVisibility || 'everyone'}
            onChange={(e) => setField('presenceVisibility', e.target.value)}
          >
            <option value="everyone">Everyone</option>
            <option value="team">Team only</option>
            <option value="admins">Admins only</option>
            <option value="nobody">Nobody</option>
          </select>
        </Field>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save Profile
          </button>
        </div>
      </form>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</span>
      {children}
    </label>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-slate-700">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="rounded" />
      {label}
    </label>
  );
}
