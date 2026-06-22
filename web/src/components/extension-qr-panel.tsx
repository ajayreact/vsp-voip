'use client';

import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Loader2, Phone, QrCode, RefreshCw, Smartphone } from 'lucide-react';
import {
  createExtensionProvisioningToken,
  type ExtensionProvisioningToken,
  type ExtensionRecord,
} from '@/lib/api';

type Props = {
  extension: ExtensionRecord;
  isAdmin: boolean;
};

type QrTarget = 'mobile' | 'sip_phone';

function QrBlock({
  title,
  description,
  icon: Icon,
  target,
  qrDataUrl,
  provisioning,
  expiry,
  loading,
  secondsLeft,
  onGenerate,
}: {
  title: string;
  description: string;
  icon: typeof Smartphone;
  target: QrTarget;
  qrDataUrl: string;
  provisioning: ExtensionProvisioningToken | null;
  expiry?: string;
  loading: QrTarget | null;
  secondsLeft: number;
  onGenerate: (target: QrTarget) => void;
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="rounded-lg bg-indigo-50 p-2 text-indigo-600">
          <Icon className="h-5 w-5" />
        </div>
        <div className="flex-1">
          <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
          <p className="mt-1 text-xs text-slate-500">{description}</p>
        </div>
      </div>

      <div className="mt-4 flex flex-col items-center gap-4 sm:flex-row sm:items-start">
        <div className="flex h-[220px] w-[220px] items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50">
          {loading === target ? (
            <Loader2 className="h-8 w-8 animate-spin text-indigo-400" />
          ) : qrDataUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={qrDataUrl} alt={`${title} QR code`} className="h-[200px] w-[200px]" />
          ) : (
            <QrCode className="h-14 w-14 text-slate-300" />
          )}
        </div>

        <div className="flex-1 space-y-3 text-sm">
          {expiry ? (
            <p>
              <span className="text-slate-500">Expires:</span>{' '}
              <span className={secondsLeft <= 60 ? 'font-medium text-amber-700' : 'text-slate-900'}>
                {secondsLeft > 0
                  ? `${Math.floor(secondsLeft / 60)}m ${secondsLeft % 60}s remaining`
                  : 'Expired — regenerate'}
              </span>
            </p>
          ) : provisioning ? (
            <p className="text-slate-600">Contains SIP username, password, server, and port for desk phones.</p>
          ) : null}

          {provisioning?.token ? (
            <p className="text-xs text-slate-400 break-all">Token: {provisioning.token.slice(0, 12)}…</p>
          ) : null}

          <button
            type="button"
            disabled={Boolean(loading)}
            onClick={() => onGenerate(target)}
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
          >
            {loading === target ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            {provisioning ? 'Regenerate' : 'Generate'} QR
          </button>
        </div>
      </div>
    </section>
  );
}

export function ExtensionQrPanel({ extension, isAdmin }: Props) {
  const [loading, setLoading] = useState<QrTarget | null>(null);
  const [error, setError] = useState('');
  const [mobile, setMobile] = useState<ExtensionProvisioningToken | null>(null);
  const [sipPhone, setSipPhone] = useState<ExtensionProvisioningToken | null>(null);
  const [mobileQr, setMobileQr] = useState('');
  const [sipQr, setSipQr] = useState('');
  const [secondsLeft, setSecondsLeft] = useState(0);

  async function generate(target: QrTarget) {
    setLoading(target);
    setError('');
    try {
      const res = await createExtensionProvisioningToken(extension.id, target);
      const dataUrl = await QRCode.toDataURL(res.provisioning.qrPayloadJson, {
        width: 220,
        margin: 2,
        color: { dark: '#1e293b', light: '#ffffff' },
      });
      if (target === 'mobile') {
        setMobile(res.provisioning);
        setMobileQr(dataUrl);
        setSecondsLeft(res.provisioning.expiresInSeconds || 0);
      } else {
        setSipPhone(res.provisioning);
        setSipQr(dataUrl);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not generate QR code');
    } finally {
      setLoading(null);
    }
  }

  useEffect(() => {
    if (!mobile?.expiresAt) return;
    const tick = setInterval(() => {
      const remaining = Math.max(
        0,
        Math.floor((new Date(mobile.expiresAt!).getTime() - Date.now()) / 1000),
      );
      setSecondsLeft(remaining);
    }, 1000);
    return () => clearInterval(tick);
  }, [mobile]);

  if (!isAdmin) {
    return <p className="text-sm text-slate-500">Only administrators can generate provisioning QR codes.</p>;
  }

  return (
    <div className="space-y-4">
      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      {!extension.userId ? (
        <p className="text-sm text-amber-700">
          Assign an employee to generate the mobile app QR. SIP desk phone QR works without an employee.
        </p>
      ) : null}

      {extension.userId ? (
        <QrBlock
          title="Mobile app QR"
          description="Scan with the VSP-VOIP mobile app. Signs in, downloads extension config, and registers WebRTC. Token expires in 15 minutes."
          icon={Smartphone}
          target="mobile"
          qrDataUrl={mobileQr}
          provisioning={mobile}
          expiry={mobile?.expiresAt || undefined}
          loading={loading}
          secondsLeft={secondsLeft}
          onGenerate={generate}
        />
      ) : null}

      <QrBlock
        title="SIP desk phone QR"
        description="Scan or import on supported SIP phones for auto-provisioning with username, password, server (sip.telnyx.com), and port."
        icon={Phone}
        target="sip_phone"
        qrDataUrl={sipQr}
        provisioning={sipPhone}
        loading={loading}
        secondsLeft={secondsLeft}
        onGenerate={generate}
      />
    </div>
  );
}
