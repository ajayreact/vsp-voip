'use client';

import 'sweetalert2/dist/sweetalert2.min.css';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Activity, KeyRound, Loader2, Plug, Save, ScrollText } from 'lucide-react';
import Swal from 'sweetalert2';
import { AdminPageHeader } from '@/components/admin-page-header';
import { AdminSectionNav, adminSettingsTabs } from '@/components/admin-section-nav';
import { KpiCard, KpiSection } from '@/components/kpi-card';
import { SwitchField } from '@/components/switch-field';
import {
  getAdminProviderCredentials,
  getAdminProviderHealth,
  getAdminProviderLogs,
  getAdminProviders,
  getMe,
  isUnauthorizedError,
  saveAdminProviderCredential,
  setAdminDefaultProvider,
  setAdminProviderActive,
  type ProviderCredentialRecord,
  type ProviderHealth,
  type ProviderRecord,
} from '@/lib/api';
import { SWAL_THEME } from '@/lib/swal-theme';

export default function AdminSettingsProvidersPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [providers, setProviders] = useState<ProviderRecord[]>([]);
  const [defaultProviderKey, setDefaultProviderKey] = useState<string | null>(null);
  const [health, setHealth] = useState<Record<string, ProviderHealth>>({});
  const [togglingKey, setTogglingKey] = useState<string | null>(null);
  const [savingDefault, setSavingDefault] = useState(false);

  const [credentialProviderKey, setCredentialProviderKey] = useState('twilio');
  const [credentialScope, setCredentialScope] = useState<'VOICE' | 'MESSAGING' | 'SIP'>('VOICE');
  const [externalAccountId, setExternalAccountId] = useState('');
  const [secret, setSecret] = useState('');
  const [authToken, setAuthToken] = useState('');
  const [savingCredential, setSavingCredential] = useState(false);
  const [credentials, setCredentials] = useState<ProviderCredentialRecord[]>([]);

  const [logsProviderKey, setLogsProviderKey] = useState('telnyx');
  const [logs, setLogs] = useState<Record<string, unknown>[]>([]);
  const [logsNote, setLogsNote] = useState<string | null>(null);
  const [loadingLogs, setLoadingLogs] = useState(false);

  const loadProviders = useCallback(async () => {
    const res = await getAdminProviders();
    setProviders(res.providers);
    setDefaultProviderKey(res.defaultProviderKey);

    const healthEntries = await Promise.all(
      res.providers.map(async (p) => {
        try {
          const h = await getAdminProviderHealth(p.key);
          return [p.key, h.health] as const;
        } catch {
          return [p.key, { ok: false, checkedAt: new Date().toISOString() }] as const;
        }
      }),
    );
    setHealth(Object.fromEntries(healthEntries));
  }, []);

  const loadCredentials = useCallback(async () => {
    const res = await getAdminProviderCredentials();
    setCredentials(res.credentials);
  }, []);

  const loadLogs = useCallback(async (providerKey: string) => {
    setLoadingLogs(true);
    try {
      const res = await getAdminProviderLogs(providerKey);
      setLogs(res.events);
      setLogsNote(res.note);
    } finally {
      setLoadingLogs(false);
    }
  }, []);

  useEffect(() => {
    getMe()
      .then((user) => {
        if (user.role !== 'SUPER_ADMIN') {
          router.replace('/dashboard');
          return;
        }
        return Promise.all([loadProviders(), loadCredentials(), loadLogs('telnyx')]);
      })
      .catch((err) => {
        if (isUnauthorizedError(err)) router.replace('/login');
      })
      .finally(() => setLoading(false));
  }, [router, loadProviders, loadCredentials, loadLogs]);

  async function onToggleActive(providerKey: string, isActive: boolean) {
    setTogglingKey(providerKey);
    try {
      await setAdminProviderActive(providerKey, isActive);
      await loadProviders();
    } catch (err) {
      await Swal.fire({
        title: 'Could not update provider',
        text: err instanceof Error ? err.message : 'Unknown error',
        icon: 'error',
        ...SWAL_THEME,
      });
    } finally {
      setTogglingKey(null);
    }
  }

  async function onSaveDefault(providerKey: string) {
    setSavingDefault(true);
    try {
      await setAdminDefaultProvider(providerKey);
      setDefaultProviderKey(providerKey);
      await Swal.fire({ title: 'Default provider updated', icon: 'success', timer: 1200, showConfirmButton: false, ...SWAL_THEME });
    } catch (err) {
      await Swal.fire({
        title: 'Could not set default provider',
        text: err instanceof Error ? err.message : 'Unknown error',
        icon: 'error',
        ...SWAL_THEME,
      });
    } finally {
      setSavingDefault(false);
    }
  }

  async function onSaveCredential(e: React.FormEvent) {
    e.preventDefault();
    setSavingCredential(true);
    try {
      await saveAdminProviderCredential({
        providerKey: credentialProviderKey,
        scope: credentialScope,
        externalAccountId: externalAccountId || undefined,
        secret: secret || undefined,
        authToken: authToken || undefined,
      });
      setSecret('');
      setAuthToken('');
      await loadCredentials();
      await loadProviders();
      await Swal.fire({ title: 'Credential saved', icon: 'success', timer: 1200, showConfirmButton: false, ...SWAL_THEME });
    } catch (err) {
      await Swal.fire({
        title: 'Could not save credential',
        text: err instanceof Error ? err.message : 'Unknown error',
        icon: 'error',
        ...SWAL_THEME,
      });
    } finally {
      setSavingCredential(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-slate-500">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        Loading providers…
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <AdminPageHeader
        section="Settings"
        title="Telephony providers"
        subtitle="Manage Telnyx, Twilio, and future carrier integrations. Existing Telnyx configuration on the Carrier tab is unaffected."
      />
      <AdminSectionNav tabs={adminSettingsTabs} />

      <KpiSection title="Providers" description="Enable/disable a provider and check live credential health.">
        {providers.map((provider) => {
          const isDefault = defaultProviderKey === provider.key;
          const statusLabel = provider.isActive ? 'Active' : 'Inactive';
          const badge = isDefault ? 'Default' : statusLabel;
          return (
            <KpiCard
              key={provider.id}
              title={provider.displayName}
              value={health[provider.key]?.ok ? 'Healthy' : 'Needs attention'}
              subtitle={
                health[provider.key]?.message ||
                `${statusLabel}${isDefault ? ' · platform default' : ''}`
              }
              icon={provider.key === 'telnyx' ? Plug : Activity}
              tone={
                !provider.isActive
                  ? 'slate'
                  : health[provider.key]?.ok
                    ? 'emerald'
                    : 'amber'
              }
              badge={badge}
            />
          );
        })}
      </KpiSection>

      <div className="panel-card space-y-4 p-6">
        <h3 className="text-lg font-medium text-slate-900">Enable / disable providers</h3>
        {providers.map((provider) => (
          <SwitchField
            key={provider.id}
            label={provider.displayName}
            description={`key: ${provider.key} — capabilities: ${Object.entries(provider.capabilities || {}).filter(([, v]) => v).map(([k]) => k).join(', ') || 'none reported'}`}
            checked={provider.isActive}
            loading={togglingKey === provider.key}
            onCheckedChange={(checked) => onToggleActive(provider.key, checked)}
            trailing={
              <button
                type="button"
                onClick={() => onSaveDefault(provider.key)}
                disabled={savingDefault || defaultProviderKey === provider.key}
                className="rounded-full border border-slate-200 px-2 py-0.5 text-[11px] font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
              >
                {defaultProviderKey === provider.key ? 'Default provider' : 'Set as default'}
              </button>
            }
          />
        ))}
      </div>

      <div className="panel-card space-y-4 p-6">
        <div className="flex items-center gap-2">
          <KeyRound className="h-5 w-5 text-indigo-600" />
          <h3 className="text-lg font-medium text-slate-900">Provider credentials</h3>
        </div>
        <p className="text-sm text-slate-500">
          Platform-level credentials (leave tenant blank) apply to all tenants unless a tenant is later given its own override.
        </p>

        <form onSubmit={onSaveCredential} className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-sm text-slate-600">Provider</span>
            <select
              value={credentialProviderKey}
              onChange={(e) => setCredentialProviderKey(e.target.value)}
              className="input-field w-full"
            >
              {providers.map((p) => (
                <option key={p.key} value={p.key}>{p.displayName}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-sm text-slate-600">Scope</span>
            <select
              value={credentialScope}
              onChange={(e) => setCredentialScope(e.target.value as 'VOICE' | 'MESSAGING' | 'SIP')}
              className="input-field w-full"
            >
              <option value="VOICE">Voice</option>
              <option value="MESSAGING">Messaging</option>
              <option value="SIP">SIP</option>
            </select>
          </label>
          <label className="block sm:col-span-2">
            <span className="mb-1 block text-sm text-slate-600">Account SID / External account ID</span>
            <input
              value={externalAccountId}
              onChange={(e) => setExternalAccountId(e.target.value)}
              placeholder="e.g. Twilio Account SID"
              className="input-field w-full"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm text-slate-600">Secret / API key</span>
            <input
              type="password"
              value={secret}
              onChange={(e) => setSecret(e.target.value)}
              placeholder="Leave blank to keep current value"
              className="input-field w-full"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm text-slate-600">Auth token</span>
            <input
              type="password"
              value={authToken}
              onChange={(e) => setAuthToken(e.target.value)}
              placeholder="Leave blank to keep current value"
              className="input-field w-full"
            />
          </label>
          <div className="sm:col-span-2">
            <button type="submit" disabled={savingCredential} className="btn-primary px-4 py-2 text-sm">
              {savingCredential ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save credential
            </button>
          </div>
        </form>

        {credentials.length > 0 ? (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase text-slate-400">
                <tr>
                  <th className="pb-2 pr-4">Provider</th>
                  <th className="pb-2 pr-4">Scope</th>
                  <th className="pb-2 pr-4">Tenant</th>
                  <th className="pb-2 pr-4">Account ID</th>
                  <th className="pb-2">Updated</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {credentials.map((cred) => (
                  <tr key={cred.id}>
                    <td className="py-2 pr-4 font-medium text-slate-800">{cred.providerKey}</td>
                    <td className="py-2 pr-4 text-slate-500">{cred.scope}</td>
                    <td className="py-2 pr-4 text-slate-500">{cred.tenantId || 'Platform'}</td>
                    <td className="py-2 pr-4 text-slate-500">{cred.externalAccountId || '—'}</td>
                    <td className="py-2 text-slate-500">{new Date(cred.updatedAt).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>

      <div className="panel-card space-y-4 p-6">
        <div className="flex items-center gap-2">
          <ScrollText className="h-5 w-5 text-indigo-600" />
          <h3 className="text-lg font-medium text-slate-900">Provider event logs</h3>
        </div>
        <label className="block max-w-xs">
          <span className="mb-1 block text-sm text-slate-600">Provider</span>
          <select
            value={logsProviderKey}
            onChange={(e) => {
              setLogsProviderKey(e.target.value);
              loadLogs(e.target.value);
            }}
            className="input-field w-full"
          >
            {providers.map((p) => (
              <option key={p.key} value={p.key}>{p.displayName}</option>
            ))}
          </select>
        </label>

        {loadingLogs ? (
          <div className="flex items-center text-slate-500">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Loading logs…
          </div>
        ) : logsNote ? (
          <p className="text-sm text-slate-500">{logsNote}</p>
        ) : logs.length === 0 ? (
          <p className="text-sm text-slate-500">No recent events.</p>
        ) : (
          <div className="max-h-80 overflow-y-auto rounded-lg border border-slate-100">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 bg-white text-xs uppercase text-slate-400">
                <tr>
                  <th className="p-2">Event type</th>
                  <th className="p-2">Call control ID</th>
                  <th className="p-2">Processed at</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {logs.map((event, idx) => (
                  <tr key={idx}>
                    <td className="p-2 text-slate-700">{String(event.eventType ?? '—')}</td>
                    <td className="p-2 text-slate-500">{String(event.callControlId ?? '—')}</td>
                    <td className="p-2 text-slate-500">
                      {event.processedAt ? new Date(String(event.processedAt)).toLocaleString() : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
