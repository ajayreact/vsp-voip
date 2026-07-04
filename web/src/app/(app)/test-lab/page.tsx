'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Play, Trash2, FlaskConical } from 'lucide-react';
import { PortalPageHeader } from '@/components/portal/page-header';
import { MetricCard, runV3SuperAdminGuard } from '@/components/v3/ops/ops-ui';
import {
  getV3TestLabRun,
  getV3TestLabStatus,
  listV3TestLabRuns,
  runV3TestLab,
  teardownV3TestLabTenant,
  type V3TestLabReport,
  type V3TestLabRun,
  type V3TestLabStatus,
} from '@/lib/v3-api';

const MANUAL_CHECKLIST = [
  'Employee lifecycle — login, QR, SIP credentials, delete/restore in UI',
  'Number lifecycle — live purchase, remove, reassign',
  'Desk phone — Yealink add, config, provision, register, reboot',
  'Runtime sync — verify V3 Object → Job → Link → Legacy after each change',
  'Call Flow — build DID → Business Hours → Ring Group → Voicemail in builder',
  'Repair Center — break links intentionally, run Repair',
  'Backup — backup, delete objects, restore preview, restore',
  'Migration — preview, execute, rollback',
  'Monitoring — queue, metrics, health, diagnostics dashboards',
  'Telephony — enable runtime sync for test tenant only; live call scenarios',
];

