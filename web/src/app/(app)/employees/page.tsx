'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, Loader2, UserPlus, Wrench, XCircle } from 'lucide-react';
import { PortalPageHeader } from '@/components/portal/page-header';
import { getMe, isUnauthorizedError } from '@/lib/api';
import { applyV3Repair, createV3Employee, getV3Health, inspectV3Repair, type CreateV3EmployeeResult, type EmployeeHealth, type RepairApplyReport, type RepairInspectReport } from '@/lib/v3-api';

function ProvisionResult({ result }: { result: CreateV3EmployeeResult }) {
  const provisioned = result.provision?.provisioned;
  return (
    <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm">
      <div className="flex items-center gap-2 font-medium text-emerald-800">
        <CheckCircle2 className="h-4 w-4" />
        Employee created: {result.employee.name}
      </div>
      <ul className="mt-2 space-y-1 text-emerald-700">
        <li>Extension <strong>{result.extension.extensionNumber}</strong> created</li>
        <li className="flex items-center gap-1.5">
          {provisioned ? (
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
          ) : (
            <XCircle className="h-3.5 w-3.5 text-amber-600" />
          )}
          {provisioned
            ? `Provision Complete — SIP user ${result.provision.telnyxSipUsername || ''}`
            : `Provisioning incomplete (${result.provision?.reason || 'will retry via Repair'})`}
        </li>
      </ul>
    </div>
  );
}

