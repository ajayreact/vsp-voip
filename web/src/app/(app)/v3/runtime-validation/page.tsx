'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Play, RefreshCw } from 'lucide-react';
import { PortalPageHeader } from '@/components/portal/page-header';
import { HealthDot, MetricCard, runV3AdminGuard } from '@/components/v3/ops/ops-ui';
import { getV3RuntimeValidation, runV3RuntimeValidation, type HealthLevel, type V3ValidationReport } from '@/lib/v3-api';

export default function V3RuntimeValidationPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [validation, setValidation] = useState<V3ValidationReport | null>(null);

  const load = useCallback(async () => {
    const res = await getV3RuntimeValidation();
    setValidation(res.validation);
  }, []);

  useEffect(() => {
    runV3AdminGuard(router)
      .then((ok) => (ok ? load() : undefined))
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load validation'))
      .finally(() => setLoading(false));
  }, [router, load]);

  async function onRun() {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const res = await runV3RuntimeValidation();
      setValidation(res.validation);
      setMessage('Validation completed (read-only — no data modified).');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Validation run failed');
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PortalPageHeader
        title="Runtime Validation"
        description="Read-only verification of employees, extensions, numbers, PBX objects, runtime links, and sync jobs."
        actions={
          <div className="flex gap-2">
            <button type="button" onClick={() => load().catch(() => undefined)} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium hover:bg-slate-50">
              <RefreshCw className="h-4 w-4" /> Refresh
            </button>
            <button type="button" disabled={busy} onClick={onRun} className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60">
              <Play className="h-4 w-4" /> Run Validation
            </button>
          </div>
        }
      />

      {validation?.readOnly ? (
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
          All checks are read-only. No configuration or runtime data is modified.
        </div>
      ) : null}

      {error ? <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}
      {message ? <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{message}</div> : null}

      <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <HealthDot level={validation?.overall || 'yellow'} />
        <div>
          <p className="text-sm font-medium text-slate-900">Overall Validation</p>
          <p className="text-xs capitalize text-slate-500">{validation?.overall || 'unknown'}</p>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Domain</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Total</th>
              <th className="px-4 py-3">Passed</th>
              <th className="px-4 py-3">Warnings</th>
              <th className="px-4 py-3">Errors</th>
            </tr>
          </thead>
          <tbody>
            {(validation?.domains || []).map((row) => (
              <tr key={row.domain} className="border-t border-slate-100">
                <td className="px-4 py-3 capitalize">{row.domain.replace(/([A-Z])/g, ' $1')}</td>
                <td className="px-4 py-3"><HealthDot level={row.level as HealthLevel} /></td>
                <td className="px-4 py-3">{row.total}</td>
                <td className="px-4 py-3">{row.passed}</td>
                <td className="px-4 py-3">{row.warnings}</td>
                <td className="px-4 py-3">{row.errors}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <MetricCard label="Domains" value={validation?.domains?.length ?? 0} />
        <MetricCard label="Errors" value={validation?.domains?.reduce((n, d) => n + d.errors, 0) ?? 0} accent="text-rose-600" />
        <MetricCard label="Warnings" value={validation?.domains?.reduce((n, d) => n + d.warnings, 0) ?? 0} accent="text-amber-600" />
        <MetricCard label="Passed Items" value={validation?.domains?.reduce((n, d) => n + d.passed, 0) ?? 0} accent="text-emerald-600" />
      </div>
    </div>
  );
}
