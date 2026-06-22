'use client';

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import {
  getExtensionAnalytics,
  getExtensionVoicemails,
  type ExtensionAnalytics,
  type ExtensionRecord,
  type VoicemailRecord,
} from '@/lib/api';
import { formatPhoneNumber } from '@/lib/phone';

function formatDuration(seconds: number | null) {
  if (seconds == null || !Number.isFinite(seconds)) return '—';
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
}

type Props = {
  extensionId: string;
};

export function ExtensionAnalyticsPanel({ extensionId }: Props) {
  const [loading, setLoading] = useState(true);
  const [analytics, setAnalytics] = useState<ExtensionAnalytics | null>(null);
  const [voicemails, setVoicemails] = useState<VoicemailRecord[]>([]);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      getExtensionAnalytics(extensionId),
      getExtensionVoicemails(extensionId, 20),
    ])
      .then(([analyticsRes, vmRes]) => {
        setAnalytics(analyticsRes.analytics);
        setVoicemails(vmRes.voicemails);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [extensionId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-slate-400">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        Loading analytics…
      </div>
    );
  }

  if (!analytics) {
    return <p className="text-sm text-slate-500">Analytics unavailable.</p>;
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {[
          { label: 'Inbound calls', value: analytics.inboundCalls },
          { label: 'Outbound calls', value: analytics.outboundCalls },
          { label: 'Missed calls', value: analytics.missedCalls },
          { label: 'Voicemails', value: analytics.voicemails },
          { label: 'Avg duration', value: `${analytics.averageDurationSeconds}s` },
        ].map((card) => (
          <div key={card.label} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs uppercase tracking-wide text-slate-500">{card.label}</p>
            <p className="mt-1 text-xl font-semibold text-slate-900">{card.value}</p>
          </div>
        ))}
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-900">Recent voicemails</h3>
        <div className="mt-4 space-y-2">
          {voicemails.length === 0 ? (
            <p className="text-sm text-slate-400">No voicemails for assigned numbers.</p>
          ) : (
            voicemails.map((vm) => (
              <div key={vm.id} className="rounded-lg border border-slate-100 p-3 text-sm">
                <div className="flex justify-between">
                  <span className="font-medium">{formatPhoneNumber(vm.from)}</span>
                  <span className="text-slate-400">{new Date(vm.createdAt).toLocaleString()}</span>
                </div>
                <p className="text-xs text-slate-500">{formatDuration(vm.durationSeconds)}</p>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
