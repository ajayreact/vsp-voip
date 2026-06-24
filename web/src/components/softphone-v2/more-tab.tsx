'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Activity,
  ChevronRight,
  Mic,
  Settings,
  ShieldCheck,
} from 'lucide-react';
import { getCallRecordings, isUnauthorizedError, type CallRecordingRecord } from '@/lib/api';
import { RecordingsList } from '@/components/recordings-list';
import { SoftphoneV2ValidationDashboard } from '@/components/softphone-v2-validation-dashboard';
import type { SoftphonePresenceStatus } from '@/lib/softphone-presence';
import type { SoftphoneTelemetrySnapshot } from '@/lib/softphone-telemetry';

type MoreTabProps = {
  telnyxSocketConnected: boolean;
  telnyxRegistered: boolean;
  reconnecting: boolean;
  presenceStatus: SoftphonePresenceStatus;
  callerId: string;
  activeCallCount: number;
  failedCallCount: number;
  missedCallCount: number;
  reconnectCount: number;
  lastTelemetryEvent: SoftphoneTelemetrySnapshot | null;
  displayStatus: string;
};

export function MoreTab({
  telnyxSocketConnected,
  telnyxRegistered,
  reconnecting,
  presenceStatus,
  callerId,
  activeCallCount,
  failedCallCount,
  missedCallCount,
  reconnectCount,
  lastTelemetryEvent,
  displayStatus,
}: MoreTabProps) {
  const [recordings, setRecordings] = useState<CallRecordingRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showDiagnostics, setShowDiagnostics] = useState(false);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const res = await getCallRecordings(100);
        setRecordings(res.recordings);
      } catch (err) {
        if (!isUnauthorizedError(err)) {
          setError(err instanceof Error ? err.message : 'Could not load recordings');
        }
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, []);

  const rows = [
    { href: '/settings', label: 'Settings', icon: Settings },
    { href: '/recordings', label: 'Recordings', icon: Mic },
  ];

  return (
    <div className="flex h-full flex-col overflow-y-auto px-4 pb-6 pt-2">
      <header className="pb-4">
        <h1 className="text-[34px] font-bold tracking-tight text-[#1D1D1F]">More</h1>
      </header>

      <div className="overflow-hidden rounded-3xl bg-white shadow-[0_2px_16px_rgba(0,0,0,0.06)]">
        {rows.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className="flex items-center gap-3 border-b border-[#E5E5EA]/80 px-4 py-3.5 last:border-b-0"
          >
            <Icon className="h-5 w-5 text-[#007AFF]" />
            <span className="flex-1 text-base text-[#1D1D1F]">{label}</span>
            <ChevronRight className="h-5 w-5 text-[#C7C7CC]" />
          </Link>
        ))}
        <button
          type="button"
          onClick={() => setShowDiagnostics((prev) => !prev)}
          className="flex w-full items-center gap-3 px-4 py-3.5 text-left"
        >
          <ShieldCheck className="h-5 w-5 text-[#007AFF]" />
          <span className="flex-1 text-base text-[#1D1D1F]">Diagnostics</span>
          <ChevronRight className={`h-5 w-5 text-[#C7C7CC] transition-transform ${showDiagnostics ? 'rotate-90' : ''}`} />
        </button>
      </div>

      {showDiagnostics ? (
        <div className="mt-4">
          <SoftphoneV2ValidationDashboard
            telnyxSocketConnected={telnyxSocketConnected}
            telnyxRegistered={telnyxRegistered}
            reconnecting={reconnecting}
            presenceStatus={presenceStatus}
            callerId={callerId}
            activeCallCount={activeCallCount}
            failedCallCount={failedCallCount}
            missedCallCount={missedCallCount}
            reconnectCount={reconnectCount}
            lastTelemetryEvent={lastTelemetryEvent}
          />
        </div>
      ) : null}

      <section className="mt-6">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[#8E8E93]">
          Call Recordings
        </h2>
        {loading ? (
          <p className="py-8 text-center text-sm text-[#8E8E93]">Loading recordings…</p>
        ) : error ? (
          <p className="text-sm text-[#FF3B30]">{error}</p>
        ) : (
          <RecordingsList recordings={recordings} onError={setError} />
        )}
      </section>

      <section className="mt-6 rounded-3xl bg-white p-4 shadow-[0_2px_16px_rgba(0,0,0,0.06)]">
        <div className="flex items-center gap-2 text-sm font-semibold text-[#1D1D1F]">
          <Activity className="h-4 w-4 text-[#007AFF]" />
          Telemetry Status
        </div>
        <p className="mt-2 text-sm text-[#8E8E93]">{displayStatus}</p>
        <p className="mt-1 text-xs text-[#8E8E93]">
          Events post to <code className="text-[#636366]">/api/softphone/telemetry</code>
        </p>
        <p className="mt-4 text-xs text-[#C7C7CC]">Softphone V2 · VSP-VOIP</p>
      </section>
    </div>
  );
}
