'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Play, RotateCcw, Search } from 'lucide-react';
import { PortalPageHeader } from '@/components/portal/page-header';
import { MetricCard, runV3AdminGuard } from '@/components/v3/ops/ops-ui';
import {
  getV3MigrationReport,
  previewV3Migration,
  rollbackV3Migration,
  runV3Migration,
} from '@/lib/v3-api';

export default function MigrationPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [preview, setPreview] = useState<Record<string, unknown> | null>(null);
  const [report, setReport] = useState<Record<string, unknown> | null>(null);
  const [dryRun, setDryRun] = useState(true);

  const loadReport = useCallback(async () => {
    const res = await getV3MigrationReport();
    setReport(res.report);
  }, []);

  useEffect(() => {
    runV3AdminGuard(router)
      .then((ok) => (ok ? loadReport() : undefined))
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load migration report'))
      .finally(() => setLoading(false));
  }, [router, loadReport]);

  async function onPreview() {
    setBusy('preview');
    setError('');
    setMessage('');
    try {
      const res = await previewV3Migration({});
      setPreview(res.preview);
      setMessage('Migration preview generated (read-only).');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Preview failed');
    } finally {
      setBusy('');
    }
  }

  async function onRun() {
    setBusy('run');
    setError('');
    setMessage('');
    try {
      const res = await runV3Migration({ dryRun, apply: !dryRun });
      setReport(res.report);
      setMessage(dryRun ? 'Dry run completed — no changes applied.' : 'Migration executed.');
      await loadReport();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Migration failed');
    } finally {
      setBusy('');
    }
  }

  async function onRollback() {
    setBusy('rollback');
    setError('');
    setMessage('');
    try {
      const res = await rollbackV3Migration({ dryRun: true });
      setMessage(`Rollback preview ready${res.result?.backupId ? ` (backup ${String(res.result.backupId).slice(0, 8)}…)` : ''}.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Rollback failed');
    } finally {
      setBusy('');
    }
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  const currentCounts = preview?.currentCounts as Record<string, number> | undefined;

  return (
    <div className="space-y-6">
      <PortalPageHeader
        title="Tenant Migration"
        description="Preview, validate, execute, and rollback tenant configuration using V3 backups."
        actions={
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={!!busy} onClick={onPreview} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium hover:bg-slate-50 disabled:opacity-60">
              <Search className="h-4 w-4" /> Preview
            </button>
            <button type="button" disabled={!!busy} onClick={onRun} className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60">
              <Play className="h-4 w-4" /> {dryRun ? 'Dry Run' : 'Execute'}
            </button>
            <button type="button" disabled={!!busy} onClick={onRollback} className="inline-flex items-center gap-2 rounded-lg border border-amber-300 px-3 py-2 text-sm font-medium text-amber-900 hover:bg-amber-50 disabled:opacity-60">
              <RotateCcw className="h-4 w-4" /> Rollback Preview
            </button>
          </div>
        }
      />

      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input type="checkbox" checked={dryRun} onChange={(e) => setDryRun(e.target.checked)} className="rounded border-slate-300" />
        Dry run (recommended) — no configuration changes unless unchecked
      </label>

      {error ? <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}
      {message ? <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{message}</div> : null}

      {currentCounts ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
          {Object.entries(currentCounts).map(([key, value]) => (
            <MetricCard key={key} label={key} value={value} />
          ))}
        </div>
      ) : (
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
          Run Preview to see current tenant item counts before migration.
        </div>
      )}

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="mb-3 text-sm font-semibold text-slate-900">Latest Migration Report</h3>
        {!report ? (
          <p className="text-sm text-slate-500">No migration runs yet.</p>
        ) : (
          <pre className="max-h-96 overflow-auto rounded-lg bg-slate-50 p-3 text-xs text-slate-700">
            {JSON.stringify(report, null, 2)}
          </pre>
        )}
      </div>
    </div>
  );
}
