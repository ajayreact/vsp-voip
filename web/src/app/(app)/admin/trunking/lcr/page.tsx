'use client';

import 'sweetalert2/dist/sweetalert2.min.css';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, GitBranch, Loader2, Save } from 'lucide-react';
import Swal from 'sweetalert2';
import { KpiCard, KpiSection } from '@/components/kpi-card';
import { getAdminLcr, getMe, isUnauthorizedError, updateAdminLcr, type LcrConfig } from '@/lib/api';
import { SWAL_THEME } from '@/lib/swal-theme';

export default function AdminLeastCostRoutingPage() {
  const router = useRouter();
  const [lcr, setLcr] = useState<LcrConfig | null>(null);
  const [primaryConnectionId, setPrimaryConnectionId] = useState('');
  const [fallbackConnectionId, setFallbackConnectionId] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(true);
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
      .finally(() => setLoading(false));
  }, [router]);

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await updateAdminLcr({
        primaryConnectionId,
        fallbackConnectionId,
        notes,
      });
      setLcr(res.lcr);
      await Swal.fire({ title: 'LCR settings saved', icon: 'success', timer: 1500, showConfirmButton: false, ...SWAL_THEME });
    } catch (err) {
      await Swal.fire({
        title: 'Save failed',
        text: err instanceof Error ? err.message : 'Could not save LCR settings',
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
        Loading LCR settings…
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <Link href="/admin" className="mb-2 inline-flex items-center gap-1 text-sm text-slate-400 hover:text-slate-900">
          <ArrowLeft className="h-4 w-4" />
          Platform overview
        </Link>
        <h2 className="page-title">Least cost routing</h2>
        <p className="page-subtitle">
          Primary and failover Telnyx trunks used when provisioning numbers and routing voice traffic.
        </p>
      </div>

      <KpiSection title="Trunk status">
        <KpiCard
          title="Primary trunk"
          value={primaryConnectionId ? 'Configured' : 'Not set'}
          subtitle={primaryConnectionId || 'Uses platform default on next order'}
          icon={GitBranch}
          tone={primaryConnectionId ? 'emerald' : 'amber'}
        />
        <KpiCard
          title="Fallback trunk"
          value={fallbackConnectionId ? 'Configured' : 'Not set'}
          subtitle="Used when primary is unavailable"
          icon={GitBranch}
          tone={fallbackConnectionId ? 'indigo' : 'slate'}
        />
        <KpiCard
          title="Available connections"
          value={lcr?.availableConnections.length ?? 0}
          subtitle="From platform Telnyx settings"
          icon={GitBranch}
          tone="violet"
        />
      </KpiSection>

      <form onSubmit={onSave} className="panel-card space-y-5 p-6">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">Primary connection</label>
          <select
            value={primaryConnectionId}
            onChange={(e) => setPrimaryConnectionId(e.target.value)}
            className="w-full rounded-lg input-field"
          >
            <option value="">Platform default (Call Control → TeXML)</option>
            {(lcr?.availableConnections || []).map((conn) => (
              <option key={conn.id} value={conn.id}>
                {conn.label} ({conn.type}) — {conn.id}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">Fallback connection</label>
          <select
            value={fallbackConnectionId}
            onChange={(e) => setFallbackConnectionId(e.target.value)}
            className="w-full rounded-lg input-field"
          >
            <option value="">None</option>
            {(lcr?.availableConnections || []).map((conn) => (
              <option key={conn.id} value={conn.id}>
                {conn.label} ({conn.type}) — {conn.id}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">Routing notes</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={4}
            placeholder="Document carrier preference, rate deck, or failover rules for your ops team."
            className="w-full rounded-lg input-field"
          />
        </div>

        <p className="text-xs text-slate-500">
          New number orders use the primary connection when tenants check out. Inbound call routing is configured per
          tenant under Call routing. Update Telnyx connection IDs in{' '}
          <Link href="/admin/settings" className="text-indigo-600 hover:text-indigo-500">
            Platform settings
          </Link>
          .
        </p>

        <button type="submit" disabled={saving} className="btn-primary px-4 py-2 text-sm">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save LCR settings
        </button>
      </form>

      {lcr?.availableConnections.length ? (
        <div className="panel-card p-5">
          <h3 className="font-medium text-slate-900">Configured Telnyx connections</h3>
          <ul className="mt-3 space-y-2 text-sm text-slate-600">
            {lcr.availableConnections.map((conn) => (
              <li key={conn.id} className="flex flex-wrap justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2">
                <span>{conn.label}</span>
                <span className="font-mono text-xs text-slate-500">{conn.id}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
