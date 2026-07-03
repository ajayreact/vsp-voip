'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Save } from 'lucide-react';
import { PortalPageHeader } from '@/components/portal/page-header';
import { getMe, isUnauthorizedError } from '@/lib/api';
import { getV3Presence, updateV3Presence, type PresenceConfig } from '@/lib/v3-api';

const STATUS_OPTIONS = [
  { value: 'available', label: 'Available', color: 'bg-emerald-500' },
  { value: 'busy', label: 'Busy', color: 'bg-rose-500' },
  { value: 'away', label: 'Away', color: 'bg-amber-500' },
  { value: 'offline', label: 'Offline', color: 'bg-slate-400' },
  { value: 'dnd', label: 'Do Not Disturb', color: 'bg-rose-600' },
  { value: 'invisible', label: 'Invisible', color: 'bg-slate-300' },
];

export default function PresencePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [form, setForm] = useState<Partial<PresenceConfig>>({ status: 'available' });

  const load = useCallback(async () => {
    const res = await getV3Presence();
    setForm(res.presence);
  }, []);

  useEffect(() => {getMe()
      .then(() => load())
      .catch((err) => {
        if (isUnauthorizedError(err)) router.replace('/login');
        else setError(err instanceof Error ? err.message : 'Could not load presence');
      })
      .finally(() => setLoading(false));
  }, [router, load]);

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    if (!form.status) return;
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const res = await updateV3Presence({ status: form.status, message: form.message || undefined });
      setForm(res.presence);
      setMessage('Presence updated.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center text-slate-500">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <PortalPageHeader
        title="Presence"
        description="Configure your availability status — not connected to live softphone runtime."
      />

      {error ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
      ) : null}
      {message ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{message}</div>
      ) : null}

      <form onSubmit={onSave} className="space-y-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="grid gap-2 sm:grid-cols-2">
          {STATUS_OPTIONS.map((opt) => (
            <label
              key={opt.value}
              className={`flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2 text-sm ${
                form.status === opt.value ? 'border-slate-900 bg-slate-50' : 'border-slate-200 hover:bg-slate-50'
              }`}
            >
              <input
                type="radio"
                name="status"
                value={opt.value}
                checked={form.status === opt.value}
                onChange={() => setForm((prev) => ({ ...prev, status: opt.value }))}
                className="sr-only"
              />
              <span className={`h-2.5 w-2.5 rounded-full ${opt.color}`} />
              {opt.label}
            </label>
          ))}
        </div>

        <label className="block space-y-1">
          <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Status message</span>
          <input
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            value={form.message || ''}
            onChange={(e) => setForm((prev) => ({ ...prev, message: e.target.value || null }))}
            placeholder="In a meeting, back at 3pm..."
          />
        </label>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save Presence
          </button>
        </div>
      </form>
    </div>
  );
}
