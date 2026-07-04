import type { DeviceRegistrationStatus, RingStrategy } from '@/lib/api';

export const RING_STRATEGIES: {
  value: RingStrategy;
  label: string;
  hint: string;
}[] = [
  { value: 'SIMULTANEOUS', label: 'Simultaneous', hint: 'Ring all members at once; first answer wins' },
  { value: 'SEQUENTIAL', label: 'Sequential', hint: 'Ring members one at a time in priority order' },
  { value: 'ROUND_ROBIN', label: 'Round robin', hint: 'Rotate starting member on each call' },
  { value: 'LONGEST_IDLE', label: 'Longest idle', hint: 'Offer to the member idle the longest first' },
];

export const STRATEGY_LABELS: Record<RingStrategy, string> = {
  SIMULTANEOUS: 'Simultaneous',
  SEQUENTIAL: 'Sequential',
  ROUND_ROBIN: 'Round robin',
  LONGEST_IDLE: 'Longest idle',
};

export function regStatusLabel(reg?: DeviceRegistrationStatus) {
  const status = reg?.status || 'UNREGISTERED';
  if (status === 'ONLINE') return 'Registered';
  if (status === 'OFFLINE') return 'Offline';
  if (status === 'EXPIRED') return 'Expired';
  return 'Unregistered';
}

export function regStatusBadge(reg?: DeviceRegistrationStatus) {
  const status = reg?.status || 'UNREGISTERED';
  const styles: Record<string, string> = {
    ONLINE: 'bg-emerald-50 text-emerald-700',
    OFFLINE: 'bg-slate-100 text-slate-600',
    EXPIRED: 'bg-amber-50 text-amber-700',
    UNREGISTERED: 'bg-slate-50 text-slate-400',
  };
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${styles[status]}`}>
      {regStatusLabel(reg)}
    </span>
  );
}

export function strategySupportsMemberOrder(strategy: RingStrategy) {
  return strategy === 'SEQUENTIAL' || strategy === 'ROUND_ROBIN';
}
