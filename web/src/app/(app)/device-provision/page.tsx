'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Pencil, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { PortalPageHeader } from '@/components/portal/page-header';
import { getMe, isUnauthorizedError } from '@/lib/api';
import {
  createV3Device,
  getV3DeviceVendors,
  getV3Devices,
  provisionV3DeskDevice,
  removeV3Device,
  repairV3Devices,
  updateV3Device,
  type DeskDevice,
} from '@/lib/v3-api';

type DeviceFormState = {
  vendor: string;
  model: string;
  macAddress: string;
  serialNumber: string;
  notes: string;
};

const EMPTY_FORM: DeviceFormState = { vendor: 'grandstream', model: '', macAddress: '', serialNumber: '', notes: '' };

export default function DeviceProvisionPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [items, setItems] = useState<DeskDevice[]>([]);
  const [vendors, setVendors] = useState<Array<{ id: string; label: string }>>([]);
  const [selected, setSelected] = useState<DeskDevice | null>(null);
  const [configPreview, setConfigPreview] = useState('');
  const [provisionUrl, setProvisionUrl] = useState('');
  const [busy, setBusy] = useState('');

  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState<DeviceFormState>(EMPTY_FORM);

  const [editId, setEditId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<DeviceFormState>(EMPTY_FORM);

  async function load() {
    const [devicesRes, vendorsRes] = await Promise.all([getV3Devices(), getV3DeviceVendors()]);
    setItems(devicesRes.items || []);
    setVendors(vendorsRes.vendors || []);
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

  function flash(message: string) {
    setNotice(message);
    window.setTimeout(() => setNotice(''), 4000);
  }

  async function onAddDevice(e: React.FormEvent) {
    e.preventDefault();
    setBusy('add');
    setError('');
    try {
      await createV3Device(addForm);
      setShowAdd(false);
      setAddForm(EMPTY_FORM);
      await load();
      flash('Device added. Assign it to an extension, then Provision.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Add device failed');
    } finally {
      setBusy('');
    }
  }

  function startEdit(device: DeskDevice) {
    setEditId(device.id);
    setEditForm({
      vendor: device.vendor,
      model: device.model || '',
      macAddress: device.macAddress || '',
      serialNumber: device.serialNumber || '',
      notes: device.notes || '',
    });
  }

  async function onEditDevice(e: React.FormEvent) {
    e.preventDefault();
    if (!editId) return;
    setBusy('edit');
    setError('');
    try {
      await updateV3Device(editId, editForm as Partial<DeskDevice>);
      setEditId(null);
      await load();
      flash('Device updated.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed');
    } finally {
      setBusy('');
    }
  }

  async function onDeleteDevice(device: DeskDevice) {
    const label = device.macAddress || device.model || device.id;
    const confirmed = window.confirm(
      `Delete provisioning record for ${device.vendor} (${label})?\n\n` +
      'This removes the device registration, provisioning profile, generated ' +
      'config, and provisioning cache. The employee, extension, and SIP ' +
      'credentials are NOT affected. This cannot be undone.',
    );
    if (!confirmed) return;

    setBusy(device.id);
    setError('');
    try {
      await removeV3Device(device.id);
      if (selected?.id === device.id) {
        setSelected(null);
        setConfigPreview('');
        setProvisionUrl('');
      }
      await load();
      flash(`Device ${label} deleted. Add it again (same MAC) to re-provision from scratch.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
    } finally {
      setBusy('');
    }
  }

  async function onProvision(device: DeskDevice, regenerate = false) {
    setBusy(device.id);
    setError('');
    try {
      const result = await provisionV3DeskDevice(device.id, regenerate);
      setSelected(result.device);
      setConfigPreview(result.config?.body || '');
      setProvisionUrl(result.provisionUrl || '');
      await load();
      flash(regenerate ? 'Configuration regenerated from scratch.' : 'Device provisioned.');
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
      flash('All assigned devices re-provisioned.');
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

  return (
    <div className="space-y-6">
      <PortalPageHeader
        title="Device Provisioning"
        description="Add, edit, delete, and provision desk phones. Deleting a device only removes its provisioning registration — the employee and extension stay intact."
        actions={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowAdd((v) => !v)}
              className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700"
            >
              <Plus className="h-4 w-4" /> Add Device
            </button>
            <button
              type="button"
              onClick={onRepairRegenerate}
              disabled={busy === 'repair'}
              className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm disabled:opacity-50"
            >
              <RefreshCw className="h-4 w-4" /> Re-provision All
            </button>
          </div>
        }
      />

      {error && <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{error}</div>}
      {notice && <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</div>}

      {showAdd && (
        <form onSubmit={onAddDevice} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
          <h3 className="font-medium text-slate-900">Add Device</h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <label className="text-sm">
              Vendor
              <select className="mt-1 w-full rounded border px-3 py-2" value={addForm.vendor} onChange={(e) => setAddForm({ ...addForm, vendor: e.target.value })}>
                {vendors.map((v) => <option key={v.id} value={v.id}>{v.label}</option>)}
              </select>
            </label>
            <label className="text-sm">
              Model
              <input className="mt-1 w-full rounded border px-3 py-2" value={addForm.model} onChange={(e) => setAddForm({ ...addForm, model: e.target.value })} placeholder="GRP2601" />
            </label>
            <label className="text-sm">
              MAC Address
              <input className="mt-1 w-full rounded border px-3 py-2" value={addForm.macAddress} onChange={(e) => setAddForm({ ...addForm, macAddress: e.target.value })} placeholder="EC:74:D7:51:E3:E7" />
            </label>
            <label className="text-sm">
              Serial Number
              <input className="mt-1 w-full rounded border px-3 py-2" value={addForm.serialNumber} onChange={(e) => setAddForm({ ...addForm, serialNumber: e.target.value })} />
            </label>
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={busy === 'add'} className="rounded bg-indigo-600 px-4 py-2 text-sm text-white disabled:opacity-50">Create</button>
            <button type="button" onClick={() => { setShowAdd(false); setAddForm(EMPTY_FORM); }} className="rounded border px-4 py-2 text-sm">Cancel</button>
          </div>
        </form>
      )}

      {editId && (
        <form onSubmit={onEditDevice} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
          <h3 className="font-medium text-slate-900">Edit Device</h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <label className="text-sm">
              Vendor
              <select className="mt-1 w-full rounded border px-3 py-2" value={editForm.vendor} onChange={(e) => setEditForm({ ...editForm, vendor: e.target.value })}>
                {vendors.map((v) => <option key={v.id} value={v.id}>{v.label}</option>)}
              </select>
            </label>
            <label className="text-sm">
              Model
              <input className="mt-1 w-full rounded border px-3 py-2" value={editForm.model} onChange={(e) => setEditForm({ ...editForm, model: e.target.value })} />
            </label>
            <label className="text-sm">
              MAC Address
              <input className="mt-1 w-full rounded border px-3 py-2" value={editForm.macAddress} onChange={(e) => setEditForm({ ...editForm, macAddress: e.target.value })} />
            </label>
            <label className="text-sm">
              Serial Number
              <input className="mt-1 w-full rounded border px-3 py-2" value={editForm.serialNumber} onChange={(e) => setEditForm({ ...editForm, serialNumber: e.target.value })} />
            </label>
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={busy === 'edit'} className="rounded bg-indigo-600 px-4 py-2 text-sm text-white disabled:opacity-50">Save</button>
            <button type="button" onClick={() => setEditId(null)} className="rounded border px-4 py-2 text-sm">Cancel</button>
          </div>
        </form>
      )}

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
              {items.map((d) => (
                <tr key={d.id} className={selected?.id === d.id ? 'bg-indigo-50/50' : ''}>
                  <td className="px-4 py-3">
                    <div className="font-medium">{d.vendor} {d.model || ''}</div>
                    <div className="text-xs text-slate-500">{d.macAddress || d.id} · {d.status}</div>
                  </td>
                  <td className="px-4 py-3">{d.extensionNumber || '—'}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-x-3 gap-y-1">
                      <button
                        type="button"
                        disabled={!d.extensionId || busy === d.id}
                        onClick={() => onProvision(d, false)}
                        className="text-indigo-600 hover:underline disabled:opacity-40"
                        title={!d.extensionId ? 'Assign to an extension first' : undefined}
                      >
                        Provision
                      </button>
                      <button
                        type="button"
                        disabled={!d.extensionId || busy === d.id}
                        onClick={() => onProvision(d, true)}
                        className="text-indigo-600 hover:underline disabled:opacity-40"
                        title={!d.extensionId ? 'Assign to an extension first' : undefined}
                      >
                        Regenerate
                      </button>
                      <button type="button" onClick={() => startEdit(d)} className="inline-flex items-center gap-1 text-slate-600 hover:underline">
                        <Pencil className="h-3.5 w-3.5" /> Edit
                      </button>
                      <button
                        type="button"
                        disabled={busy === d.id}
                        onClick={() => onDeleteDevice(d)}
                        className="inline-flex items-center gap-1 text-rose-600 hover:underline disabled:opacity-40"
                      >
                        <Trash2 className="h-3.5 w-3.5" /> Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {!items.length && (
                <tr><td colSpan={3} className="px-4 py-8 text-center text-slate-500">No devices yet. Click Add Device to register one.</td></tr>
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
                {selected.vendor === 'grandstream' ? (
                  <>
                    <div className="mt-1 break-all text-xs">
                      Config Server Path: {provisionUrl || selected.provisionUrl || '—'}
                    </div>
                    <div className="text-xs text-slate-500">
                      Phone fetches <code>cfg{selected.macAddress?.replace(/[^A-F0-9]/gi, '').toLowerCase() || '{mac}'}.xml</code> automatically (no query key).
                    </div>
                  </>
                ) : (
                  <div className="mt-1 break-all text-xs">URL: {provisionUrl || selected.provisionUrl || '—'}</div>
                )}
                <div className="text-xs">Config v{selected.configVersion} · Provision v{selected.provisionVersion}</div>
                {selected.vendor === 'grandstream' ? (
                  <p className="mt-2 text-xs text-slate-500">
                    On the phone: Maintenance → Provision Server → paste the Config Server Path above, then reboot
                    (or trigger a resync) to pull the regenerated config.
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
