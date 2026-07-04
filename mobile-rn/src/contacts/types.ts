import type { ExtensionStatus } from '../api/types';

export type ContactKind = 'company' | 'customer';

export type ContactPresence = 'online' | 'offline' | 'on_call' | 'dnd' | 'unknown';

export type UnifiedContact = {
  id: string;
  kind: ContactKind;
  name: string;
  extensionNumber?: string;
  department?: string;
  jobTitle?: string;
  email?: string | null;
  assignedDidNumber?: string | null;
  phoneNumbers: string[];
  company?: string;
  notes?: string;
  isOnline?: boolean;
  presence: ContactPresence;
  mobileAvailable?: boolean;
  deskPhoneAvailable?: boolean;
  lastContactAt?: string | null;
  status?: ExtensionStatus;
};

export type CustomerContactRecord = {
  id: string;
  name: string;
  company?: string;
  phoneNumbers: string[];
  email?: string;
  notes?: string;
  lastContactAt?: string;
  createdAt: string;
  updatedAt: string;
};

export type ContactDirectoryMode = 'company' | 'customers' | 'favorites' | 'recent';

export function favoriteKeyForContact(contact: Pick<UnifiedContact, 'id' | 'kind'>): string {
  return contact.kind === 'customer' ? `customer:${contact.id}` : contact.id;
}

export function parseFavoriteKey(key: string): { kind: ContactKind; id: string } {
  if (key.startsWith('customer:')) {
    return { kind: 'customer', id: key.slice('customer:'.length) };
  }
  return { kind: 'company', id: key };
}

export function primaryDialNumber(contact: UnifiedContact): string {
  return contact.assignedDidNumber || contact.phoneNumbers[0] || contact.extensionNumber || '';
}
