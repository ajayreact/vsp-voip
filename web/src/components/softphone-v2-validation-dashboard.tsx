'use client';

import type { SoftphonePresenceStatus } from '@/lib/softphone-presence';
import type { SoftphoneTelemetrySnapshot } from '@/lib/softphone-telemetry';

type SoftphoneV2ValidationDashboardProps = {
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
};

function statusTone(ok: boolean, warn = false) {
  if (ok) return 'text-[#34C759]';
  if (warn) return 'text-amber-600 dark:text-amber-400';
  return 'text-[#FF3B30]';
}

function formatTimestamp(iso: string | null) {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
  });
}

function presenceLabel(status: SoftphonePresenceStatus) {
  switch (status) {
    case 'online':
      return 'Active';
    case 'offline':
      return 'Offline';
    case 'error':
      return 'Error';
    default:
      return 'Pending';
  }
}

function ValidationRow({
  label,
  value,
  ok,
  warn,
}: {
  label: string;
  value: string;
  ok: boolean;
  warn?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="text-[#1D1D1F]/60 dark:text-white/60">{label}</span>
      <span className={`font-medium ${statusTone(ok, warn)}`}>{value}</span>
    </div>
  );
}

export function SoftphoneV2ValidationDashboard({
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
}: SoftphoneV2ValidationDashboardProps) {
  const registrationValue = reconnecting
    ? 'Reconnecting…'
    : telnyxRegistered
      ? 'Registered'
      : 'Not registered';

  const lastTelemetryLabel = lastTelemetryEvent
    ? `${lastTelemetryEvent.event} · ${formatTimestamp(lastTelemetryEvent.at)}`
    : '—';

  return (
    <section
      aria-label="Softphone diagnostics dashboard"
      className="rounded-2xl border border-white/50 bg-white/75 p-4 shadow-md backdrop-blur-md dark:border-white/10 dark:bg-white/[0.06]"
    >
      <h2 className="text-sm font-semibold text-[#1D1D1F] dark:text-white">
        Diagnostics
      </h2>
      <p className="mt-1 text-xs text-[#1D1D1F]/45 dark:text-white/45">
        Read-only session status
      </p>
      <div className="mt-3 space-y-2">
        <ValidationRow
          label="Registration Status"
          value={registrationValue}
          ok={telnyxRegistered}
          warn={reconnecting}
        />
        <ValidationRow
          label="Telnyx Ready"
          value={telnyxRegistered ? 'Yes' : 'No'}
          ok={telnyxRegistered}
          warn={reconnecting}
        />
        <ValidationRow
          label="WebSocket Connected"
          value={telnyxSocketConnected ? 'Connected' : 'Disconnected'}
          ok={telnyxSocketConnected}
          warn={reconnecting}
        />
        <ValidationRow
          label="Presence Active"
          value={presenceLabel(presenceStatus)}
          ok={presenceStatus === 'online'}
          warn={presenceStatus === 'pending'}
        />
        <ValidationRow
          label="Current Caller ID"
          value={callerId || '—'}
          ok={Boolean(callerId)}
        />
        <ValidationRow
          label="Active Call Count"
          value={String(activeCallCount)}
          ok={activeCallCount === 0}
          warn={activeCallCount > 0}
        />
        <ValidationRow
          label="Failed Call Count"
          value={String(failedCallCount)}
          ok={failedCallCount === 0}
        />
        <ValidationRow
          label="Missed Call Count"
          value={String(missedCallCount)}
          ok={missedCallCount === 0}
        />
        <ValidationRow
          label="Reconnect Count"
          value={String(reconnectCount)}
          ok={reconnectCount === 0}
          warn={reconnectCount > 0}
        />
        <ValidationRow
          label="Last Telemetry Event"
          value={lastTelemetryLabel}
          ok={Boolean(lastTelemetryEvent)}
        />
      </div>
    </section>
  );
}
