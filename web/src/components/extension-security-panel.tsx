'use client';

import { useEffect, useState } from 'react';
import {
  getExtensionAuditLogs,
  updateExtensionSecurity,
  type ExtensionRecord,
  type ExtensionSecuritySettings,
} from '@/lib/api';

type Props = {
  extension: ExtensionRecord;
  isAdmin: boolean;
  onUpdated: (ext: ExtensionRecord) => void;
};

const RECORDING_OPTIONS = [
  { value: 'ALWAYS', label: 'Always record' },
  { value: 'INBOUND_ONLY', label: 'Inbound only' },
  { value: 'OUTBOUND_ONLY', label: 'Outbound only' },
  { value: 'ON_DEMAND', label: 'On demand' },
  { value: 'DISABLED', label: 'Disabled' },
];

const AFTER_HOURS_OPTIONS = [
  { value: 'BLOCK', label: 'Block calls' },
  { value: 'ALLOW', label: 'Allow calls' },
  { value: 'VOICEMAIL_ONLY', label: 'Voicemail only' },
];

function linesToList(value: string) {
  return value.split('\n').map((s) => s.trim()).filter(Boolean);
}

function listToLines(list: string[]) {
  return (list || []).join('\n');
}

export function ExtensionSecurityPanel({ extension, isAdmin, onUpdated }: Props) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [auditLogs, setAuditLogs] = useState<Array<{
    id: string;
    category: string;
    action: string;
    summary: string | null;
    userEmail: string | null;
    createdAt: string;
  }>>([]);

  const sec = extension.security;
  const [form, setForm] = useState<ExtensionSecuritySettings>(() => sec || {
    whitelist: { numbers: [], prefixes: [], allowInternalExtensions: true },
    blacklist: { numbers: [], patterns: [], blockAnonymous: false, blockSpamPatterns: false },
    blockAnonymous: false,
    spamPatternBlockEnabled: false,
    allowInternalExtensions: true,
    callerId: { outboundNumber: null, hideCallerId: false, displayName: null },
    callingPermissions: { local: true, national: true, international: true, premium: false, emergency: true },
    timeRestrictions: { enabled: false, businessHours: {}, afterHoursAction: 'BLOCK', holidaySchedule: [] },
    recordingPolicy: 'INBOUND_ONLY',
  });

  const [whitelistNumbers, setWhitelistNumbers] = useState('');
  const [whitelistPrefixes, setWhitelistPrefixes] = useState('');
  const [blacklistNumbers, setBlacklistNumbers] = useState('');
  const [blacklistPatterns, setBlacklistPatterns] = useState('');

  useEffect(() => {
    if (extension.security) {
      setForm(extension.security);
      setWhitelistNumbers(listToLines(extension.security.whitelist.numbers));
      setWhitelistPrefixes(listToLines(extension.security.whitelist.prefixes));
      setBlacklistNumbers(listToLines(extension.security.blacklist.numbers));
      setBlacklistPatterns(listToLines(extension.security.blacklist.patterns));
    }
  }, [extension]);

  useEffect(() => {
    getExtensionAuditLogs(extension.id, 15)
      .then((res) => setAuditLogs(res.logs))
      .catch(() => {});
  }, [extension.id]);

  async function onSave() {
    setSaving(true);
    setError('');
    try {
      const payload = {
        whitelist: {
          numbers: linesToList(whitelistNumbers),
          prefixes: linesToList(whitelistPrefixes),
          allowInternalExtensions: form.allowInternalExtensions,
        },
        blacklist: {
          numbers: linesToList(blacklistNumbers),
          patterns: linesToList(blacklistPatterns),
          blockAnonymous: form.blockAnonymous,
          blockSpamPatterns: form.spamPatternBlockEnabled,
        },
        blockAnonymous: form.blockAnonymous,
        spamPatternBlockEnabled: form.spamPatternBlockEnabled,
        allowInternalExtensions: form.allowInternalExtensions,
        callerId: form.callerId,
        callingPermissions: form.callingPermissions,
        timeRestrictions: form.timeRestrictions,
        recordingPolicy: form.recordingPolicy,
      };
      const res = await updateExtensionSecurity(extension.id, payload);
      onUpdated(res.extension);
      const logs = await getExtensionAuditLogs(extension.id, 15);
      setAuditLogs(logs.logs);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-900">Whitelist</h3>
        <p className="mt-1 text-xs text-slate-500">When configured, only matching callers can reach this extension.</p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="text-slate-600">Allowed numbers (one per line)</span>
            <textarea
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              rows={3}
              disabled={!isAdmin}
              value={whitelistNumbers}
              onChange={(e) => setWhitelistNumbers(e.target.value)}
              placeholder="+15551234567"
            />
          </label>
          <label className="block text-sm">
            <span className="text-slate-600">Allowed prefixes</span>
            <textarea
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              rows={3}
              disabled={!isAdmin}
              value={whitelistPrefixes}
              onChange={(e) => setWhitelistPrefixes(e.target.value)}
              placeholder="+1555"
            />
          </label>
        </div>
        <label className="mt-3 flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            disabled={!isAdmin}
            checked={form.allowInternalExtensions}
            onChange={(e) => setForm((f) => ({ ...f, allowInternalExtensions: e.target.checked }))}
          />
          Allow internal extensions
        </label>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-900">Blacklist</h3>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="text-slate-600">Blocked numbers</span>
            <textarea
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              rows={3}
              disabled={!isAdmin}
              value={blacklistNumbers}
              onChange={(e) => setBlacklistNumbers(e.target.value)}
            />
          </label>
          <label className="block text-sm">
            <span className="text-slate-600">Spam patterns (use * wildcard)</span>
            <textarea
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              rows={3}
              disabled={!isAdmin}
              value={blacklistPatterns}
              onChange={(e) => setBlacklistPatterns(e.target.value)}
              placeholder="*900*"
            />
          </label>
        </div>
        <div className="mt-3 space-y-2">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              disabled={!isAdmin}
              checked={form.blockAnonymous}
              onChange={(e) => setForm((f) => ({ ...f, blockAnonymous: e.target.checked }))}
            />
            Block anonymous callers
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              disabled={!isAdmin}
              checked={form.spamPatternBlockEnabled}
              onChange={(e) => setForm((f) => ({ ...f, spamPatternBlockEnabled: e.target.checked }))}
            />
            Block known spam patterns
          </label>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-900">Caller ID controls</h3>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="text-slate-600">Outbound caller ID number</span>
            <input
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              disabled={!isAdmin}
              value={form.callerId.outboundNumber || ''}
              onChange={(e) =>
                setForm((f) => ({ ...f, callerId: { ...f.callerId, outboundNumber: e.target.value || null } }))
              }
            />
          </label>
          <label className="block text-sm">
            <span className="text-slate-600">Custom caller ID name</span>
            <input
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              disabled={!isAdmin}
              value={form.callerId.displayName || ''}
              onChange={(e) =>
                setForm((f) => ({ ...f, callerId: { ...f.callerId, displayName: e.target.value || null } }))
              }
            />
          </label>
        </div>
        <label className="mt-3 flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            disabled={!isAdmin}
            checked={form.callerId.hideCallerId}
            onChange={(e) =>
              setForm((f) => ({ ...f, callerId: { ...f.callerId, hideCallerId: e.target.checked } }))
            }
          />
          Hide caller ID on outbound calls
        </label>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-900">Calling permissions</h3>
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {([
            ['local', 'Local only'],
            ['national', 'National'],
            ['international', 'International'],
            ['premium', 'Premium numbers'],
            ['emergency', 'Emergency numbers'],
          ] as const).map(([key, label]) => (
            <label key={key} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                disabled={!isAdmin || key === 'emergency'}
                checked={form.callingPermissions[key]}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    callingPermissions: { ...f.callingPermissions, [key]: e.target.checked },
                  }))
                }
              />
              {label}
            </label>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-900">Time restrictions</h3>
        <label className="mt-3 flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            disabled={!isAdmin}
            checked={form.timeRestrictions.enabled}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                timeRestrictions: { ...f.timeRestrictions, enabled: e.target.checked },
              }))
            }
          />
          Enforce business hours
        </label>
        <label className="mt-3 block text-sm">
          <span className="text-slate-600">After hours action</span>
          <select
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            disabled={!isAdmin}
            value={form.timeRestrictions.afterHoursAction}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                timeRestrictions: {
                  ...f.timeRestrictions,
                  afterHoursAction: e.target.value as 'BLOCK' | 'ALLOW' | 'VOICEMAIL_ONLY',
                },
              }))
            }
          >
            {AFTER_HOURS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </label>
        <p className="mt-2 text-xs text-slate-400">
          Holiday schedule uses the same business-hours pattern. Visual editor coming in a future release.
        </p>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-900">Recording policy</h3>
        <select
          className="mt-3 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          disabled={!isAdmin}
          value={form.recordingPolicy}
          onChange={(e) => setForm((f) => ({ ...f, recordingPolicy: e.target.value as ExtensionSecuritySettings['recordingPolicy'] }))}
        >
          {RECORDING_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-900">Audit log</h3>
        {auditLogs.length === 0 ? (
          <p className="mt-3 text-sm text-slate-400">No security changes recorded yet.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {auditLogs.map((log) => (
              <li key={log.id} className="rounded-lg border border-slate-100 px-3 py-2 text-sm">
                <div className="flex justify-between gap-2">
                  <span className="font-medium capitalize text-slate-800">{log.category}</span>
                  <span className="text-xs text-slate-400">{new Date(log.createdAt).toLocaleString()}</span>
                </div>
                <p className="text-slate-600">{log.summary || log.action}</p>
                {log.userEmail ? <p className="text-xs text-slate-400">by {log.userEmail}</p> : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      {isAdmin ? (
        <button
          type="button"
          disabled={saving}
          onClick={onSave}
          className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
        >
          {saving ? 'Saving…' : 'Save security settings'}
        </button>
      ) : null}
    </div>
  );
}
