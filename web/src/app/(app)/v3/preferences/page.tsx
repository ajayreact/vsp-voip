'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Plus, Save } from 'lucide-react';
import { PortalPageHeader } from '@/components/portal/page-header';
import { getMe, isUnauthorizedError } from '@/lib/api';
import {
  getV3Preferences,
  isV3PortalEnabled,
  updateV3Preferences,
  type DevicePreference,
} from '@/lib/v3-api';

const DEVICE_TYPES = ['desktop', 'laptop', 'desk_phone', 'mobile', 'tablet'];

export default function V3PreferencesPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [uiPrefs, setUiPrefs] = useState<Record<string, unknown>>({});
  const [devices, setDevices] = useState<DevicePreference[]>([]);
  const [compactSidebar, setCompactSidebar] = useState(false);
  const [showAvatars, setShowAvatars] = useState(true);

  const load = useCallback(async () => {
    const res = await getV3Preferences();
    setUiPrefs(res.preferences.preferences || {});
    setDevices(res.devices.items || []);
    setCompactSidebar(Boolean(res.preferences.preferences?.compactSidebar));
    setShowAvatars(res.preferences.preferences?.showAvatars !== false);
  }, []);

  useEffect(() => {
    if (!isV3PortalEnabled()) {
      router.replace('/dashboard');
      return;
    }
    getMe()
      .then(() => load())
      .catch((err) => {
        if (isUnauthorizedError(err)) router.replace('/login');
        else setError(err instanceof Error ? err.message : 'Could not load preferences');
      })
      .finally(() => setLoading(false));
  }, [router, load]);

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const res = await updateV3Preferences({
        preferences: { ...uiPrefs, compactSidebar, showAvatars },
        devices: devices.map((d) => ({
          deviceType: d.deviceType,
          deviceAlias: d.deviceAlias || undefined,
          notificationPreference: d.notificationPreference,
          ringPreference: d.ringPreference,
          preferred: d.preferred,
        })),
      });
      setUiPrefs(res.preferences.preferences || {});
      setDevices(res.devices.items || []);
      setMessage('Preferences saved.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  function updateDevice(index: number, patch: Partial<DevicePreference>) {
    setDevices((prev) => prev.map((d, i) => (i === index ? { ...d, ...patch } : d)));
  }

  function addDevice() {
    const unused = DEVICE_TYPES.find((t) => !devices.some((d) => d.deviceType === t));
    if (!unused) return;
    setDevices((prev) => [
      ...prev,
      {
        id: `new-${unused}`,
        deviceType: unused,
        deviceAlias: null,
        lastActiveAt: null,
        preferred: false,
        notificationPreference: 'all',
        ringPreference: 'default',
      },
    ]);
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
        title="Preferences"
        description="UI and per-device notification settings — configuration only."
      />

      {error ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
      ) : null}
      {message ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{message}</div>
      ) : null}

      <form onSubmit={onSave} className="space-y-6">
        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-sm font-semibold text-slate-900">UI Preferences</h2>
          <div className="flex flex-wrap gap-6">
            <label className="inline-flex items-center gap-2 text-sm">
              <input type="checkbox" checked={compactSidebar} onChange={(e) => setCompactSidebar(e.target.checked)} />
              Compact sidebar
            </label>
            <label className="inline-flex items-center gap-2 text-sm">
              <input type="checkbox" checked={showAvatars} onChange={(e) => setShowAvatars(e.target.checked)} />
              Show avatars in directory
            </label>
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900">Device Preferences</h2>
            <button
              type="button"
              onClick={addDevice}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              <Plus className="h-3.5 w-3.5" /> Add device
            </button>
          </div>
          {devices.length === 0 ? (
            <p className="text-sm text-slate-500">No device preferences yet.</p>
          ) : (
            <div className="space-y-4">
              {devices.map((device, index) => (
                <div key={device.id || index} className="grid gap-3 rounded-lg border border-slate-100 p-4 sm:grid-cols-2">
                  <label className="text-sm">
                    <span className="text-xs text-slate-500">Type</span>
                    <select
                      className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
                      value={device.deviceType}
                      onChange={(e) => updateDevice(index, { deviceType: e.target.value })}
                    >
                      {DEVICE_TYPES.map((t) => (
                        <option key={t} value={t}>{t.replace('_', ' ')}</option>
                      ))}
                    </select>
                  </label>
                  <label className="text-sm">
                    <span className="text-xs text-slate-500">Alias</span>
                    <input
                      className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
                      value={device.deviceAlias || ''}
                      onChange={(e) => updateDevice(index, { deviceAlias: e.target.value || null })}
                    />
                  </label>
                  <label className="text-sm">
                    <span className="text-xs text-slate-500">Notifications</span>
                    <select
                      className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
                      value={device.notificationPreference}
                      onChange={(e) => updateDevice(index, { notificationPreference: e.target.value })}
                    >
                      <option value="all">All</option>
                      <option value="calls_only">Calls only</option>
                      <option value="none">None</option>
                    </select>
                  </label>
                  <label className="text-sm">
                    <span className="text-xs text-slate-500">Ring</span>
                    <select
                      className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
                      value={device.ringPreference}
                      onChange={(e) => updateDevice(index, { ringPreference: e.target.value })}
                    >
                      <option value="default">Default</option>
                      <option value="silent">Silent</option>
                      <option value="vibrate">Vibrate</option>
                      <option value="custom">Custom</option>
                    </select>
                  </label>
                  <label className="inline-flex items-center gap-2 text-sm sm:col-span-2">
                    <input
                      type="checkbox"
                      checked={device.preferred}
                      onChange={(e) => updateDevice(index, { preferred: e.target.checked })}
                    />
                    Preferred device
                  </label>
                </div>
              ))}
            </div>
          )}
        </section>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save Preferences
          </button>
        </div>
      </form>
    </div>
  );
}
