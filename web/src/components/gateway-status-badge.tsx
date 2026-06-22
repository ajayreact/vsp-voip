'use client';

import { cn } from '@/lib/utils';

export type GatewayStatus = 'active' | 'disabled' | 'test';

const STATUS_STYLES: Record<GatewayStatus, string> = {
  active: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  disabled: 'bg-slate-100 text-slate-600 ring-slate-200',
  test: 'bg-amber-50 text-amber-800 ring-amber-200',
};

const STATUS_LABELS: Record<GatewayStatus, string> = {
  active: 'ACTIVE',
  disabled: 'DISABLED',
  test: 'TEST MODE',
};

export function getGatewayStatus(
  enabled: boolean,
  mode?: 'test' | 'live' | null,
): GatewayStatus {
  if (!enabled) return 'disabled';
  if (mode === 'test') return 'test';
  return 'active';
}

export function GatewayStatusBadge({ status }: { status: GatewayStatus }) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ring-1',
        STATUS_STYLES[status],
      )}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}
