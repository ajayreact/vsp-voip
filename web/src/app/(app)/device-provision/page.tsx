'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, RefreshCw } from 'lucide-react';
import { PortalPageHeader } from '@/components/portal/page-header';
import { getMe, isUnauthorizedError } from '@/lib/api';
import { getV3Devices, provisionV3DeskDevice, repairV3Devices, type DeskDevice } from '@/lib/v3-api';

export default function DeviceProvisionPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [items, setItems] = useState<DeskDevice[]>([]);
  const [selected, setSelected] = useState<DeskDevice | null>(null);
  const [configPreview, setConfigPreview] = useState('');
  const [provisionUrl, setProvisionUrl] = useState('');
  const [busy, setBusy] = useState('');

  async function load() {
    const res = await getV3Devices();
    setItems((res.items || []).filter((d) => d.status !== 'REMOVED'));
  }

  useEffect(() => {getMe()
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
  }, [router]);

  async function onProvision(device: DeskDevice, regenerate = false) {
    setBusy(device.id);
    setError('');
    try {
      const result = await provisionV3DeskDevice(device.id, regenerate);
      setSelected(result.device);
      setConfigPreview(result.config?.body || '');
      setProvisionUrl(result.provisionUrl || '');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Provision failed');
    } finally {
      setBusy('');
    }
  }

  async function onRepairRegenerate() {
    setBusy('repair');
    setError('');
    try {
      await repairV3Devices(true, true);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Re-provision failed');
    } finally {
      setBusy('');
    }
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center text-slate-500">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  const assignable = items.filter((d) => d.extensionId);

  return (
    <div className="space-y-6">
      <PortalPageHeader
        title="Device Provisioning"
        description="Generate vendor-specific configs and provision URLs for assigned desk phones."
        actions={
          <button
            type="button"
            onClick={onRepairRegenerate}
            disabled={busy === 'repair'}
            className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm"
          >
            <RefreshCw className="h-4 w-4" /> Re-provision All
          </button>
        }
      />

      {error && <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{error}</div>}

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-slate-600">
              <tr>
                <th className="px-4 py-3">Device</th>
                <th className="px-4 py-3">Extension</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {assignable.map((d) => (
                <tr key={d.id} className={selected?.id === d.id ? 'bg-indigo-50/50' : ''}>
                  <td className="px-4 py-3">
                    <div className="font-medium">{d.vendor} {d.model || ''}</div>
                    <div className="text-xs text-slate-500">{d.macAddress || d.id}</div>
                  </td>
                  <td className="px-4 py-3">{d.extensionNumber || '—'}</td>
                  <td className="px-4 py-3 space-x-2">
                    <button type="button" disabled={busy === d.id} onClick={() => onProvision(d, false)} className="text-indigo-600 hover:underline disabled:opacity-50">Provision</button>
                    <button type="button" disabled={busy === d.id} onClick={() => onProvision(d, true)} className="text-indigo-600 hover:underline disabled:opacity-50">Regenerate</button>
                  </td>
                </tr>
              ))}
              {!assignable.length && (
                <tr><td colSpan={3} className="px-4 py-8 text-center text-slate-500">Assign devices to extensions first.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
          <h3 className="font-medium text-slate-900">Provision Output</h3>
          {selected ? (
            <>
              <div className="text-sm text-slate-600">
                <div><strong>{selected.vendor}</strong> · Ext {selected.extensionNumber}</div>
                <div className="mt-1 break-all text-xs">URL: {provisionUrl || selected.provisionUrl || '—'}</div>
                <div className="text-xs">Config v{selected.configVersion} · Provision v{selected.provisionVersion}</div>
                {selected.vendor === 'grandstream' ? (
                  <p className="mt-2 text-xs text-slate-500">
                    On the phone: Maintenance → Provision Server → set base URL to your API host with path <code>/provision/</code>, then reboot.
                    Grandstream fetches <code>cfg{'{MAC}'}.xml</code> automatically.
                  </p>
                ) : null}
              </div>
              <pre className="max-h-96 overflow-auto rounded border bg-slate-50 p-3 text-xs text-slate-800">{configPreview || 'Run Provision to preview config.'}</pre>
            </>
          ) : (
            <p className="text-sm text-slate-500">Select a device and run Provision to view generated configuration.</p>
          )}
        </div>
      </div>
    </div>
  );
}
