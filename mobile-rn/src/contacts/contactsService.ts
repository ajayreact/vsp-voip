import { endpoints } from '../api/endpoints';
import { authorizedRequest } from '../auth/authService';
import type { ContactEntry, ExtensionRecord } from '../api/types';

export function mapExtensionToContact(ext: ExtensionRecord): ContactEntry {
  const name = ext.displayName?.trim() || ext.employeeName?.trim() || `Ext ${ext.extensionNumber}`;
  return {
    id: ext.id,
    name,
    extensionNumber: ext.extensionNumber,
    department: ext.department ?? '',
    email: ext.email ?? ext.user?.email ?? null,
    assignedDidNumber: ext.assignedDidNumber,
    status: ext.status,
    isOnline: Boolean(ext.registration?.isLive),
  };
}

export async function fetchContacts(): Promise<ContactEntry[]> {
  const response = await authorizedRequest<{ success?: boolean; extensions?: ExtensionRecord[] }>(
    endpoints.tenant.extensions,
  );
  const extensions = response.extensions ?? [];
  return extensions
    .filter((ext) => ext.status === 'ACTIVE')
    .map(mapExtensionToContact)
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function fetchContactDetail(id: string): Promise<ExtensionRecord> {
  const response = await authorizedRequest<{ success?: boolean; extension: ExtensionRecord }>(
    endpoints.tenant.extension(id),
  );
  return response.extension;
}

export function filterContacts(contacts: ContactEntry[], query: string): ContactEntry[] {
  const q = query.trim().toLowerCase();
  if (!q) return contacts;
  return contacts.filter(
    (c) =>
      c.name.toLowerCase().includes(q)
      || c.extensionNumber.includes(q)
      || c.department.toLowerCase().includes(q)
      || (c.email?.toLowerCase().includes(q) ?? false)
      || (c.assignedDidNumber?.includes(q) ?? false),
  );
}
