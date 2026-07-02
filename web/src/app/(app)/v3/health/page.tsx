'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, RefreshCw, ShieldCheck } from 'lucide-react';
import { PortalPageHeader } from '@/components/portal/page-header';
import { getMe, isUnauthorizedError } from '@/lib/api';
import {
  getV3Health,
  isV3PortalEnabled,
  type EmployeeHealth,
  type HealthLevel,
  type HealthSummary,
  type PbxHealthResponse,
  type PbxObjectHealth,
  type SoftphoneHealthResponse,
  type SystemHealthResponse,
} from '@/lib/v3-api';

const LEVEL_CLASS: Record<HealthLevel, string> = {
  green: 'bg-emerald-500',
  yellow: 'bg-amber-500',
  red: 'bg-rose-500',
};

const CHECK_LABELS: Array<{ key: keyof EmployeeHealth['checks']; label: string }> = [
  { key: 'extension', label: 'Extension' },
  { key: 'credential', label: 'Credential' },
  { key: 'sipUsername', label: 'SIP User' },
  { key: 'device', label: 'Device' },
  { key: 'registration', label: 'Registered' },
  { key: 'did', label: 'DID' },
  { key: 'callControlReady', label: 'Call Control' },
  { key: 'webhookReady', label: 'Webhook' },
  { key: 'softphoneReady', label: 'Softphone' },
];

function Dot({ level, title }: { level: HealthLevel; title?: string }) {
  return (
    <span
      title={title}
      className={`inline-block h-2.5 w-2.5 rounded-full ${LEVEL_CLASS[level]}`}
    />
  );
}

function SummaryCard({ label, value, accent }: { label: string; value: number; accent?: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`mt-1 text-2xl font-semibold ${accent || 'text-slate-900'}`}>{value}</p>
    </div>
  );
}

