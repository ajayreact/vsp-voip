import type { ContactEntry, ExtensionRecord } from '../api/types';
import type { ContactPresence, CustomerContactRecord, UnifiedContact } from './types';

export function normalizePhoneKey(value: string) {
  return value.replace(/\D/g, '');
}

export function resolveContactPresence(params: {
  isOnline?: boolean;
  doNotDisturb?: boolean;
  onCall?: boolean;
}): ContactPresence {
  if (params.onCall) return 'on_call';
  if (params.doNotDisturb) return 'dnd';
  if (params.isOnline) return 'online';
  if (params.isOnline === false) return 'offline';
  return 'unknown';
}

export function getPresenceLabel(presence: ContactPresence): string {
  const labels: Record<ContactPresence, string> = {
    online: 'Online',
    offline: 'Offline',
    on_call: 'On call',
    dnd: 'Do not disturb',
    unknown: 'Unknown',
  };
  return labels[presence];
}

export function isPeerOnActiveCall(
  peerNumbers: string[],
  activePeers: string[],
): boolean {
  const activeKeys = new Set(activePeers.map(normalizePhoneKey).filter(Boolean));
  return peerNumbers.some((number) => {
    const key = normalizePhoneKey(number);
    if (!key) return false;
    if (activeKeys.has(key)) return true;
    if (key.length >= 10) {
      const last10 = key.slice(-10);
      return [...activeKeys].some((entry) => entry.slice(-10) === last10);
    }
    return false;
  });
}

export function companyContactFromEntry(
  entry: ContactEntry,
  extension?: ExtensionRecord | null,
  activePeers: string[] = [],
): UnifiedContact {
  const phoneNumbers = [entry.assignedDidNumber, entry.extensionNumber].filter(Boolean) as string[];
  const onCall = isPeerOnActiveCall(phoneNumbers, activePeers);
  const doNotDisturb = Boolean(extension?.features?.doNotDisturb);
  const isOnline = entry.isOnline;
  const presence = resolveContactPresence({ isOnline, doNotDisturb, onCall });
  const softphoneLive = Boolean(extension?.registration?.isLive ?? entry.isOnline);

  return {
    id: entry.id,
    kind: 'company',
    name: entry.name,
    extensionNumber: entry.extensionNumber,
    department: entry.department,
    jobTitle: extension?.employeeName && extension.displayName
      ? extension.displayName
      : undefined,
    email: entry.email,
    assignedDidNumber: entry.assignedDidNumber,
    phoneNumbers,
    isOnline,
    presence,
    mobileAvailable: softphoneLive,
    deskPhoneAvailable: Boolean(entry.assignedDidNumber),
    lastContactAt: extension?.lastActivityAt || extension?.lastSeen || null,
    status: entry.status,
  };
}

export function customerContactFromRecord(record: CustomerContactRecord): UnifiedContact {
  return {
    id: record.id,
    kind: 'customer',
    name: record.name,
    company: record.company,
    email: record.email || null,
    phoneNumbers: record.phoneNumbers,
    notes: record.notes,
    presence: 'unknown',
    lastContactAt: record.lastContactAt || null,
  };
}
