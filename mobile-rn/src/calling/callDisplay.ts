export type CallPhase =
  | 'idle'
  | 'calling'
  | 'connecting'
  | 'ringing'
  | 'connected'
  | 'held'
  | 'reconnecting'
  | 'ended'
  | 'failed';

export type AudioRouteKind = 'phone' | 'speaker' | 'bluetooth' | 'wired';

const AUDIO_ROUTE_LABELS: Record<AudioRouteKind, string> = {
  phone: 'Phone',
  speaker: 'Speaker',
  bluetooth: 'Bluetooth',
  wired: 'Wired headset',
};

export function getAudioRouteLabel(route: AudioRouteKind): string {
  return AUDIO_ROUTE_LABELS[route];
}

export function resolveCallPhase(
  state: string,
  isIncoming: boolean,
  isHeld: boolean,
): CallPhase {
  const key = String(state).toUpperCase();
  if (isHeld || key === 'HELD') return 'held';
  switch (key) {
    case 'ACTIVE':
      return 'connected';
    case 'RINGING':
      return isIncoming ? 'ringing' : 'calling';
    case 'CONNECTING':
      return 'connecting';
    case 'DROPPED':
      return 'reconnecting';
    case 'FAILED':
      return 'failed';
    default:
      return isIncoming ? 'ringing' : 'calling';
  }
}

export function getCallStatusLabel(phase: CallPhase): string {
  const labels: Record<CallPhase, string> = {
    idle: '',
    calling: 'Calling…',
    connecting: 'Connecting…',
    ringing: 'Ringing…',
    connected: 'Connected',
    held: 'On hold',
    reconnecting: 'Reconnecting…',
    ended: 'Call ended',
    failed: 'Call failed',
  };
  return labels[phase];
}

export function getConnectionQualityLabel(phase: CallPhase): string | null {
  if (phase === 'connected' || phase === 'held') return 'HD Voice';
  if (phase === 'reconnecting') return 'Poor connection';
  return null;
}

export function normalizeAudioRoute(value: string | undefined): AudioRouteKind {
  const key = String(value || '').toLowerCase();
  if (key.includes('bluetooth') || key.includes('bt')) return 'bluetooth';
  if (key.includes('wired') || key.includes('headset') || key.includes('headphone')) return 'wired';
  if (key.includes('speaker')) return 'speaker';
  return 'phone';
}

export function resolveAudioRouteFromSpeaker(speakerOn: boolean): AudioRouteKind {
  return speakerOn ? 'speaker' : 'phone';
}

export function filterDialSuggestions<T extends { name: string; extensionNumber: string; assignedDidNumber?: string | null }>(
  contacts: T[],
  digits: string,
  limit = 4,
): T[] {
  const q = digits.trim().toLowerCase();
  if (!q) return [];

  return contacts
    .filter((contact) => {
      const name = contact.name.toLowerCase();
      const ext = contact.extensionNumber.replace(/\D/g, '');
      const did = (contact.assignedDidNumber || '').replace(/\D/g, '');
      const digitQuery = q.replace(/\D/g, '');
      return (
        name.includes(q)
        || (digitQuery.length > 0 && ext.startsWith(digitQuery))
        || (digitQuery.length > 0 && did.includes(digitQuery))
      );
    })
    .slice(0, limit);
}

export function collectRecentDialNumbers(
  calls: { from: string; to: string; direction?: string }[],
  limit = 6,
): string[] {
  const seen = new Set<string>();
  const results: string[] = [];

  for (const call of calls) {
    const number = call.direction === 'inbound' ? call.from : call.to;
    const key = number.replace(/\D/g, '');
    if (!key || seen.has(key)) continue;
    seen.add(key);
    results.push(number);
    if (results.length >= limit) break;
  }

  return results;
}
