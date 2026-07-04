import type { CallLogEntry } from '../api/types';
import { formatDateSeparator } from '../messaging/format';

export type RecentCallListItem =
  | { type: 'separator'; key: string; label: string }
  | { type: 'call'; key: string; call: CallLogEntry };

export function groupRecentCallsWithSeparators(calls: CallLogEntry[]): RecentCallListItem[] {
  const items: RecentCallListItem[] = [];
  let lastDay = '';

  for (const call of calls) {
    const day = new Date(call.createdAt).toDateString();
    if (day !== lastDay) {
      items.push({
        type: 'separator',
        key: `sep-${day}`,
        label: formatDateSeparator(call.createdAt),
      });
      lastDay = day;
    }
    items.push({ type: 'call', key: call.id, call });
  }

  return items;
}

export function filterRecentCalls(
  calls: CallLogEntry[],
  query: string,
  contactNamesByPeer: Map<string, string>,
): CallLogEntry[] {
  const q = query.trim().toLowerCase();
  if (!q) return calls;

  return calls.filter((call) => {
    const peer = call.direction === 'inbound' ? call.from : call.to;
    const peerKey = peer.replace(/\D/g, '');
    const contactName = contactNamesByPeer.get(peerKey) || '';
    const haystack = `${peer} ${contactName} ${call.status} ${call.callType || ''}`.toLowerCase();
    return haystack.includes(q);
  });
}

export function matchesRecentSegment(call: CallLogEntry, segment: string): boolean {
  if (segment === 'all') return true;
  if (segment === 'missed') return (call.status || '').toLowerCase().includes('miss');
  return true;
}

export function matchesRecentAdvancedFilter(call: CallLogEntry, filter: string): boolean {
  const status = (call.status || '').toLowerCase();
  const direction = (call.direction || '').toLowerCase();
  if (filter === 'all') return true;
  if (filter === 'incoming') return direction === 'inbound';
  if (filter === 'outgoing') return direction === 'outbound';
  if (filter === 'missed') return status.includes('miss');
  if (filter === 'voicemail') return status.includes('voicemail') || Boolean(call.callType?.includes('voicemail'));
  return true;
}
