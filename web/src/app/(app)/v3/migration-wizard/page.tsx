'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Loader2,
  Play,
  RotateCcw,
  Search,
  ShieldCheck,
} from 'lucide-react';
import { PortalPageHeader } from '@/components/portal/page-header';
import { HealthDot, MetricCard, runV3SuperAdminGuard } from '@/components/v3/ops/ops-ui';
import type { HealthLevel } from '@/lib/v3-api';
import {
  getV3MigrationWizardDiscovery,
  previewV3MigrationWizard,
  rollbackV3MigrationWizard,
  runV3MigrationWizard,
  validateV3MigrationWizard,
} from '@/lib/v3-api';

type WizardStep = 'discovery' | 'validation' | 'preview' | 'execute' | 'health' | 'completed';

const STEPS: { id: WizardStep; label: string }[] = [
  { id: 'discovery', label: 'Discovery' },
  { id: 'validation', label: 'Validation' },
  { id: 'preview', label: 'Preview' },
  { id: 'execute', label: 'Execute' },
  { id: 'health', label: 'Health Check' },
  { id: 'completed', label: 'Completed' },
];

function levelClass(level: HealthLevel | string | undefined) {
  if (level === 'red') return 'text-rose-700 bg-rose-50 border-rose-200';
  if (level === 'yellow') return 'text-amber-800 bg-amber-50 border-amber-200';
  return 'text-emerald-800 bg-emerald-50 border-emerald-200';
}

