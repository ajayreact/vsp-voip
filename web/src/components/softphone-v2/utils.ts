import type { CallHistoryRecord, CallHistoryStatus, ContactEntry } from '@/components/softphone-v2/types';

export function normalizePhoneKey(value: string) {
  return value.replace(/\D/g, '');
}

export function formatPhoneDisplay(value: string) {
  if (/^\d{2,6}$/.test(value.trim())) {
    return `Ext ${value.trim()}`;
  }
  const digits = value.replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('1')) {
    return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `+1 (${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  return value || 'Unknown Caller';
}

export function formatCallTimer(totalSeconds: number) {
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export function formatHistoryTimestamp(iso: string) {
  const date = new Date(iso);
  const now = new Date();
  const time = date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  if (date.toDateString() === now.toDateString()) {
    return time;
  }
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) {
    return 'Yesterday';
  }
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function callerInitials(number: string) {
  const digits = number.replace(/\D/g, '');
  if (digits && !/[a-z]/i.test(number)) {
    return digits.slice(0, 2);
  }

  const words = number.trim().split(/\s+/).filter(Boolean);
  if (words.length > 1) {
    return words.slice(0, 2).map((word) => word[0]?.toUpperCase()).join('');
  }
  if (words[0] && /[a-z]/i.test(words[0])) {
    return words[0].slice(0, 2).toUpperCase();
  }
  return digits.slice(0, 2) || 'UC';
}

export function resolveCallerIdentity(
  value: string,
  contacts: ContactEntry[] = [],
) {
  const trimmed = value.trim();
  const key = normalizePhoneKey(trimmed);
  const match = contacts.find((contact) => {
    const extKey = normalizePhoneKey(contact.extensionNumber);
    const numberKey = normalizePhoneKey(contact.number || '');
    return Boolean(
      key
      && (
        key === extKey
        || key === numberKey
        || (key.length >= 10 && numberKey.endsWith(key.slice(-10)))
        || (numberKey.length >= 10 && key.endsWith(numberKey.slice(-10)))
      ),
    );
  });

  if (match) {
    return {
      name: match.name || `Ext ${match.extensionNumber}`,
      number: match.number || `Ext ${match.extensionNumber}`,
      initials: callerInitials(match.name || match.extensionNumber),
    };
  }

  return {
    name: trimmed ? formatPhoneDisplay(trimmed) : 'Unknown Caller',
    number: trimmed ? formatPhoneDisplay(trimmed) : 'Unknown Caller',
    initials: callerInitials(trimmed),
  };
}

export function callStatusLabel(state: string) {
  switch (state) {
    case 'active':
      return 'Connected';
    case 'held':
      return 'On Hold';
    case 'ringing':
    case 'trying':
    case 'early':
    case 'answering':
      return 'Calling…';
    case 'requesting':
    case 'new':
      return 'Connecting…';
    default:
      return state ? state.charAt(0).toUpperCase() + state.slice(1) : 'Ready';
  }
}

export function historyDirectionLabel(direction: CallHistoryRecord['direction']) {
  return direction === 'outbound' ? 'Outgoing' : 'Incoming';
}

export function historyStatusLabel(record: CallHistoryRecord) {
  switch (record.status) {
    case 'missed':
      return 'Missed';
    case 'outbound_no_answer':
      return 'No Answer';
    case 'busy':
      return 'Busy';
    case 'failed':
      return 'Failed';
    case 'cancelled':
      return 'Cancelled';
    case 'rejected':
      return 'Rejected';
    case 'completed':
      return record.direction === 'outbound' ? 'Outgoing' : 'Incoming';
    default:
      return record.direction === 'outbound' ? 'Outgoing' : 'Incoming';
  }
}

/** True for inbound missed calls only (excludes outbound no-answer). */
export function isInboundMissedStatus(status: CallHistoryStatus) {
  return status === 'missed';
}

export const KEYPAD_DIGITS = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['*', '0', '#'],
] as const;

export const KEYPAD_LETTERS: Record<string, string> = {
  '2': 'ABC',
  '3': 'DEF',
  '4': 'GHI',
  '5': 'JKL',
  '6': 'MNO',
  '7': 'PQRS',
  '8': 'TUV',
  '9': 'WXYZ',
};
