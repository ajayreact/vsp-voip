'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Signal } from 'lucide-react';
import { KpiCard, KpiSection } from '@/components/kpi-card';
import { AdminPageHeader } from '@/components/admin-page-header';
import { AdminSectionNav, adminMonitoringTabs } from '@/components/admin-section-nav';
import {
  getAdminOperationsDashboard,
  getMe,
  getTelnyxStatus,
  isUnauthorizedError,
  type TelnyxStatus,
} from '@/lib/api';

export default function AdminMonitoringRegistrationsPage() {
  const router = useRouter();
  const [telnyxStatus, setTelnyxStatus] = useState<TelnyxStatus | null>(null);
  const [sipRate, setSipRate] = useState<number | null>(null);
  const [registered, setRegistered] = useState(0);
  const [totalExtensions, setTotalExtensions] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getMe()
      .then((user) => {
        if (user.role !== 'SUPER_ADMIN') {
          router.replace('/dashboard');
          return;
        }
        return Promise.all([getAdminOperationsDashboard(), getTelnyxStatus()]);
      })
      .then((res) => {
        if (!res) return;
        const [ops, telnyx] = res;
        setTelnyxStatus(telnyx.status);
        setSipRate(ops.stats.kpis?.sipRegistrationRate ?? null);
        setRegistered(ops.stats.kpis?.sipRegisteredExtensions ?? 0);
        setTotalExtensions(ops.stats.kpis?.totalExtensions ?? 0);
      })
      .catch((err) => {
        if (isUnauthorizedError(err)) router.replace('/login');
      })
      .finally(() => setLoading(false));
  }, [router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-slate-400">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        Loading registrations…
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <AdminPageHeader
        section="Monitoring"
        title="SIP & WebRTC registrations"
        subtitle="Telnyx credential connection and softphone presence status."
      />
      <AdminSectionNav tabs={adminMonitoringTabs} />

      <KpiSection title="Registration health">
        <KpiCard
          title="Registration rate"
          value={sipRate != null ? `${sipRate}%` : '—'}
          subtitle={`${registered} of ${totalExtensions} extensions`}
          icon={Signal}
          tone="indigo"
        />
        <KpiCard
          title="Telnyx API"
          value={telnyxStatus?.connected ? 'Connected' : 'Offline'}
          subtitle={telnyxStatus?.message || 'Carrier API status'}
          icon={Signal}
          tone={telnyxStatus?.connected ? 'emerald' : 'amber'}
        />
        <KpiCard
          title="Credential connection"
          value={telnyxStatus?.connectionId ? 'Configured' : 'Not set'}
          subtitle={telnyxStatus?.connectionName || 'WebRTC / SIP trunk'}
          icon={Signal}
          tone="violet"
        />
      </KpiSection>

      <div className="panel-card p-5 text-sm text-slate-600">
        <p className="font-medium text-slate-900">Webhook endpoints</p>
        <ul className="mt-3 space-y-2 font-mono text-xs text-slate-500">
          <li>Voice: {telnyxStatus?.voiceWebhookUrl || '—'}</li>
          <li>SMS: {telnyxStatus?.smsWebhookUrl || '—'}</li>
          <li>Call control: {(telnyxStatus as { callControlWebhookUrl?: string })?.callControlWebhookUrl || telnyxStatus?.webhookUrl || '—'}</li>
        </ul>
      </div>
    </div>
  );
}
