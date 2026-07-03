'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Plus, Smartphone } from 'lucide-react';
import { PortalPageHeader } from '@/components/portal/page-header';
import { getMe, isUnauthorizedError } from '@/lib/api';
import { createV3Device, getV3DeviceVendors, getV3Devices, getV3Health, provisionV3DeskDevice, updateV3Device, type DeskDevice } from '@/lib/v3-api';

const STATUS_CLASS: Record<string, string> = {
  CREATED: 'bg-slate-100 text-slate-700',
  ASSIGNED: 'bg-blue-100 text-blue-800',
  PROVISIONED: 'bg-amber-100 text-amber-800',
  REGISTERED: 'bg-emerald-100 text-emerald-800',
  REMOVED: 'bg-rose-100 text-rose-800',
};

export default function DevicesPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [items, setItems] = useState<DeskDevice[]>([]);
  const [vendors, setVendors] = useState<Array<{ id: string; label: string }>>([]);
  const [employees, setEmployees] = useState<Array<{ employeeId: string; name: string; extensionId: string | null; extensionNumber: string | null }>>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [assignId, setAssignId] = useState<string | null>(null);
  const [busy, setBusy] = useState('');
  const [form, setForm] = useState({ vendor: 'yealink', model: '', macAddress: '', serialNumber: '', notes: '' });
  const [assignForm, setAssignForm] = useState({ employeeId: '', extensionId: '' });

  async function load() {
    const [devicesRes, vendorsRes, healthRes] = await Promise.all([
      getV3Devices(),
      getV3DeviceVendors(),
      getV3Health(),
    ]);
    setItems(devicesRes.items || []);
    setVendors(vendorsRes.vendors || []);
    setEmployees((healthRes.employees || []).map((e) => ({
      employeeId: e.employeeId,
      name: e.name,
      extensionId: e.extensionId,
      extensionNumber: e.extensionNumber,
    })));
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

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    setBusy('create');
    setError('');
    try {
      await createV3Device(form);
      setShowAdd(false);
      setForm({ vendor: 'yealink', model: '', macAddress: '', serialNumber: '', notes: '' });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Create failed');
    } finally {
      setBusy('');
    }
  }

  async function onAssign(e: React.FormEvent) {
    e.preventDefault();
    if (!assignId) return;
    setBusy('assign');
    setError('');
    try {
      await updateV3Device(assignId, {
        employeeId: assignForm.employeeId || null,
        extensionId: assignForm.extensionId || null,
      } as Partial<DeskDevice>);
      setAssignId(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Assign failed');
    } finally {
      setBusy('');
    }
  }

  async function onProvision(deviceId: string) {
    setBusy(deviceId);
    setError('');
    try {
      await provisionV3DeskDevice(deviceId);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Provision failed');
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
        title="Desk Phone Inventory"
        description="Manage Yealink, Grandstream, Fanvil, Cisco, Poly, and Snom desk phones."
        actions={
          <button
            type="button"
            onClick={() => setShowAdd(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            <Plus className="h-4 w-4" />
            Add Device
          </button>
        }
      />

      {error && <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{error}</div>}

      {showAdd && (
        <form onSubmit={onCreate} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
          <h3 className="font-medium text-slate-900">Add Device</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm">
              Vendor
              <select className="mt-1 w-full rounded border px-3 py-2" value={form.vendor} onChange={(e) => setForm({ ...form, vendor: e.target.value })}>
                {vendors.map((v) => <option key={v.id} value={v.id}>{v.label}</option>)}
              </select>
            </label>
            <label className="text-sm">
              Model
              <input className="mt-1 w-full rounded border px-3 py-2" value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} />
            </label>
            <label className="text-sm">
              MAC Address
              <input className="mt-1 w-full rounded border px-3 py-2" value={form.macAddress} onChange={(e) => setForm({ ...form, macAddress: e.target.value })} />
            </label>
            <label className="text-sm">
              Serial Number
              <input className="mt-1 w-full rounded border px-3 py-2" value={form.serialNumber} onChange={(e) => setForm({ ...form, serialNumber: e.target.value })} />
            </label>
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={busy === 'create'} className="rounded bg-indigo-600 px-4 py-2 text-sm text-white">Create</button>
            <button type="button" onClick={() => setShowAdd(false)} className="rounded border px-4 py-2 text-sm">Cancel</button>
          </div>
        </form>
      )}

      {assignId && (
        <form onSubmit={onAssign} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
          <h3 className="font-medium text-slate-900">Assign Device</h3>
          <label className="text-sm block">
            Employee
            <select
              className="mt-1 w-full rounded border px-3 py-2"
              value={assignForm.employeeId}
              onChange={(e) => {
                const emp = employees.find((x) => x.employeeId === e.target.value);
                setAssignForm({ employeeId: e.target.value, extensionId: emp?.extensionId || '' });
              }}
            >
              <option value="">Select employee</option>
              {employees.map((e) => <option key={e.employeeId} value={e.employeeId}>{e.name} ({e.extensionNumber || 'no ext'})</option>)}
            </select>
          </label>
          <div className="flex gap-2">
            <button type="submit" disabled={busy === 'assign'} className="rounded bg-indigo-600 px-4 py-2 text-sm text-white">Assign</button>
            <button type="button" onClick={() => setAssignId(null)} className="rounded border px-4 py-2 text-sm">Cancel</button>
          </div>
        </form>
      )}

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-slate-600">
            <tr>
              <th className="px-4 py-3">Device</th>
              <th className="px-4 py-3">Assignment</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Registration</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {items.map((d) => (
              <tr key={d.id}>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2 font-medium text-slate-900">
                    <Smartphone className="h-4 w-4 text-slate-400" />
                    {d.vendor} {d.model || ''}
                  </div>
                  <div className="text-xs text-slate-500">{d.macAddress || 'No MAC'} · {d.serialNumber || 'No serial'}</div>
                </td>
                <td className="px-4 py-3">
                  <div>{d.employeeName || '—'}</div>
                  <div className="text-xs text-slate-500">Ext {d.extensionNumber || '—'} · {d.did || 'No DID'}</div>
                </td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_CLASS[d.status] || STATUS_CLASS.CREATED}`}>{d.status}</span>
                </td>
                <td className="px-4 py-3 capitalize">{d.registrationStatus}</td>
                <td className="px-4 py-3 space-x-2">
                  <button type="button" onClick={() => { setAssignId(d.id); setAssignForm({ employeeId: d.employeeId || '', extensionId: d.extensionId || '' }); }} className="text-indigo-600 hover:underline">Assign</button>
                  <button type="button" disabled={!d.extensionId || busy === d.id} onClick={() => onProvision(d.id)} className="text-indigo-600 hover:underline disabled:opacity-50">Provision</button>
                </td>
              </tr>
            ))}
            {!items.length && (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-500">No desk phones yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
