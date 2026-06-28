'use client';

import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Copy, Download, Loader2, QrCode, RefreshCw } from 'lucide-react';
import {
  createExtensionProvisioningToken,
  getExtensionSipCredentials,
  resetExtensionSipCredentials,
  type ExtensionRecord,
  type ExtensionSipCredentials,
} from '@/lib/api';

type Props = {
  extension: ExtensionRecord;
  isAdmin: boolean;
  onUpdated: (extension: ExtensionRecord) => void;
  onOpenQrTab?: () => void;
};

function CopyField({
  label,
  value,
  onCopy,
  mono = true,
  masked = false,
}: {
  label: string;
  value: string | null | undefined;
  onCopy: (label: string, value: string) => void;
  mono?: boolean;
  masked?: boolean;
}) {
  if (!value) return null;
  const display = masked ? '••••••••' : value;
  return (
    <div>
      <dt className="text-slate-500">{label}</dt>
      <dd className="mt-1 flex flex-wrap items-center gap-2">
        <code className={`rounded bg-slate-100 px-2 py-1 text-slate-900 ${mono ? 'font-mono text-sm' : 'text-sm'}`}>
          {display}
        </code>
        {!masked ? (
          <button
            type="button"
            onClick={() => onCopy(label, value)}
            className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-500"
          >
            <Copy className="h-3.5 w-3.5" />
            Copy
          </button>
        ) : (
          <button
            type="button"
            onClick={() => onCopy(label, value)}
            className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-500"
          >
            <Copy className="h-3.5 w-3.5" />
            Copy password
          </button>
        )}
      </dd>
    </div>
  );
}