export default function EmployeesPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState<CreateV3EmployeeResult | null>(null);

  const [inspecting, setInspecting] = useState(false);
  const [applying, setApplying] = useState(false);
  const [inspectReport, setInspectReport] = useState<RepairInspectReport | null>(null);
  const [applyReport, setApplyReport] = useState<RepairApplyReport | null>(null);
  const [repairError, setRepairError] = useState('');
  const [employees, setEmployees] = useState<EmployeeHealth[]>([]);

  useEffect(() => {getMe()
      .then((user) => {
        if (user.role !== 'TENANT_ADMIN' && user.role !== 'SUPER_ADMIN') {
          router.replace('/dashboard');
          return;
        }
        return getV3Health().then((res) => setEmployees(res.employees || []));
      })
      .catch((err) => {
        if (isUnauthorizedError(err)) router.replace('/login');
        else setError(err instanceof Error ? err.message : 'Could not load page');
      })
      .finally(() => setLoading(false));
  }, [router]);

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setError('');
    setCreated(null);
    try {
      const result = await createV3Employee(form);
      setCreated(result);
      setForm({ name: '', email: '', password: '' });
      const health = await getV3Health();
      setEmployees(health.employees || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create employee');
    } finally {
      setCreating(false);
    }
  }

  async function onInspect() {
    setInspecting(true);
    setRepairError('');
    setApplyReport(null);
    try {
      setInspectReport(await inspectV3Repair());
    } catch (err) {
      setRepairError(err instanceof Error ? err.message : 'Inspect failed');
    } finally {
      setInspecting(false);
    }
  }

  async function onApply() {
    setApplying(true);
    setRepairError('');
    try {
      const report = await applyV3Repair();
      setApplyReport(report);
      setInspectReport(null);
    } catch (err) {
      setRepairError(err instanceof Error ? err.message : 'Repair failed');
    } finally {
      setApplying(false);
    }
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center text-slate-500">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  const pendingChanges = inspectReport?.changes || [];

  return (
    <div className="space-y-8">
      <PortalPageHeader
        title="Employees"
        description="Create employees with extensions and view telephony readiness for each team member."
      />

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-base font-semibold text-slate-900">Team & extensions</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-slate-600">
              <tr>
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2">Ext</th>
                <th className="px-3 py-2">DID</th>
                <th className="px-3 py-2">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {employees.map((emp) => (
                <tr key={emp.employeeId}>
                  <td className="px-3 py-2">
                    <div className="font-medium">{emp.name}</div>
                    <div className="text-xs text-slate-500">{emp.email}</div>
                  </td>
                  <td className="px-3 py-2">{emp.extensionNumber || '—'}</td>
                  <td className="px-3 py-2">{emp.did || '—'}</td>
                  <td className="px-3 py-2 capitalize">{emp.overall}</td>
                </tr>
              ))}
              {!employees.length ? (
                <tr><td colSpan={4} className="px-3 py-6 text-center text-slate-500">No employees yet.</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      {error ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
      ) : null}

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="flex items-center gap-2 text-base font-semibold text-slate-900">
          <UserPlus className="h-4 w-4" /> Create employee
        </h2>
        <form onSubmit={onCreate} className="mt-4 grid gap-4 sm:grid-cols-3">
          <div>
            <label className="block text-xs font-medium text-slate-600">Full name</label>
            <input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              required
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600">Email</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              required
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600">Temporary password</label>
            <input
              type="password"
              value={form.password}
              onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
              required
              minLength={6}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none"
            />
          </div>
          <div className="sm:col-span-3">
            <button
              type="submit"
              disabled={creating}
              className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
            >
              {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
              Create & provision
            </button>
          </div>
        </form>
        {created ? <div className="mt-4"><ProvisionResult result={created} /></div> : null}
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 text-base font-semibold text-slate-900">
            <Wrench className="h-4 w-4" /> Repair PBX
          </h2>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onInspect}
              disabled={inspecting || applying}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
            >
              {inspecting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Inspect
            </button>
            <button
              type="button"
              onClick={onApply}
              disabled={applying || inspecting || pendingChanges.length === 0}
              className="inline-flex items-center gap-2 rounded-lg bg-amber-600 px-3 py-2 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50"
            >
              {applying ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Apply repairs
            </button>
          </div>
        </div>
        <p className="mt-1 text-xs text-slate-500">
          Inspect is read-only. Apply repairs only missing or inconsistent links — it never deletes data.
        </p>

        {repairError ? (
          <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-700">{repairError}</div>
        ) : null}

        {inspectReport ? (
          <div className="mt-4 space-y-3">
            <p className="text-sm text-slate-600">
              Scanned {inspectReport.scanned.extensions} extensions, {inspectReport.scanned.users} employees,{' '}
              {inspectReport.scanned.phoneNumbers} numbers.
            </p>
            {pendingChanges.length === 0 ? (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                Consistent — no missing or inconsistent links found.
              </div>
            ) : (
              <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
                {pendingChanges.map((c, i) => (
                  <li key={`${c.type}-${c.ref}-${i}`} className="flex items-center gap-3 px-4 py-2 text-sm">
                    <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">{c.type}</span>
                    <span className="text-slate-700">{c.entity} <strong>{c.ref}</strong> — {c.detail}</span>
                  </li>
                ))}
              </ul>
            )}
            {inspectReport.observations.length > 0 ? (
              <div className="text-xs text-slate-500">
                <p className="font-medium">Observations (reported, not modified):</p>
                <ul className="mt-1 list-disc pl-5">
                  {inspectReport.observations.map((o, i) => <li key={i}>{o}</li>)}
                </ul>
              </div>
            ) : null}
          </div>
        ) : null}

        {applyReport ? (
          <div className="mt-4 space-y-2">
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              Applied {applyReport.applied.filter((a) => a.ok).length} of {applyReport.applied.length} repairs.
            </div>
            {applyReport.applied.length > 0 ? (
              <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
                {applyReport.applied.map((a, i) => (
                  <li key={`${a.type}-${a.ref}-${i}`} className="flex items-center gap-3 px-4 py-2 text-sm">
                    {a.ok ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    ) : (
                      <XCircle className="h-4 w-4 text-rose-600" />
                    )}
                    <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">{a.type}</span>
                    <span className="text-slate-700">{a.entity} <strong>{a.ref}</strong></span>
                    {a.error ? <span className="text-rose-600">{a.error}</span> : null}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}
      </section>
    </div>
  );
}
