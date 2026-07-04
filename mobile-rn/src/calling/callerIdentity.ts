import type { ContactEntry } from '../api/types';
import { formatPhone } from '../utils/format';
import type { InboundCallerCallFields } from './inboundCallerDisplay';
import {
  resolveInboundCallerDisplay,
  resolveInboundCallerNameHint,
} from './inboundCallerDisplay';

function normalizePhoneKey(value: string) {
  return value.replace(/\D/g, '');
}

export function resolveLiveCallerIdentity(
  displayNumber: string,
  contacts: ContactEntry[] = [],
  nameHint = '',
) {
  const trimmed = displayNumber.trim();
  const key = normalizePhoneKey(trimmed);
  const match = contacts.find((contact) => {
    const extKey = normalizePhoneKey(contact.extensionNumber);
    const numberKey = normalizePhoneKey(contact.assignedDidNumber || '');
    return Boolean(
      key
      && (
        key === extKey
        || key === numberKey
        || (key.length >= 10 && numberKey.length >= 10 && key.slice(-10) === numberKey.slice(-10))
      ),
    );
  });

  const formattedNumber = trimmed ? formatPhone(trimmed) : 'Unknown';

  if (match) {
    return {
      name: match.name,
      number: formattedNumber,
      initials: match.name.slice(0, 2).toUpperCase(),
    };
  }

  if (
    nameHint
    && nameHint !== 'Unknown Caller'
    && normalizePhoneKey(nameHint) !== key
  ) {
    return {
      name: nameHint,
      number: formattedNumber,
      initials: nameHint.slice(0, 2).toUpperCase(),
    };
  }

  return {
    name: formattedNumber,
    number: formattedNumber,
    initials: formattedNumber.replace(/\D/g, '').slice(-2) || '??',
  };
}

export function resolveInboundCallIdentity(
  fields: InboundCallerCallFields,
  ownNumbers: string[],
  contacts: ContactEntry[] = [],
) {
  const resolution = resolveInboundCallerDisplay(fields, ownNumbers);
  const nameHint = resolveInboundCallerNameHint(fields);
  const identity = resolveLiveCallerIdentity(resolution.chosenDisplayNumber, contacts, nameHint);
  return { resolution, identity };
}
