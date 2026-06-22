'use client';

import { useEffect, useState } from 'react';
import { Loader2, LogOut, RefreshCw, UserCog } from 'lucide-react';
import { formatPhoneNumber } from '@/lib/phone';
import {
  disableExtension,
  forceLogoutExtensionDevices,
  getTenantUsers,
  reassignExtensionEmployee,
  resetExtensionSipCredentials,
  type ExtensionRecord,
  type TenantTeamUser,
} from '@/lib/api';

function regStatusBadge(status: string) {
  const styles: Record<string, string> = {
    ONLINE: 'bg-emerald-50 text-emerald-700',
    OFFLINE: 'bg-slate-100 text-slate-600',
    EXPIRED: 'bg-amber-50 text-amber-700',
    UNREGISTERED: 'bg-slate-50 text-slate-400',
  };
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${styles[status] || styles.OFFLINE}`}>
      {status === 'UNREGISTERED' ? 'Not registered' : status.charAt(0) + status.slice(1).toLowerCase()}
    </span>
  );
}

type Props = {
  extension: ExtensionRecord;
  isAdmin: boolean;
  onUpdated: (extension: ExtensionRecord) => void;
};

export function ExtensionOwnershipPanel({ extension, isAdmin, onUpdated }: Props) {
  const [users, setUsers] = useState<TenantTeamUser[]>([]);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [loading, setLoading] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const ownership = extension.ownership;
  const reg = extension.deviceRegistration;
  const primaryDid = ownership?.primaryDid;

  useEffect(() => {
    if (!isAdmin) return;
    getTenantUsers()
      .then((res) => setUsers(res.users))
      .catch(() => {});
  }, [extension.id, isAdmin]);

  async function runAction(name: string, fn: () => Promise<{ extension: ExtensionRecord }>) {
    setLoading(name);
    setError('');
    setMessage('');
    try {
      const res = await fn();
      onUpdated(res.extension);
      setMessage('Done.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action failed');
    } finally {
      setLoading('');
    }
  }

  const employeeName = ownership?.employee.name || extension.displayName || '—';
  const deviceSummary = [
    reg?.mobile?.status && reg.mobile.status !== 'UNREGISTERED' ? 'Mobile' : null,
    reg?.webrtc?.status && reg.webrtc.status !== 'UNREGISTERED' ? 'WebRTC' : null,
    reg?.sip?.status && reg.sip.status !== 'UNREGISTERED' ? 'SIP' : null,
  ]
    .filter(Boolean)
    .join(', ') || 'No devices';

  return (
    <div className="space-y-6">
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {message ? <p className="text-sm text-emerald-600">{message}</p> : null}

      <section className="rounded-xl border border-indigo-100 bg-indigo-50/50 p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-900">Ownership chain</h3>
        <p className="mt-1 text-xs text-slate-500">
          Employee → Extension → DID → Device. Assign the Primary DID from the extension Overview tab when editing.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
          <span className="rounded-lg bg-white px-3 py-2 font-medium text-slate-900 ring-1 ring-slate-200">
            {employeeName}
          </span>
          <span className="text-slate-400">→</span>
          <span className="rounded-lg bg-white px-3 py-2 font-medium text-slate-900 ring-1 ring-slate-200">
            Ext {extension.extensionNumber}
          </span>
          <span className="text-slate-400">→</span>
          <span className="rounded-lg bg-white px-3 py-2 font-medium text-slate-900 ring-1 ring-slate-200">
            {primaryDid ? formatPhoneNumber(primaryDid.number) : 'No DID'}
          </span>
          <span className="text-slate-400">→</span>
          <span className="rounded-lg bg-white px-3 py-2 font-medium text-slate-900 ring-1 ring-slate-200">
            {deviceSummary}
          </span>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-900">Employee information</h3>
        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-slate-500">Employee name</dt>
            <dd className="font-medium text-slate-900">{ownership?.employee.name || '—'}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Email</dt>
            <dd>{ownership?.employee.email || extension.email || '—'}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Department</dt>
            <dd>{ownership?.employee.department || '—'}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Inbound calls go to</dt>
            <dd className="text-indigo-700">{extension.inboundRecipient?.label || '—'}</dd>
          </div>
        </dl>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-900">Device registration</h3>
        <p className="mt-1 text-xs text-slate-500">
          Mobile, WebRTC, and SIP desk phone status for this extension.
        </p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="pb-2 pr-4">Type</th>
                <th className="pb-2 pr-4">Status</th>
                <th className="pb-2 pr-4">Device name</th>
                <th className="pb-2">Last seen</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {[
                { label: 'Mobile', data: reg?.mobile },
                { label: 'WebRTC', data: reg?.webrtc },
                { label: 'SIP desk phone', data: reg?.sip },
              ].map((row) => (
                <tr key={row.label}>
                  <td className="py-2 pr-4 font-medium text-slate-900">{row.label}</td>
                  <td className="py-2 pr-4">{regStatusBadge(row.data?.status || 'UNREGISTERED')}</td>
                  <td className="py-2 pr-4 text-slate-600">{row.data?.deviceName || '—'}</td>
                  <td className="py-2 text-slate-600">
                    {row.data?.lastSeen ? new Date(row.data.lastSeen).toLocaleString() : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {extension.devices.length > 0 ? (
          <ul className="mt-4 space-y-2 border-t border-slate-100 pt-4">
            {extension.devices.map((device) => (
              <li key={device.id} className="flex items-center justify-between text-sm">
                <span>{device.deviceName || device.deviceType}</span>
                {regStatusBadge(device.status)}
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      {isAdmin ? (
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-900">Admin actions</h3>
          <p className="mt-1 text-xs text-slate-500">
            Reassign the extension and its DID to a new employee.
          </p>

          <div className="mt-4 space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700">Reassign employee</label>
              <div className="mt-2 flex flex-wrap gap-2">
                <select
                  value={selectedUserId}
                  onChange={(e) => setSelectedUserId(e.target.value)}
                  className="min-w-[220px] flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
                >
                  <option value="">Select employee…</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({u.email})
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  disabled={!selectedUserId || Boolean(loading)}
                  onClick={() => {
                    if (!confirm('Reassign this extension and its DID to the selected employee?')) return;
                    runAction('reassign', () =>
                      reassignExtensionEmployee(extension.id, selectedUserId).then((r) => ({
                        extension: r.extension,
                      })),
                    );
                  }}
                  className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
                >
                  {loading === 'reassign' ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserCog className="h-4 w-4" />}
                  Reassign
                </button>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-4">
              <button
                type="button"
                disabled={Boolean(loading)}
                onClick={() => {
                  if (!confirm('Reset SIP credentials? The employee must sign in again on all devices.')) return;
                  runAction('reset', () =>
                    resetExtensionSipCredentials(extension.id).then((r) => ({ extension: r.extension })),
                  );
                }}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
              >
                {loading === 'reset' ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                Reset SIP credentials
              </button>
              <button
                type="button"
                disabled={Boolean(loading) || !extension.userId}
                onClick={() => {
                  if (!confirm('Force logout all devices for this employee?')) return;
                  runAction('logout', () =>
                    forceLogoutExtensionDevices(extension.id).then((r) => ({ extension: r.extension })),
                  );
                }}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
              >
                {loading === 'logout' ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
                Force logout devices
              </button>
              <button
                type="button"
                disabled={Boolean(loading) || extension.status === 'INACTIVE'}
                onClick={() => {
                  if (!confirm(`Disable extension ${extension.extensionNumber}?`)) return;
                  runAction('disable', () =>
                    disableExtension(extension.id).then((r) => ({ extension: r.extension })),
                  );
                }}
                className="inline-flex items-center gap-2 rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-60"
              >
                Disable extension
              </button>
            </div>
          </div>
        </section>
      ) : null}
    </div>
  );
}
