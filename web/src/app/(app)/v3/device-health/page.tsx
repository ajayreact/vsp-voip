'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Wrench } from 'lucide-react';
import { PortalPageHeader } from '@/components/portal/page-header';
import { getMe, isUnauthorizedError } from '@/lib/api';
import {
  getV3DevicesHealth,
  isV3PortalEnabled,
  repairV3Devices,
  type DeviceHealth,
} from '@/lib/v3-api';

const LEVEL_DOT: Record<string, string> = {
  green: 'bg-emerald-500',
  yellow: 'bg-amber-500',
  red: 'bg-rose-500',
};

const REG_LABEL: Record<string, string> = {
  registered: '🟢 Registered',
  offline: '🟡 Provisioned but Offline',
  never: '🔴 Never Registered',
};

export default function V3DeviceHealthPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [devices, setDevices] = useState<DeviceHealth[]>([]);
  const [summary, setSummary] = useState({ total: 0, registered: 0, offline: 0, neverRegistered: 0, ready: 0, warnings: 0, errors: 0 });
  const [repairMsg, setRepairMsg] = useState('');

  async function load() {
    const res = await getV3DevicesHealth();
    setDevices(res.devices || []);
    setSummary(res.summary || summary);
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
        else setError(err instanceof Error ? err.message : 'Failed to load');
      })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load on mount only
  }, [router]);

  async function onRepair(apply: boolean) {
    setRepairMsg('');
    try {
      const report = await repairV3Devices(apply);
      setRepairMsg(`${report.mode}: ${report.changes.length} change(s)${apply ? `, ${report.applied.filter((a) => a.ok).length} applied` : ''}`);
      if (apply) await load();
    } catch (err) {
      setRepairMsg(err instanceof Error ? err.message : 'Repair failed');
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
        title="Device Health Center"
        description="Registration, provisioning, and credential readiness for desk phones."
        actions={
          <div className="flex gap-2">
            <button type="button" onClick={() => onRepair(false)} className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm">
              <Wrench className="h-4 w-4" /> Inspect
            </button>
            <button type="button" onClick={() => onRepair(true)} className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-3 py-2 text-sm text-white">
              <Wrench className="h-4 w-4" /> Repair
            </button>
          </div>
        }
      />

      {error && <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{error}</div>}
      {repairMsg && <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">{repairMsg}</div>}

      <div className="grid gap-4 sm:grid-cols-4">
        <Stat label="Total" value={summary.total} />
        <Stat label="Registered" value={summary.registered} />
        <Stat label="Offline" value={summary.offline} />
        <Stat label="Never Registered" value={summary.neverRegistered} />
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-slate-600">
            <tr>
              <th className="px-4 py-3">Device</th>
              <th className="px-4 py-3">Registration</th>
              <th className="px-4 py-3">Health</th>
              <th className="px-4 py-3">Details</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {devices.map((d) => (
              <tr key={d.deviceId}>
                <td className="px-4 py-3">
                  <div className="font-medium">{d.vendor} {d.model || ''}</div>
                  <div className="text-xs text-slate-500">{d.macAddress || d.deviceId}</div>
                </td>
                <td className="px-4 py-3">{REG_LABEL[d.registrationStatus] || d.registrationStatus}</td>
                <td className="px-4 py-3">
                  <span className={`inline-block h-2.5 w-2.5 rounded-full ${LEVEL_DOT[d.overall]}`} title={d.overall} />
                  <span className="ml-2 capitalize">{d.overall}</span>
                </td>
                <td className="px-4 py-3 text-xs text-slate-600">
                  <div>Firmware: {d.firmwareVersion || '—'}</div>
                  <div>Config v{d.configVersion} · Provision v{d.provisionVersion}</div>
                  {d.reasons.length > 0 && <div className="mt-1 text-amber-700">{d.reasons.join('; ')}</div>}
                </td>
              </tr>
            ))}
            {!devices.length && (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-slate-500">No devices to show.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="text-xs uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-1 text-2xl font-semibold text-slate-900">{value}</div>
    </div>
  );
}
