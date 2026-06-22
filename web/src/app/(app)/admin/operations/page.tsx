'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Gauge, Loader2, PhoneCall, Radio, Signal } from 'lucide-react';
import { KpiCard, KpiSection } from '@/components/kpi-card';
import { AdminPageHeader } from '@/components/admin-page-header';
import {
  getAdminOperationsDashboard,
  getMe,
  isUnauthorizedError,
  type AdminDashboardStats,
  type TelnyxStatus,
  type VoiceQualityReport,
} from '@/lib/api';

export default function LiveOperationsPage() {
  const router = useRouter();
  const [stats, setStats] = useState<AdminDashboardStats | null>(null);
  const [telnyxStatus, setTelnyxStatus] = useState<TelnyxStatus | null>(null);
  const [voiceQuality, setVoiceQuality] = useState<VoiceQualityReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    getMe()
      .then((user) => {
        if (user.role !== 'SUPER_ADMIN') {
          router.replace('/dashboard');
          return;
        }
        return getAdminOperationsDashboard();
      })
      .then((res) => {
        if (!res) return;
        setStats(res.stats);
        setTelnyxStatus(res.telnyxStatus);
        setVoiceQuality(res.voiceQuality);
      })
      .catch((err) => {
        if (isUnauthorizedError(err)) router.replace('/login');
        else setError(err instanceof Error ? err.message : 'Could not load operations');
      })
      .finally(() => setLoading(false));
  }, [router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-slate-500">
        <Loader2 className="mr-2 h-5 w-5 animate-spin text-indigo-600" />
        Loading live operations…
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="mx-auto max-w-lg rounded-xl border border-red-200 bg-red-50 p-6 text-center">
        <p className="font-medium text-red-700">Operations dashboard unavailable</p>
        <p className="mt-2 text-sm text-slate-600">{error}</p>
      </div>
    );
  }

  const kpis = stats.kpis;
  const mos = kpis?.averageMos;
  const mosWarn = mos != null && mos < 4;
  const telnyxConnected = Boolean(telnyxStatus?.connected);

  return (
    <div className="space-y-8">
      <AdminPageHeader
        section="Dashboard"
        title="Live operations"
        subtitle="Voice engineering, carrier status, and real-time session estimates."
      />

      <KpiSection title="Session capacity" description="Poll-based estimates — active call control arrives in Phase 2.">
        <KpiCard
          title="Active concurrent calls"
          value={`${kpis?.activeConcurrentCalls ?? 0} / ${kpis?.maxConcurrentCapacity ?? 1500}`}
          subtitle="CallLog sessions in last 5 minutes"
          icon={PhoneCall}
          tone="sky"
          badge="Estimate"
        />
        <KpiCard
          title="Calls (24h)"
          value={kpis?.callsLast24h ?? 0}
          subtitle={voiceQuality ? `${voiceQuality.summary.failedRate}% failure rate` : 'Last 24 hours'}
          icon={Radio}
          tone="indigo"
          href="/admin/monitoring/quality"
        />
        <KpiCard
          title="Telnyx carrier"
          value={telnyxConnected ? 'Online' : 'Offline'}
          subtitle={telnyxStatus?.message || 'Voice trunk status'}
          icon={Signal}
          tone={telnyxConnected ? 'emerald' : 'amber'}
          href="/admin/settings/carrier"
        />
      </KpiSection>

      <KpiSection title="Voice quality & registrations">
        <KpiCard
          title="Global average MOS"
          value={mos != null ? mos.toFixed(1) : '—'}
          subtitle={
            kpis?.averageMosSamples
              ? `${kpis.averageMosSamples} Telnyx samples (24h)`
              : 'Complete calls to collect MOS telemetry'
          }
          trend={
            mos != null
              ? { label: mosWarn ? 'Below 4.0 — review routing' : 'Voice quality healthy', positive: !mosWarn }
              : undefined
          }
          icon={Gauge}
          tone={mosWarn ? 'amber' : 'emerald'}
          href="/admin/monitoring/quality"
        />
        <KpiCard
          title="SIP / WebRTC registration"
          value={kpis?.sipRegistrationRate != null ? `${kpis.sipRegistrationRate}%` : '—'}
          subtitle={`${kpis?.sipRegisteredExtensions ?? 0} registered endpoints`}
          icon={Signal}
          tone="indigo"
          href="/admin/monitoring/registrations"
        />
        <KpiCard
          title="Pending LNP"
          value={kpis?.pendingLnpRequests ?? 0}
          subtitle="Number porting in progress"
          icon={Radio}
          tone="amber"
          href="/admin/numbers/porting"
        />
      </KpiSection>

      <div className="flex flex-wrap gap-3">
        <Link href="/admin/monitoring/quality" className="btn-primary px-4 py-2 text-sm">
          Call quality report
        </Link>
        <Link href="/admin/monitoring/registrations" className="btn-secondary px-4 py-2 text-sm">
          Registration status
        </Link>
        <Link href="/admin/settings/carrier" className="btn-secondary px-4 py-2 text-sm">
          Carrier settings
        </Link>
      </div>

      <div className="rounded-xl border border-indigo-100 bg-indigo-50 p-4 text-sm text-indigo-900">
        <strong>Phase 2:</strong> Real-time active calls dashboard, WebSocket live updates, and admin hangup
        actions are planned — not included in Phase 1.
      </div>
    </div>
  );
}
