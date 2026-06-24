'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Activity,
  Database,
  HeartPulse,
  Loader2,
  Mic,
  PhoneCall,
  Radio,
  ShieldCheck,
  Signal,
  Voicemail,
} from 'lucide-react';
import { AdminPageHeader } from '@/components/admin-page-header';
import { AdminSectionNav, adminMonitoringTabs } from '@/components/admin-section-nav';
import { KpiCard, KpiSection } from '@/components/kpi-card';
import {
  getAdminTelephonyHealth,
  getMe,
  isUnauthorizedError,
  type TelephonyHealthReport,
} from '@/lib/api';

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString();
}

function EventProperties({ properties }: { properties: Record<string, unknown> }) {
  const entries = Object.entries(properties || {}).filter(([key]) => key !== 'source');
  if (!entries.length) return <span className="text-slate-400">—</span>;
  return (
    <div className="space-y-1">
      {entries.slice(0, 4).map(([key, value]) => (
        <p key={key} className="truncate">
          <span className="text-slate-400">{key}:</span>{' '}
          <span>{typeof value === 'object' ? JSON.stringify(value) : String(value)}</span>
        </p>
      ))}
    </div>
  );
}

export default function AdminTelephonyHealthPage() {
  const router = useRouter();
  const [report, setReport] = useState<TelephonyHealthReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    getMe()
      .then((user) => {
        if (user.role !== 'SUPER_ADMIN') {
          router.replace('/dashboard');
          return null;
        }
        return getAdminTelephonyHealth();
      })
      .then((res) => {
        if (res) setReport(res);
      })
      .catch((err) => {
        if (isUnauthorizedError(err)) router.replace('/login');
        else setError(err instanceof Error ? err.message : 'Could not load telephony health');
      })
      .finally(() => setLoading(false));
  }, [router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-slate-400">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        Loading telephony health…
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className="mx-auto max-w-lg rounded-xl border border-red-200 bg-red-50 p-6 text-center">
        <p className="font-medium text-red-700">Telephony health unavailable</p>
        <p className="mt-2 text-sm text-slate-600">{error || 'No data'}</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <AdminPageHeader
        section="Monitoring"
        title="Telephony Health"
        subtitle="Read-only operations dashboard for Softphone V2, Call Control, registrations, presence, voicemail, recordings, and telemetry."
      />
      <AdminSectionNav tabs={adminMonitoringTabs} />

      <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-500 shadow-sm">
        Generated {formatDate(report.generatedAt)} · Calls window: {report.windows.calls} · Presence online window: {report.windows.presenceOnlineMinutes} minutes · Feed limit: {report.windows.telemetryFeedLimit}
      </div>

      <KpiSection title="Registrations">
        <KpiCard
          title="Active Registrations"
          value={report.registrations.activeRegistrations}
          subtitle="Softphone online or SIP registered"
          icon={Signal}
          tone="emerald"
        />
        <KpiCard
          title="Failed Registrations"
          value={report.registrations.failedRegistrations}
          subtitle="Users with failed SIP registration response"
          icon={Signal}
          tone={report.registrations.failedRegistrations > 0 ? 'amber' : 'slate'}
        />
        <KpiCard
          title="Reconnect Count"
          value={report.registrations.reconnectCount}
          subtitle="Reconnect Attempt events in current feed"
          icon={Radio}
          tone={report.registrations.reconnectCount > 0 ? 'amber' : 'indigo'}
        />
      </KpiSection>

      <KpiSection title="Calls" description={`Derived from CallLog records over the last ${report.windows.calls}.`}>
        <KpiCard title="Calls Started" value={report.calls.callsStarted} icon={PhoneCall} tone="sky" />
        <KpiCard title="Calls Connected" value={report.calls.callsConnected} icon={PhoneCall} tone="emerald" />
        <KpiCard title="Calls Failed" value={report.calls.callsFailed} icon={PhoneCall} tone={report.calls.callsFailed > 0 ? 'rose' : 'slate'} />
        <KpiCard title="Calls Ended" value={report.calls.callsEnded} icon={PhoneCall} tone="indigo" />
      </KpiSection>

      <div className="grid gap-8 xl:grid-cols-3">
        <KpiSection title="Presence">
          <KpiCard title="Online Users" value={report.presence.onlineUsers} icon={HeartPulse} tone="emerald" />
          <KpiCard title="Offline Users" value={report.presence.offlineUsers} icon={HeartPulse} tone="slate" />
        </KpiSection>

        <KpiSection title="Voicemail">
          <KpiCard title="Unread Voicemails" value={report.voicemail.unreadVoicemails} icon={Voicemail} tone={report.voicemail.unreadVoicemails > 0 ? 'amber' : 'slate'} />
          <KpiCard title="Total Voicemails" value={report.voicemail.totalVoicemails} icon={Voicemail} tone="indigo" />
        </KpiSection>

        <KpiSection title="Recordings">
          <KpiCard title="Total Recordings" value={report.recordings.totalRecordings} icon={Mic} tone="violet" />
        </KpiSection>
      </div>

      <KpiSection title="Call Control Health" description={`Session source: ${report.callControl.source}`}>
        <KpiCard title="Active Sessions" value={report.callControl.activeSessions} icon={Activity} tone="sky" />
        <KpiCard title="Winner Claims" value={report.callControl.winnerClaims} icon={ShieldCheck} tone="emerald" />
        <KpiCard
          title="Race Condition Prevented Count"
          value={report.callControl.raceConditionPreventedCount}
          subtitle="Guarded bridged sessions from stale no-answer fallback"
          icon={ShieldCheck}
          tone={report.callControl.raceConditionPreventedCount > 0 ? 'amber' : 'slate'}
        />
      </KpiSection>

      <section className="panel-card overflow-hidden">
        <div className="border-b border-slate-200 px-5 py-4">
          <h3 className="font-medium text-slate-900">Telemetry Feed</h3>
          <p className="mt-1 text-sm text-slate-500">Last 100 observed events in the current API process.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-5 py-3">Time</th>
                <th className="px-5 py-3">Event</th>
                <th className="px-5 py-3">Tenant</th>
                <th className="px-5 py-3">User</th>
                <th className="px-5 py-3">Properties</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {report.telemetryFeed.length ? (
                report.telemetryFeed.map((event) => (
                  <tr key={event.id} className="align-top">
                    <td className="whitespace-nowrap px-5 py-3 text-slate-500">{formatDate(event.createdAt)}</td>
                    <td className="whitespace-nowrap px-5 py-3 font-medium text-slate-900">{event.event}</td>
                    <td className="px-5 py-3 font-mono text-xs text-slate-500">{event.tenantId || '—'}</td>
                    <td className="px-5 py-3 font-mono text-xs text-slate-500">{event.userId || '—'}</td>
                    <td className="max-w-md px-5 py-3 text-xs text-slate-600">
                      <EventProperties properties={event.properties} />
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="px-5 py-10 text-center text-slate-500">
                    No telemetry events observed yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="panel-card p-5">
          <div className="mb-3 flex items-center gap-2">
            <Database className="h-4 w-4 text-indigo-600" />
            <h3 className="font-medium text-slate-900">Database Queries Used</h3>
          </div>
          <ul className="space-y-2 text-xs text-slate-600">
            {report.queries.map((query) => (
              <li key={query} className="rounded-lg bg-slate-50 px-3 py-2">{query}</li>
            ))}
          </ul>
        </section>

        <section className="panel-card p-5">
          <div className="mb-3 flex items-center gap-2">
            <Activity className="h-4 w-4 text-indigo-600" />
            <h3 className="font-medium text-slate-900">API Endpoints Used</h3>
          </div>
          <ul className="space-y-2 font-mono text-xs text-slate-600">
            {report.endpoints.map((endpoint) => (
              <li key={endpoint} className="rounded-lg bg-slate-50 px-3 py-2">{endpoint}</li>
            ))}
          </ul>
        </section>

        <section className="panel-card p-5">
          <div className="mb-3 flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-indigo-600" />
            <h3 className="font-medium text-slate-900">Deployment Notes</h3>
          </div>
          <ul className="space-y-2 text-xs text-slate-600">
            <li className="rounded-lg bg-slate-50 px-3 py-2">Requires SUPER_ADMIN access through existing `/api/admin/*` auth middleware.</li>
            <li className="rounded-lg bg-slate-50 px-3 py-2">Set `REDIS_URL` before horizontally scaling API instances.</li>
            <li className="rounded-lg bg-slate-50 px-3 py-2">Telemetry feed and race-prevented count are process-local unless backed by shared storage later.</li>
            <li className="rounded-lg bg-slate-50 px-3 py-2">No Softphone V2 call behavior is changed by this dashboard.</li>
          </ul>
        </section>
      </div>
    </div>
  );
}