export default function TestLabPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState<V3TestLabStatus | null>(null);
  const [runs, setRuns] = useState<V3TestLabRun[]>([]);
  const [report, setReport] = useState<V3TestLabReport | null>(null);
  const [credentials, setCredentials] = useState<{ email: string; password: string } | null>(null);
  const [employeeCount, setEmployeeCount] = useState(20);
  const [teardown, setTeardown] = useState(true);
  const [keepTenantName, setKeepTenantName] = useState('VSP V3 Test');
  const [pendingTenantId, setPendingTenantId] = useState('');

  const load = useCallback(async () => {
    const [statusRes, runsRes] = await Promise.all([getV3TestLabStatus(), listV3TestLabRuns()]);
    setStatus(statusRes.status);
    setRuns(runsRes.items);
  }, []);

  useEffect(() => {
    runV3SuperAdminGuard(router)
      .then((user) => {
        if (user) {
          setAuthorized(true);
          return load();
        }
        router.replace('/dashboard');
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load test lab'))
      .finally(() => setLoading(false));
  }, [router, load]);

  async function onRun() {
    setBusy('run');
    setError('');
    setMessage('');
    setReport(null);
    setCredentials(null);
    try {
      const res = await runV3TestLab({
        tenantName: keepTenantName,
        employeeCount,
        simulateNumbers: true,
        teardownOnFinish: teardown,
      });
      setReport(res.report);
      setCredentials(res.credentials || null);
      setMessage(res.summary?.overallPass ? 'Integration harness passed.' : 'Integration harness completed with failures.');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Test lab run failed');
    } finally {
      setBusy('');
    }
  }

  async function onViewRun(runId: string) {
    setBusy('view');
    try {
      const res = await getV3TestLabRun(runId);
      setReport(res.report);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load run');
    } finally {
      setBusy('');
    }
  }

  async function onTeardown() {
    if (!pendingTenantId.trim()) return;
    setBusy('teardown');
    setError('');
    try {
      await teardownV3TestLabTenant(pendingTenantId.trim());
      setMessage('Test tenant torn down.');
      setPendingTenantId('');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Teardown failed');
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

  const steps = report?.steps || [];
  const summary = report?.summary || {};

  return (
    <div className="space-y-6">
      <PortalPageHeader
        title="V3 Test Lab"
        description="Automated integration harness — creates a staging tenant, seeds 20 employees, simulates numbers, publishes call flows, validates runtime sync, and produces a pass/fail report."
        actions={
          <button type="button" disabled={!!busy || !status?.enabled} onClick={onRun} className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60">
            <Play className="h-4 w-4" /> {busy === 'run' ? 'Running…' : 'Run Full Harness'}
          </button>
        }
      />

      {!status?.enabled ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Test Lab is disabled. Set <code className="text-xs">V3_TEST_LAB_ENABLED=true</code> on staging API before running.
        </div>
      ) : null}

      {error ? <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}
      {message ? <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{message}</div> : null}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <MetricCard label="Harness" value={status?.enabled ? 'Enabled' : 'Disabled'} accent={status?.enabled ? 'text-emerald-600' : 'text-amber-600'} />
        <MetricCard label="Runtime Sync" value={status?.environment.runtimeSyncEnabled ? 'On' : 'Off'} />
        <MetricCard label="Default Employees" value={status?.defaults.employeeCount ?? 20} />
        <MetricCard label="Last Result" value={summary.overallPass === true ? 'PASS' : summary.overallPass === false ? 'FAIL' : '—'} accent={summary.overallPass === true ? 'text-emerald-600' : summary.overallPass === false ? 'text-rose-600' : undefined} />
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-900">
          <FlaskConical className="h-4 w-4" /> Run Options
        </h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="text-sm">
            <span className="mb-1 block text-slate-600">Tenant name</span>
            <input value={keepTenantName} onChange={(e) => setKeepTenantName(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-slate-600">Employees</span>
            <input type="number" min={1} max={50} value={employeeCount} onChange={(e) => setEmployeeCount(Number(e.target.value))} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          </label>
          <label className="flex items-end gap-2 text-sm text-slate-700 pb-2">
            <input type="checkbox" checked={teardown} onChange={(e) => setTeardown(e.target.checked)} className="rounded border-slate-300" />
            Teardown after run (recommended)
          </label>
        </div>
        <p className="mt-3 text-xs text-slate-500">
          Uncheck teardown to keep <strong>VSP V3 Test</strong> for manual UI checklist validation. Enable runtime sync for that tenant only via allowlist before live telephony tests.
        </p>
      </div>

      {credentials ? (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm">
          <p className="font-medium text-slate-900">Test tenant admin credentials (for manual UI login)</p>
          <p className="mt-1 font-mono text-xs">Email: {credentials.email}</p>
          <p className="font-mono text-xs">Password: {credentials.password}</p>
        </div>
      ) : null}

      {steps.length > 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="border-b border-slate-100 px-4 py-3 text-sm font-semibold text-slate-900">Automated Steps</div>
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-2">Step</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2">Duration</th>
                <th className="px-4 py-2">Details</th>
              </tr>
            </thead>
            <tbody>
              {steps.map((step) => (
                <tr key={step.step} className="border-t border-slate-100">
                  <td className="px-4 py-2 font-mono text-xs">{step.step}</td>
                  <td className="px-4 py-2"><StatusBadge status={step.status} /></td>
                  <td className="px-4 py-2 text-slate-500">{step.durationMs != null ? `${step.durationMs}ms` : '—'}</td>
                  <td className="px-4 py-2 text-xs text-slate-600">{step.error || JSON.stringify(step.details || {})}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="mb-3 text-sm font-semibold text-slate-900">Manual UI Checklist</h3>
          <ul className="space-y-2 text-sm text-slate-700">
            {MANUAL_CHECKLIST.map((item) => (
              <li key={item} className="flex gap-2">
                <span className="text-slate-400">□</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="mb-3 text-sm font-semibold text-slate-900">Recent Runs</h3>
          {runs.length === 0 ? (
            <p className="text-sm text-slate-500">No runs yet.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {runs.map((run) => (
                <li key={run.id} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
                  <div>
                    <p className="font-medium">{run.tenantName || 'Test Lab Run'}</p>
                    <p className="text-xs text-slate-500">{new Date(run.createdAt).toLocaleString()} · {run.status}</p>
                  </div>
                  <button type="button" disabled={!!busy} onClick={() => onViewRun(run.id)} className="text-xs text-slate-600 underline hover:text-slate-900">
                    View
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="mb-3 text-sm font-semibold text-slate-900">Manual Teardown</h3>
        <p className="mb-3 text-xs text-slate-500">If you kept a test tenant (teardown unchecked), paste its tenant ID to remove it safely.</p>
        <div className="flex flex-wrap gap-2">
          <input value={pendingTenantId} onChange={(e) => setPendingTenantId(e.target.value)} placeholder="Tenant UUID" className="min-w-[16rem] flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          <button type="button" disabled={!!busy || !pendingTenantId.trim()} onClick={onTeardown} className="inline-flex items-center gap-2 rounded-lg border border-rose-300 px-3 py-2 text-sm font-medium text-rose-800 hover:bg-rose-50 disabled:opacity-60">
            <Trash2 className="h-4 w-4" /> Teardown Tenant
          </button>
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const cls = status === 'pass'
    ? 'bg-emerald-100 text-emerald-800'
    : status === 'fail'
      ? 'bg-rose-100 text-rose-800'
      : status === 'skip'
        ? 'bg-slate-100 text-slate-600'
        : 'bg-amber-100 text-amber-800';
  return <span className={`rounded px-2 py-0.5 text-xs font-medium capitalize ${cls}`}>{status}</span>;
}
