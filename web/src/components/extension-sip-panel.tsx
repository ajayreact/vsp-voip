'use client';

import { useEffect, useState } from 'react';
import { Copy, Loader2, RefreshCw } from 'lucide-react';
import {
  getExtensionSipCredentials,
  resetExtensionSipCredentials,
  type ExtensionRecord,
  type ExtensionSipCredentials,
} from '@/lib/api';

type Props = {
  extension: ExtensionRecord;
  isAdmin: boolean;
  onUpdated: (extension: ExtensionRecord) => void;
};

function CopyField({
  label,
  value,
  onCopy,
  mono = true,
}: {
  label: string;
  value: string | null | undefined;
  onCopy: (label: string, value: string) => void;
  mono?: boolean;
}) {
  if (!value) return null;
  return (
    <div>
      <dt className="text-slate-500">{label}</dt>
      <dd className="mt-1 flex flex-wrap items-center gap-2">
        <code className={`rounded bg-slate-100 px-2 py-1 text-slate-900 ${mono ? 'font-mono text-sm' : 'text-sm'}`}>
          {value}
        </code>
        <button
          type="button"
          onClick={() => onCopy(label, value)}
          className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-500"
        >
          <Copy className="h-3.5 w-3.5" />
          Copy
        </button>
      </dd>
    </div>
  );
}

export function ExtensionSipPanel({ extension, isAdmin, onUpdated }: Props) {
  const [loading, setLoading] = useState(true);
  const [resetting, setResetting] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [sip, setSip] = useState<ExtensionSipCredentials | null>(null);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const res = await getExtensionSipCredentials(extension.id);
      setSip(res.sip);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load SIP credentials');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load().catch(() => {});
  }, [extension.id]);

  async function copyText(label: string, value: string) {
    await navigator.clipboard.writeText(value);
    setMessage(`${label} copied`);
    setTimeout(() => setMessage(''), 2000);
  }

  async function copyAllCredentials() {
    if (!sip?.sipUsername) return;
    const block = [
      `Extension: ${sip.extensionNumber} — ${sip.displayName}`,
      `SIP Username: ${sip.sipUsername}`,
      `SIP Password: ${sip.sipPassword || '(not stored — reset credentials)'}`,
      `SIP Server: ${sip.sipServer}`,
      `SIP Port: ${sip.sipPort}`,
      `Transport: ${sip.sipTransport}`,
      `Credential Connection: ${sip.credentialConnectionName || sip.credentialConnectionId || '—'}`,
    ].join('\n');
    await copyText('All SIP credentials', block);
  }

  async function onReset() {
    if (!confirm('Reset SIP credentials? The employee must re-provision all devices.')) return;
    setResetting(true);
    setError('');
    try {
      const res = await resetExtensionSipCredentials(extension.id);
      onUpdated(res.extension);
      await load();
      setMessage('SIP credentials reset.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Reset failed');
    } finally {
      setResetting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-slate-400">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        Loading SIP credentials…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {message ? <p className="text-sm text-emerald-600">{message}</p> : null}

      {!extension.userId ? (
        <p className="text-sm text-amber-700">No employee assigned — extension SIP credentials are still available below.</p>
      ) : null}

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-900">Telnyx SIP credentials</h3>
        <p className="mt-1 text-xs text-slate-500">
          Desk phone and WebRTC registration for {sip?.employeeName || 'this extension'}.
        </p>

        <dl className="mt-4 grid gap-4 sm:grid-cols-2">
          <CopyField label="SIP username" value={sip?.sipUsername} onCopy={copyText} />
          <CopyField label="SIP password" value={sip?.sipPassword} onCopy={copyText} />
          <CopyField label="SIP server" value={sip?.sipServer} onCopy={copyText} />
          <CopyField label="SIP port (UDP)" value={sip?.sipPort != null ? String(sip.sipPort) : null} onCopy={copyText} />
          <CopyField label="SIP port (TLS)" value={sip?.sipPortTls != null ? String(sip.sipPortTls) : null} onCopy={copyText} />
          <CopyField label="Transport" value={sip?.sipTransport} onCopy={copyText} mono={false} />
          <CopyField label="SIP URI" value={sip?.sipUri} onCopy={copyText} />
          <CopyField
            label="Credential connection"
            value={sip?.credentialConnectionName || sip?.credentialConnectionId}
            onCopy={copyText}
            mono={false}
          />
        </dl>

        {sip?.loginToken ? (
          <div className="mt-4 border-t border-slate-100 pt-4">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">WebRTC login token</p>
            <code className="mt-2 block max-h-20 overflow-auto rounded bg-slate-100 p-2 font-mono text-xs break-all">
              {sip.loginToken}
            </code>
            <button
              type="button"
              onClick={() => copyText('WebRTC login token', sip.loginToken!)}
              className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-indigo-600"
            >
              <Copy className="h-3.5 w-3.5" />
              Copy token
            </button>
          </div>
        ) : null}

        {isAdmin ? (
          <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
            <button
              type="button"
              disabled={resetting}
              onClick={onReset}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
            >
              {resetting ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Reset SIP password
            </button>
            <button
              type="button"
              onClick={() => load()}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Refresh
            </button>
            {sip?.sipUsername ? (
              <button
                type="button"
                onClick={() => copyAllCredentials()}
                className="inline-flex items-center gap-2 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm font-medium text-indigo-700 hover:bg-indigo-100"
              >
                <Copy className="h-4 w-4" />
                Copy all credentials
              </button>
            ) : null}
          </div>
        ) : null}
      </section>
    </div>
  );
}
