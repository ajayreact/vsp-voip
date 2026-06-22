'use client';

import 'sweetalert2/dist/sweetalert2.min.css';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { GitBranch, Loader2, Save } from 'lucide-react';
import Swal from 'sweetalert2';
import { AdminPageHeader } from '@/components/admin-page-header';
import { AdminSectionNav, adminSettingsTabs } from '@/components/admin-section-nav';
import { AdminPlatformSettingsForm } from '@/components/admin-platform-settings-form';
import { KpiCard, KpiSection } from '@/components/kpi-card';
import {
  getAdminLcr,
  getMe,
  isUnauthorizedError,
  updateAdminLcr,
  type LcrConfig,
} from '@/lib/api';
import { SWAL_THEME } from '@/lib/swal-theme';

export default function AdminSettingsCarrierPage() {
  const router = useRouter();
  const [lcr, setLcr] = useState<LcrConfig | null>(null);
  const [primaryConnectionId, setPrimaryConnectionId] = useState('');
  const [fallbackConnectionId, setFallbackConnectionId] = useState('');
  const [notes, setNotes] = useState('');
  const [loadingLcr, setLoadingLcr] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getMe()
      .then((user) => {
        if (user.role !== 'SUPER_ADMIN') {
          router.replace('/dashboard');
          return;
        }
        return getAdminLcr();
      })
      .then((res) => {
        if (!res) return;
        setLcr(res.lcr);
        setPrimaryConnectionId(res.lcr.primaryConnectionId);
        setFallbackConnectionId(res.lcr.fallbackConnectionId);
        setNotes(res.lcr.notes);
      })
      .catch((err) => {
        if (isUnauthorizedError(err)) router.replace('/login');
      })
      .finally(() => setLoadingLcr(false));
  }, [router]);

  async function onSaveLcr(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await updateAdminLcr({ primaryConnectionId, fallbackConnectionId, notes });
      setLcr(res.lcr);
      await Swal.fire({ title: 'Routing saved', icon: 'success', timer: 1500, showConfirmButton: false, ...SWAL_THEME });
    } catch (err) {
      await Swal.fire({
        title: 'Save failed',
        text: err instanceof Error ? err.message : 'Could not save routing',
        icon: 'error',
        ...SWAL_THEME,
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <AdminPageHeader
        section="Settings"
        title="Carrier settings"
        subtitle="Telnyx connections, messaging profile, call control, and trunk routing."
      />
      <AdminSectionNav tabs={adminSettingsTabs} />

      <AdminPlatformSettingsForm sections={['telnyx']} saveLabel="Save Telnyx settings" />

      <div className="panel-card space-y-6 p-6">
        <div>
          <h3 className="text-lg font-medium text-slate-900">Trunk routing (LCR)</h3>
          <p className="mt-1 text-sm text-slate-500">
            Primary and failover Telnyx connections for number provisioning.
          </p>
        </div>

        {loadingLcr ? (
          <div className="flex items-center text-slate-500">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Loading routing…
          </div>
        ) : (
          <>
            <KpiSection title="Trunk status">
              <KpiCard
                title="Primary trunk"
                value={primaryConnectionId ? 'Configured' : 'Not set'}
                subtitle={primaryConnectionId || 'Uses platform default'}
                icon={GitBranch}
                tone={primaryConnectionId ? 'emerald' : 'amber'}
              />
              <KpiCard
                title="Fallback trunk"
                value={fallbackConnectionId ? 'Configured' : 'Not set'}
                subtitle="Failover connection"
                icon={GitBranch}
                tone={fallbackConnectionId ? 'emerald' : 'slate'}
              />
            </KpiSection>

            <form onSubmit={onSaveLcr} className="space-y-4">
              <label className="block">
                <span className="mb-1 block text-sm text-slate-600">Primary connection ID</span>
                <select
                  value={primaryConnectionId}
                  onChange={(e) => setPrimaryConnectionId(e.target.value)}
                  className="input-field w-full"
                >
                  <option value="">Platform default</option>
                  {(lcr?.availableConnections || []).map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label} ({c.type})
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block text-sm text-slate-600">Fallback connection ID</span>
                <select
                  value={fallbackConnectionId}
                  onChange={(e) => setFallbackConnectionId(e.target.value)}
                  className="input-field w-full"
                >
                  <option value="">None</option>
                  {(lcr?.availableConnections || []).map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label} ({c.type})
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block text-sm text-slate-600">Notes</span>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  className="input-field w-full"
                />
              </label>
              <button type="submit" disabled={saving} className="btn-primary px-4 py-2 text-sm">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Save routing
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
