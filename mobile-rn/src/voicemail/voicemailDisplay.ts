import type { VoicemailRecord } from '../api/types';
import type { UnifiedContact } from '../contacts/types';
import { normalizePhoneKey } from '../contacts/contactPresence';
import { formatPhone } from '../utils/format';

export type EnrichedVoicemail = VoicemailRecord & {
  contactName?: string;
  contactCompany?: string;
  businessDidLabel: string;
};

export function formatVoicemailDuration(seconds: number | null | undefined): string {
  const total = Math.max(0, Math.round(seconds ?? 0));
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  if (mins <= 0) return `${secs}s`;
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

export function enrichVoicemail(
  voicemail: VoicemailRecord,
  contactsByPhone: Map<string, UnifiedContact>,
): EnrichedVoicemail {
  const key = normalizePhoneKey(voicemail.from);
  const contact = contactsByPhone.get(key);
  return {
    ...voicemail,
    contactName: contact?.name,
    contactCompany: contact?.company || contact?.department || undefined,
    businessDidLabel: formatPhone(voicemail.to),
  };
}

export function filterVoicemails(
  voicemails: EnrichedVoicemail[],
  query: string,
): EnrichedVoicemail[] {
  const q = query.trim().toLowerCase();
  if (!q) return voicemails;

  const digitQuery = q.replace(/\D/g, '');

  return voicemails.filter((vm) => {
    const haystack = [
      vm.from,
      vm.to,
      vm.contactName,
      vm.contactCompany,
      vm.businessDidLabel,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    if (haystack.includes(q)) return true;
    if (!digitQuery) return false;
    return (
      vm.from.replace(/\D/g, '').includes(digitQuery)
      || vm.to.replace(/\D/g, '').includes(digitQuery)
    );
  });
}

export function voicemailDisplayName(vm: EnrichedVoicemail): string {
  return vm.contactName || formatPhone(vm.from);
}
