import type { ExtensionRecord } from '@/lib/api';

function normalizeDigits(value: string) {
  return value.replace(/\D/g, '');
}

function fieldMatchesExtension(field: string, ext: ExtensionRecord) {
  const fieldDigits = normalizeDigits(field);
  if (!fieldDigits) return false;

  const extNum = normalizeDigits(ext.extensionNumber);
  if (extNum.length >= 2 && fieldDigits.includes(extNum)) return true;

  const did = ext.assignedDidNumber || ext.ownership?.assignedDidNumber;
  if (did) {
    const didDigits = normalizeDigits(did);
    const tail = didDigits.slice(-10);
    const fieldTail = fieldDigits.slice(-10);
    if (tail.length >= 7 && fieldTail === tail) return true;
  }

  return false;
}

/** Match a CDR row to an extension using direction-aware heuristics (client-side only). */
export function matchExtensionForCall(
  call: { from: string; to: string; direction: string },
  extensions: ExtensionRecord[],
): ExtensionRecord | undefined {
  const primary = call.direction === 'inbound' ? call.to : call.from;
  const secondary = call.direction === 'inbound' ? call.from : call.to;

  for (const ext of extensions) {
    if (fieldMatchesExtension(primary, ext)) return ext;
  }
  for (const ext of extensions) {
    if (fieldMatchesExtension(secondary, ext)) return ext;
  }
  return undefined;
}

export function enrichCallRow<T extends { from: string; to: string; direction: string }>(
  call: T,
  extensions: ExtensionRecord[],
): T & { extensionNumber: string; employeeName: string } {
  const ext = matchExtensionForCall(call, extensions);
  return {
    ...call,
    extensionNumber: ext?.extensionNumber || '—',
    employeeName: ext?.employeeName || ext?.displayName || '—',
  };
}