export function ExtensionSipPanel({ extension, isAdmin, onUpdated, onOpenQrTab }: Props) {
  const [loading, setLoading] = useState(true);
  const [resetting, setResetting] = useState(false);
  const [generatingQr, setGeneratingQr] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [sip, setSip] = useState<ExtensionSipCredentials | null>(null);
  const [mobileQrDataUrl, setMobileQrDataUrl] = useState('');

  async function load() {
    setLoading(true);
    setError('');
    try {
      const res = await getExtensionSipCredentials(extension.id);
      setSip(res.sip);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load configuration');
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
    const codecLabels = (sip.codecs || []).filter((c) => c.enabled).map((c) => c.label).join(', ');
    const block = [
      `Tenant: ${sip.tenantName || '—'} (${sip.tenantId || '—'})`,
      `Employee: ${sip.employeeName}`,
      `Extension: ${sip.extensionNumber} — ${sip.displayName}`,
      `SIP Server: ${sip.sipServer}`,
      `Outbound Proxy: ${sip.outboundProxy}`,
      `SIP Username: ${sip.sipUsername}`,
      `Authentication ID: ${sip.sipUsername}`,
      `SIP Password: ${sip.sipPassword || '(reset required)'}`,
      `Transport: ${sip.sipTransport}`,
      `Port (UDP): ${sip.sipPort}`,
      `Port (TLS): ${sip.sipPortTls}`,
      `Registration: ${sip.registrationExpirySec || 3600}s`,
      `Symmetric RTP: ${sip.symmetricRtp ? 'Yes' : 'No'}`,
      `SRTP: ${sip.srtp || 'Optional'}`,
      `Codecs: ${codecLabels || 'G722, PCMU, PCMA'}`,
    ].join('\n');
    await copyText('Configuration', block);
  }

  function downloadConfiguration() {
    const payload = sip?.configExport || {
      format: 'vsp-extension-config',
      version: 3,
      exportedAt: new Date().toISOString(),
      extension: { number: sip?.extensionNumber, displayName: sip?.displayName },
      sip,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `vsp-ext-${sip?.extensionNumber || extension.extensionNumber}-config.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    setMessage('Configuration downloaded');
    setTimeout(() => setMessage(''), 2000);
  }

  async function generateMobileQr() {
    if (!extension.userId) {
      setError('Assign an employee before generating a mobile QR code.');
      return;
    }
    setGeneratingQr(true);
    setError('');
    try {
      const res = await createExtensionProvisioningToken(extension.id, 'mobile');
      const dataUrl = await QRCode.toDataURL(res.provisioning.qrPayloadJson, {
        width: 220,
        margin: 2,
        color: { dark: '#1e293b', light: '#ffffff' },
      });
      setMobileQrDataUrl(dataUrl);
      setMessage('Mobile QR generated (expires in 15 minutes). No passwords are embedded in the QR.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not generate QR code');
    } finally {
      setGeneratingQr(false);
    }
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
        Loading configuration…
      </div>
    );
  }

  const codecSummary = (sip?.codecs || [])
    .filter((codec) => codec.enabled)
    .map((codec) => codec.label)
    .join(', ');

  return (
    <div className="space-y-4">
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {message ? <p className="text-sm text-emerald-600">{message}</p> : null}

      {!extension.userId ? (
        <p className="text-sm text-amber-700">Assign an employee to enable mobile QR provisioning and employee SIP credentials.</p>
      ) : null}

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-900">Telnyx configuration</h3>
        <p className="mt-1 text-xs text-slate-500">
          Employee credential for {sip?.employeeName || 'this extension'} — mobile and desk phones share one SIP identity.
        </p>

        <dl className="mt-4 grid gap-4 sm:grid-cols-2">
          <CopyField label="Tenant" value={sip?.tenantName ? `${sip.tenantName}` : null} onCopy={copyText} mono={false} />
          <CopyField label="Employee" value={sip?.employeeName} onCopy={copyText} mono={false} />
          <CopyField label="SIP server" value={sip?.sipServer} onCopy={copyText} />
          <CopyField label="Outbound proxy" value={sip?.outboundProxy} onCopy={copyText} />
          <CopyField label="SIP username" value={sip?.sipUsername} onCopy={copyText} />
          <CopyField label="Authentication ID" value={sip?.sipUsername} onCopy={copyText} />
          {isAdmin ? (
            <CopyField label="Password" value={sip?.sipPassword} onCopy={copyText} masked />
          ) : null}
          <CopyField label="Transport" value={sip?.sipTransport} onCopy={copyText} mono={false} />
          <CopyField label="Port (UDP)" value={sip?.sipPort != null ? String(sip.sipPort) : null} onCopy={copyText} />
          <CopyField label="Port (TLS)" value={sip?.sipPortTls != null ? String(sip.sipPortTls) : null} onCopy={copyText} />
          <CopyField
            label="Registration"
            value={sip?.registrationExpirySec ? `${sip.registrationExpirySec}s` : '3600s'}
            onCopy={copyText}
            mono={false}
          />
          <CopyField label="Symmetric RTP" value={sip?.symmetricRtp ? 'Enabled' : 'Disabled'} onCopy={copyText} mono={false} />
          <CopyField label="SRTP" value={sip?.srtp || 'Optional'} onCopy={copyText} mono={false} />
          <CopyField label="Codecs" value={codecSummary || 'G722, G711u, G711a'} onCopy={copyText} mono={false} />
          <CopyField label="SIP URI" value={sip?.sipUri} onCopy={copyText} />
        </dl>

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
            <button
              type="button"
              onClick={() => copyAllCredentials()}
              className="inline-flex items-center gap-2 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm font-medium text-indigo-700 hover:bg-indigo-100"
            >
              <Copy className="h-4 w-4" />
              Copy configuration
            </button>
            <button
              type="button"
              onClick={downloadConfiguration}
              className="inline-flex items-center gap-2 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm font-medium text-indigo-700 hover:bg-indigo-100"
            >
              <Download className="h-4 w-4" />
              Download configuration
            </button>
            <button
              type="button"
              disabled={generatingQr}
              onClick={() => (onOpenQrTab ? onOpenQrTab() : generateMobileQr())}
              className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
            >
              {generatingQr ? <Loader2 className="h-4 w-4 animate-spin" /> : <QrCode className="h-4 w-4" />}
              Generate QR code
            </button>
          </div>
        ) : null}

        {mobileQrDataUrl ? (
          <div className="mt-4 flex flex-col items-center gap-2 border-t border-slate-100 pt-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={mobileQrDataUrl} alt="Mobile provisioning QR" className="h-[200px] w-[200px]" />
            <p className="text-xs text-slate-500">Scan with VSP Phone mobile app. Token expires in 15 minutes.</p>
          </div>
        ) : null}
      </section>
    </div>
  );
}