export default function V3MigrationWizardPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [step, setStep] = useState<WizardStep>('discovery');
  const [tenantId, setTenantId] = useState('');
  const [discovery, setDiscovery] = useState<Record<string, unknown> | null>(null);
  const [validation, setValidation] = useState<Record<string, unknown> | null>(null);
  const [preview, setPreview] = useState<Record<string, unknown> | null>(null);
  const [runReport, setRunReport] = useState<Record<string, unknown> | null>(null);
  const [postValidation, setPostValidation] = useState<Record<string, unknown> | null>(null);
  const [migrationRunId, setMigrationRunId] = useState('');
  const [backupId, setBackupId] = useState('');

  useEffect(() => {
    runV3SuperAdminGuard(router)
      .then((user) => {
        if (user) setAuthorized(true);
        else router.replace('/dashboard');
      })
      .catch(() => router.replace('/dashboard'))
      .finally(() => setLoading(false));
  }, [router]);

  const requireTenant = useCallback(() => {
    if (!tenantId.trim()) {
      setError('Enter a tenant ID to continue.');
      return false;
    }
    setError('');
    return true;
  }, [tenantId]);

  async function onDiscovery() {
    if (!requireTenant()) return;
    setBusy('discovery');
    try {
      const res = await getV3MigrationWizardDiscovery(tenantId.trim());
      setDiscovery(res.discovery);
      setStep('discovery');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Discovery failed');
    } finally {
      setBusy('');
    }
  }

  async function onValidation() {
    if (!requireTenant()) return;
    setBusy('validation');
    try {
      const res = await validateV3MigrationWizard(tenantId.trim());
      setValidation(res.validation as Record<string, unknown>);
      setStep('validation');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Validation failed');
    } finally {
      setBusy('');
    }
  }

  async function onPreview() {
    if (!requireTenant()) return;
    setBusy('preview');
    try {
      const res = await previewV3MigrationWizard(tenantId.trim());
      setPreview(res.preview as Record<string, unknown>);
      setStep('preview');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Preview failed');
    } finally {
      setBusy('');
    }
  }

  async function onExecute(dryRun: boolean) {
    if (!requireTenant()) return;
    setBusy(dryRun ? 'dry-run' : 'execute');
    try {
      const res = await runV3MigrationWizard(tenantId.trim(), { dryRun, apply: !dryRun, autoRollback: true });
      setRunReport(res.report);
      setPostValidation(res.postValidation as Record<string, unknown>);
      const run = res.run as { id?: string; backupId?: string; status?: string };
      if (run?.id) setMigrationRunId(run.id);
      if (run?.backupId) setBackupId(run.backupId);
      setStep(dryRun ? 'preview' : 'health');
      if (!dryRun) setStep('completed');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Migration failed');
    } finally {
      setBusy('');
    }
  }

  async function onRollback(previewOnly: boolean) {
    if (!requireTenant()) return;
    setBusy('rollback');
    try {
      const res = await rollbackV3MigrationWizard(tenantId.trim(), {
        migrationRunId: migrationRunId || undefined,
        backupId: backupId || undefined,
        dryRun: previewOnly,
      });
      setRunReport((res.rollback as { report?: Record<string, unknown> })?.report || res.rollback);
      if (!previewOnly) setStep('completed');
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

  if (!authorized) return null;

  const counts = (discovery?.counts || preview?.inventory) as Record<string, number> | undefined;
  const previewValidation = preview?.validation as { overall?: string } | undefined;
  const validationOverall = (validation?.overall as string | undefined) || previewValidation?.overall;
  const actions = preview?.actions as Record<string, { create?: number; update?: number; assign?: number }> | undefined;
  const pass = postValidation?.pass as string | undefined;

  return (
    <div className="space-y-6">
      <PortalPageHeader
        title="Tenant Migration Wizard"
        description="Super-admin orchestration to migrate one tenant from legacy portal to V3 — discovery, validation, preview, execute, health check, and rollback."
      />

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <label className="block text-sm font-medium text-slate-700">Target tenant ID</label>
        <div className="mt-2 flex flex-wrap gap-2">
          <input
            type="text"
            value={tenantId}
            onChange={(e) => setTenantId(e.target.value)}
            placeholder="UUID of tenant to migrate"
            className="min-w-[20rem] flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <button type="button" disabled={!!busy} onClick={onDiscovery} className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60">
            <Search className="h-4 w-4" /> Discover
          </button>
        </div>
      </div>

      <nav className="flex flex-wrap gap-2">
        {STEPS.map((s, i) => {
          const active = step === s.id;
          return (
            <div key={s.id} className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setStep(s.id)}
                className={`rounded-full px-3 py-1 text-xs font-medium ${active ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'}`}
              >
                {i + 1}. {s.label}
              </button>
              {i < STEPS.length - 1 ? <ChevronRight className="h-4 w-4 text-slate-400" /> : null}
            </div>
          );
        })}
      </nav>

      {error ? <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}

      {step === 'discovery' && (
        <section className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={!!busy} onClick={onValidation} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium hover:bg-slate-50 disabled:opacity-60">
              Continue to Validation
            </button>
          </div>
          {!discovery ? (
            <p className="text-sm text-slate-500">Run Discovery to load tenant inventory.</p>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
                {counts && Object.entries(counts).map(([key, value]) => (
                  <MetricCard key={key} label={key} value={value} />
                ))}
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <h3 className="mb-2 text-sm font-semibold text-slate-900">Inventory snapshot</h3>
                <pre className="max-h-80 overflow-auto rounded-lg bg-slate-50 p-3 text-xs text-slate-700">{JSON.stringify(discovery.inventory, null, 2)}</pre>
              </div>
            </>
          )}
        </section>
      )}

      {step === 'validation' && (
        <section className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={!!busy} onClick={onValidation} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium hover:bg-slate-50 disabled:opacity-60">
              {busy === 'validation' ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
              Run Validation
            </button>
            <button type="button" disabled={!!busy} onClick={onPreview} className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60">
              Continue to Preview
            </button>
          </div>
          {validation ? (
            <div className={`rounded-lg border px-4 py-3 text-sm ${levelClass(validationOverall as string)}`}>
              Overall: <strong>{String(validationOverall || 'unknown')}</strong>
              {' — '}
              {String((validation.summary as Record<string, number>)?.red ?? 0)} errors,{' '}
              {String((validation.summary as Record<string, number>)?.yellow ?? 0)} warnings
            </div>
          ) : null}
          {validation?.grouped ? (
            <div className="grid gap-4 lg:grid-cols-2">
              {(['red', 'yellow'] as const).map((level) => {
                const items = (validation.grouped as Record<string, Array<{ code: string; message: string }>>)[level] || [];
                return (
                  <div key={level} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                    <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold capitalize text-slate-900">
                      <HealthDot level={level} /> {level} ({items.length})
                    </h3>
                    <ul className="max-h-64 space-y-1 overflow-auto text-xs text-slate-600">
                      {items.slice(0, 40).map((item, idx) => (
                        <li key={`${item.code}-${idx}`}>{item.message}</li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          ) : null}
        </section>
      )}

      {step === 'preview' && (
        <section className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={!!busy} onClick={onPreview} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium hover:bg-slate-50 disabled:opacity-60">
              Refresh Preview
            </button>
            <button type="button" disabled={!!busy} onClick={() => onExecute(true)} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium hover:bg-slate-50 disabled:opacity-60">
              <Play className="h-4 w-4" /> Dry Run
            </button>
            <button type="button" disabled={!!busy || validationOverall === 'red'} onClick={() => onExecute(false)} className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60">
              <Play className="h-4 w-4" /> Execute Migration
            </button>
          </div>
          {validationOverall === 'red' ? (
            <div className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              Blocking validation errors — resolve before executing live migration.
            </div>
          ) : null}
          {actions ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {Object.entries(actions).map(([domain, ops]) => (
                <div key={domain} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm text-sm">
                  <p className="font-semibold capitalize text-slate-900">{domain.replace(/([A-Z])/g, ' $1')}</p>
                  <ul className="mt-2 space-y-1 text-slate-600">
                    {ops.create != null ? <li>Create {ops.create}</li> : null}
                    {ops.update != null ? <li>Update {ops.update}</li> : null}
                    {ops.assign != null ? <li>Assign {ops.assign}</li> : null}
                  </ul>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-500">Run Preview to see planned changes (read-only).</p>
          )}
        </section>
      )}

      {(step === 'execute' || step === 'health' || step === 'completed') && (
        <section className="space-y-4">
          {pass ? (
            <div className={`flex items-center gap-2 rounded-lg border px-4 py-3 text-sm ${pass === 'PASS' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-rose-200 bg-rose-50 text-rose-700'}`}>
              {pass === 'PASS' ? <CheckCircle2 className="h-5 w-5" /> : <AlertTriangle className="h-5 w-5" />}
              Post-migration validation: <strong>{pass}</strong>
            </div>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={!!busy} onClick={() => onRollback(true)} className="inline-flex items-center gap-2 rounded-lg border border-amber-300 px-3 py-2 text-sm font-medium text-amber-900 hover:bg-amber-50 disabled:opacity-60">
              <RotateCcw className="h-4 w-4" /> Rollback Preview
            </button>
            <button type="button" disabled={!!busy || !backupId} onClick={() => onRollback(false)} className="inline-flex items-center gap-2 rounded-lg border border-rose-300 px-3 py-2 text-sm font-medium text-rose-800 hover:bg-rose-50 disabled:opacity-60">
              <RotateCcw className="h-4 w-4" /> Restore Backup
            </button>
          </div>
          {backupId ? (
            <p className="text-sm text-slate-600">Rollback available from backup <code className="rounded bg-slate-100 px-1">{backupId.slice(0, 8)}…</code></p>
          ) : null}
          {runReport ? (
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <h3 className="mb-2 text-sm font-semibold text-slate-900">Migration report</h3>
              <pre className="max-h-96 overflow-auto rounded-lg bg-slate-50 p-3 text-xs text-slate-700">{JSON.stringify(runReport, null, 2)}</pre>
            </div>
          ) : null}
          {postValidation ? (
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <h3 className="mb-2 text-sm font-semibold text-slate-900">Health &amp; validation</h3>
              <pre className="max-h-96 overflow-auto rounded-lg bg-slate-50 p-3 text-xs text-slate-700">{JSON.stringify(postValidation, null, 2)}</pre>
            </div>
          ) : null}
        </section>
      )}
    </div>
  );
}
