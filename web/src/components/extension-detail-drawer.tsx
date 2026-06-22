'use client';

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { ExtensionBusinessPanel } from '@/components/extension-business-panel';
import { ExtensionOwnershipPanel } from '@/components/extension-ownership-panel';
import { ExtensionSecurityPanel } from '@/components/extension-security-panel';
import { ExtensionSipPanel } from '@/components/extension-sip-panel';
import { ExtensionQrPanel } from '@/components/extension-qr-panel';
import { ExtensionAnalyticsPanel } from '@/components/extension-analytics-panel';
import { ExtensionDetailDrawerShell } from '@/components/extension-detail-drawer-shell';
import { getExtension, type ExtensionRecord } from '@/lib/api';
import { formatPhoneNumber } from '@/lib/phone';

export type ExtensionDrawerTab =
  | 'overview'
  | 'employee'
  | 'sip'
  | 'qr'
  | 'security'
  | 'analytics';

type Props = {
  extensionId: string | null;
  open: boolean;
  initialTab?: ExtensionDrawerTab;
  isAdmin: boolean;
  onClose: () => void;
  onUpdated?: () => void;
};

export function ExtensionDetailDrawer({
  extensionId,
  open,
  initialTab = 'overview',
  isAdmin,
  onClose,
  onUpdated,
}: Props) {
  const [tab, setTab] = useState<ExtensionDrawerTab>(initialTab);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [extension, setExtension] = useState<ExtensionRecord | null>(null);

  useEffect(() => {
    if (open) setTab(initialTab);
  }, [open, initialTab, extensionId]);

  useEffect(() => {
    if (!open || !extensionId) {
      setExtension(null);
      return;
    }
    setLoading(true);
    setError('');
    getExtension(extensionId)
      .then((res) => setExtension(res.extension))
      .catch((err) => setError(err instanceof Error ? err.message : 'Could not load extension'))
      .finally(() => setLoading(false));
  }, [open, extensionId]);

  function handleExtensionUpdated(ext: ExtensionRecord) {
    setExtension(ext);
    onUpdated?.();
  }

  const title = extension
    ? `${extension.extensionNumber} — ${extension.displayName}`
    : 'Extension';

  return (
    <ExtensionDetailDrawerShell
      open={open}
      onClose={onClose}
      title={title}
      subtitle={extension?.status}
      activeTab={tab}
      onTabChange={setTab}
    >
      {loading ? (
        <div className="flex items-center justify-center py-24 text-slate-400">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          Loading extension…
        </div>
      ) : error && !extension ? (
        <p className="text-sm text-red-600">{error}</p>
      ) : extension ? (
        <div className="space-y-4">
          {error ? <p className="text-sm text-red-600">{error}</p> : null}

          {tab === 'overview' ? (
            <>
              <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <h3 className="text-sm font-semibold text-slate-900">Details</h3>
                <dl className="mt-4 space-y-2 text-sm">
                  <div className="flex justify-between gap-4">
                    <dt className="text-slate-500">Assigned Phone Number</dt>
                    <dd>
                      {extension.ownership?.primaryDid
                        ? formatPhoneNumber(extension.ownership.primaryDid.number)
                        : '—'}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-slate-500">Email</dt>
                    <dd>{extension.email || extension.user?.email || '—'}</dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-slate-500">Assigned user</dt>
                    <dd>{extension.user?.name || '—'}</dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-slate-500">Department</dt>
                    <dd>{extension.department || '—'}</dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-slate-500">Phone number routing</dt>
                    <dd className="text-right text-indigo-700">
                      {extension.ownership?.primaryDid
                        ? `Managed by Extension ${extension.extensionNumber}`
                        : '—'}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-slate-500">Inbound calls go to</dt>
                    <dd className="text-right text-indigo-700">{extension.inboundRecipient?.label || '—'}</dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-slate-500">Voicemail</dt>
                    <dd>{extension.features.voicemailEnabled ? 'Enabled' : 'Disabled'}</dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-slate-500">Call recording</dt>
                    <dd>{extension.features.callRecordingEnabled ? 'Enabled' : 'Disabled'}</dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-slate-500">Last activity</dt>
                    <dd>
                      {extension.lastActivityAt
                        ? new Date(extension.lastActivityAt).toLocaleString()
                        : '—'}
                    </dd>
                  </div>
                </dl>
                {isAdmin ? (
                  <p className="mt-4 text-xs text-slate-400">
                    Use Edit on the extensions table to change name, employee, or assigned phone number.
                  </p>
                ) : null}
              </section>

              <ExtensionBusinessPanel
                extension={extension}
                isAdmin={isAdmin}
                onUpdated={handleExtensionUpdated}
              />
            </>
          ) : null}

          {tab === 'employee' ? (
            <ExtensionOwnershipPanel
              extension={extension}
              isAdmin={isAdmin}
              onUpdated={handleExtensionUpdated}
            />
          ) : null}

          {tab === 'sip' ? (
            <ExtensionSipPanel
              extension={extension}
              isAdmin={isAdmin}
              onUpdated={handleExtensionUpdated}
            />
          ) : null}

          {tab === 'qr' ? <ExtensionQrPanel extension={extension} isAdmin={isAdmin} /> : null}

          {tab === 'security' ? (
            <ExtensionSecurityPanel
              extension={extension}
              isAdmin={isAdmin}
              onUpdated={handleExtensionUpdated}
            />
          ) : null}

          {tab === 'analytics' ? <ExtensionAnalyticsPanel extensionId={extension.id} /> : null}
        </div>
      ) : null}
    </ExtensionDetailDrawerShell>
  );
}