export default function V3HealthCenterPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [summary, setSummary] = useState<HealthSummary | null>(null);
  const [employees, setEmployees] = useState<EmployeeHealth[]>([]);
  const [pbx, setPbx] = useState<PbxHealthResponse | null>(null);
  const [softphone, setSoftphone] = useState<SoftphoneHealthResponse | null>(null);
  const [systemHealth, setSystemHealth] = useState<SystemHealthResponse | null>(null);

  async function load() {
    const res = await getV3Health();
    setSummary(res.summary);
    setEmployees(res.employees || []);
    setPbx(res.pbx || null);
    setSoftphone(res.softphone || null);
    setSystemHealth(res.systemHealth || null);
  }

  useEffect(() => {
    if (!isV3PortalEnabled()) {
      router.replace('/dashboard');
      return;
    }
    getMe()
      .then((user) => {
        if (user.role !== 'TENANT_ADMIN' && user.role !== 'SUPER_ADMIN') {
          router.replace('/dashboard');
          return;
        }
        return load();
      })
      .catch((err) => {
        if (isUnauthorizedError(err)) router.replace('/login');
        else setError(err instanceof Error ? err.message : 'Could not load health');
      })
      .finally(() => setLoading(false));
  }, [router]);

  async function onRefresh() {
    setRefreshing(true);
    setError('');
    try {
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Refresh failed');
    } finally {
      setRefreshing(false);
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
    <div className="space-y-6">
      <PortalPageHeader
        title="Health Center"
        description="Per-employee telephony readiness across extension, credential, device, and Telnyx configuration."
        actions={
          <button
            type="button"
            onClick={onRefresh}
            disabled={refreshing}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        }
      />

      {error ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
      ) : null}

      {summary ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <SummaryCard label="Employees" value={summary.totalEmployees} />
          <SummaryCard label="Ready" value={summary.ready} accent="text-emerald-600" />
          <SummaryCard label="Warnings" value={summary.warnings} accent="text-amber-600" />
          <SummaryCard label="Errors" value={summary.errors} accent="text-rose-600" />
          <SummaryCard label="Registered" value={summary.registeredSip} accent="text-emerald-600" />
          <SummaryCard label="Offline" value={summary.unregisteredSip} accent="text-slate-500" />
        </div>
      ) : null}

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Employee</th>
                <th className="px-4 py-3">Ext</th>
                <th className="px-4 py-3">DID</th>
                {CHECK_LABELS.map((c) => (
                  <th key={c.key} className="px-2 py-3 text-center">{c.label}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {employees.length === 0 ? (
                <tr>
                  <td colSpan={4 + CHECK_LABELS.length} className="px-4 py-8 text-center text-slate-500">
                    No employees yet.
                  </td>
                </tr>
              ) : (
                employees.map((emp) => (
                  <tr key={emp.employeeId} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <Dot level={emp.overall} title={emp.overall} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-900">{emp.name}</div>
                      <div className="text-xs text-slate-500">{emp.email}</div>
                    </td>
                    <td className="px-4 py-3 text-slate-700">{emp.extensionNumber || '—'}</td>
                    <td className="px-4 py-3 text-slate-700">{emp.did || '—'}</td>
                    {CHECK_LABELS.map((c) => (
                      <td key={c.key} className="px-2 py-3 text-center">
                        <Dot level={emp.checks[c.key]} title={`${c.label}: ${emp.checks[c.key]}`} />
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {pbx ? (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-slate-900">PBX Objects</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <SummaryCard label="PBX Total" value={pbx.summary.total} />
            <SummaryCard label="Ready" value={pbx.summary.ready} accent="text-emerald-600" />
            <SummaryCard label="Warnings" value={pbx.summary.warnings} accent="text-amber-600" />
            <SummaryCard label="Errors" value={pbx.summary.errors} accent="text-rose-600" />
          </div>
          <PbxHealthTable title="Ring Groups" items={pbx.ringGroups} />
          <PbxHealthTable title="Queues" items={pbx.queues} />
          <PbxHealthTable title="Business Hours" items={pbx.businessHours} />
          <PbxHealthTable title="Holidays" items={pbx.holidays} />
          <PbxHealthTable title="Voicemail" items={pbx.voicemails} />
        </div>
      ) : null}

      {softphone ? (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-slate-900">Softphone UX</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <SummaryCard label="Users" value={softphone.summary.total} />
            <SummaryCard label="Ready" value={softphone.summary.ready} accent="text-emerald-600" />
            <SummaryCard label="Warnings" value={softphone.summary.warnings} accent="text-amber-600" />
            <SummaryCard label="Directory Sync" value={softphone.directory.synced ? 1 : 0} accent={softphone.directory.synced ? 'text-emerald-600' : 'text-amber-600'} />
          </div>
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">User</th>
                  <th className="px-4 py-3">Profile</th>
                  <th className="px-4 py-3">Device</th>
                  <th className="px-4 py-3">Caller ID</th>
                  <th className="px-4 py-3">Presence</th>
                  <th className="px-4 py-3">Directory</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {softphone.users.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-slate-500">No users configured.</td>
                  </tr>
                ) : (
                  softphone.users.map((u) => (
                    <tr key={u.userId}>
                      <td className="px-4 py-3"><Dot level={u.overall} /></td>
                      <td className="px-4 py-3 font-mono text-xs text-slate-600">{u.userId.slice(0, 8)}…</td>
                      <td className="px-4 py-3"><Dot level={u.checks.profileComplete} title="Profile complete" /></td>
                      <td className="px-4 py-3"><Dot level={u.checks.preferredDevice} title={u.preferredDevice || 'none'} /></td>
                      <td className="px-4 py-3"><Dot level={u.checks.callerId} title={u.callerId || 'none'} /></td>
                      <td className="px-4 py-3"><Dot level={u.checks.presenceConfig} title={u.presenceStatus} /></td>
                      <td className="px-4 py-3"><Dot level={u.checks.directorySync} /></td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {systemHealth ? (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-slate-900">System Overview</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <SummaryCard label="Overall Score" value={systemHealth.overallScore} accent="text-emerald-600" />
            <SummaryCard label="Departments" value={systemHealth.departmentHealth.length} />
            <SummaryCard label="Repair Suggestions" value={systemHealth.repairSuggestions.length} accent={systemHealth.repairSuggestions.length ? 'text-amber-600' : undefined} />
            <SummaryCard label="Trend Points" value={systemHealth.historicalTrend.length} />
          </div>
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 px-4 py-2 text-sm font-medium text-slate-700">Department Health</div>
            <table className="min-w-full divide-y divide-slate-100 text-sm">
              <tbody>
                {systemHealth.departmentHealth.map((dept) => (
                  <tr key={dept.department}>
                    <td className="w-8 px-4 py-2"><Dot level={dept.overall} /></td>
                    <td className="px-4 py-2 font-medium">{dept.department}</td>
                    <td className="px-4 py-2 text-xs text-slate-500">{dept.ready} ready · {dept.warnings} warn · {dept.errors} err</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {systemHealth.repairSuggestions.length > 0 ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              <p className="font-medium">Repair suggestions</p>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                {systemHealth.repairSuggestions.slice(0, 5).map((s, i) => (
                  <li key={`${s.type}-${i}`}>{s.type}: {s.detail}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}

      {systemHealth?.lifecycleHealth ? (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-slate-900">Billing & Lifecycle Health</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            <SummaryCard label="License" value={systemHealth.lifecycleHealth.license.warnings} accent={systemHealth.lifecycleHealth.license.level === 'green' ? 'text-emerald-600' : 'text-amber-600'} />
            <SummaryCard label="Storage (MB)" value={Math.round(systemHealth.lifecycleHealth.storage.totalEstimatedMb)} />
            <SummaryCard label="Backups" value={systemHealth.lifecycleHealth.backup.count} />
            <SummaryCard label="Subscription" value={systemHealth.lifecycleHealth.subscription.level === 'green' ? 1 : 0} accent={systemHealth.lifecycleHealth.subscription.level === 'green' ? 'text-emerald-600' : 'text-amber-600'} />
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Billing</p>
              <p className={`mt-1 text-lg font-semibold ${systemHealth.lifecycleHealth.billing.level === 'green' ? 'text-emerald-600' : 'text-rose-600'}`}>{systemHealth.lifecycleHealth.billing.status}</p>
            </div>
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500">
        <span className="inline-flex items-center gap-1.5"><Dot level="green" /> Ready</span>
        <span className="inline-flex items-center gap-1.5"><Dot level="yellow" /> Needs attention</span>
        <span className="inline-flex items-center gap-1.5"><Dot level="red" /> Blocking</span>
        <span className="inline-flex items-center gap-1.5 text-slate-400">
          <ShieldCheck className="h-3.5 w-3.5" /> Read-only view — no changes are made here.
        </span>
      </div>
    </div>
  );
}

function PbxHealthTable({ title, items }: { title: string; items: PbxObjectHealth[] }) {
  if (!items.length) return null;
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-4 py-2 text-sm font-medium text-slate-700">{title}</div>
      <table className="min-w-full divide-y divide-slate-100 text-sm">
        <tbody>
          {items.map((item) => (
            <tr key={item.id}>
              <td className="w-8 px-4 py-2"><Dot level={item.overall} /></td>
              <td className="px-4 py-2 font-medium">{item.name}</td>
              <td className="px-4 py-2 text-xs text-slate-500">{item.reasons.join('; ') || 'OK'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
