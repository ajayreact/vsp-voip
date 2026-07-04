import type { ContactEntry } from '../api/types';

function normalizePhoneKey(value: string) {
  return value.replace(/\D/g, '');
}

export function findContactByNumber(
  contacts: ContactEntry[],
  number: string,
): ContactEntry | undefined {
  const key = normalizePhoneKey(number);
  if (!key) return undefined;

  return contacts.find((contact) => {
    const extKey = normalizePhoneKey(contact.extensionNumber);
    const numberKey = normalizePhoneKey(contact.assignedDidNumber || '');
    return (
      key === extKey
      || key === numberKey
      || (key.length >= 10 && numberKey.length >= 10 && key.slice(-10) === numberKey.slice(-10))
    );
  });
}
