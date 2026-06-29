import type { UnifiedContact } from './types';
import { normalizePhoneKey } from './contactPresence';

export function searchUnifiedContacts(contacts: UnifiedContact[], query: string): UnifiedContact[] {
  const q = query.trim().toLowerCase();
  if (!q) return contacts;

  const digitQuery = q.replace(/\D/g, '');

  return contacts.filter((contact) => {
    const haystack = [
      contact.name,
      contact.company,
      contact.department,
      contact.jobTitle,
      contact.email,
      contact.notes,
      contact.extensionNumber,
      contact.assignedDidNumber,
      ...contact.phoneNumbers,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    if (haystack.includes(q)) return true;

    if (!digitQuery) return false;

    const numbers = [
      contact.extensionNumber,
      contact.assignedDidNumber,
      ...contact.phoneNumbers,
    ]
      .filter(Boolean)
      .map(normalizePhoneKey);

    return numbers.some((number) => number.includes(digitQuery) || number.startsWith(digitQuery));
  });
}

export function sortUnifiedContacts(contacts: UnifiedContact[]): UnifiedContact[] {
  return [...contacts].sort((a, b) => a.name.localeCompare(b.name));
}
