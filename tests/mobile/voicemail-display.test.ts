import { describe, expect, it } from 'vitest';
import {
  enrichVoicemail,
  filterVoicemails,
  formatVoicemailDuration,
  voicemailDisplayName,
} from '../../mobile-rn/src/voicemail/voicemailDisplay';
import type { VoicemailRecord } from '../../mobile-rn/src/api/types';
import type { UnifiedContact } from '../../mobile-rn/src/contacts/types';

const sampleVm: VoicemailRecord = {
  id: 'vm-1',
  from: '+15551234567',
  to: '+15559876543',
  durationSeconds: 65,
  isRead: false,
  createdAt: '2026-06-24T12:00:00.000Z',
};

describe('voicemail display', () => {
  it('formats duration as mm:ss', () => {
    expect(formatVoicemailDuration(65)).toBe('1:05');
    expect(formatVoicemailDuration(8)).toBe('8s');
  });

  it('enriches voicemail with contact metadata', () => {
    const contacts = new Map<string, UnifiedContact>([
      [
        '15551234567',
        {
          id: 'c1',
          kind: 'company',
          name: 'Jane Doe',
          company: 'Acme Corp',
          phoneNumbers: ['+15551234567'],
        },
      ],
    ]);

    const enriched = enrichVoicemail(sampleVm, contacts);
    expect(enriched.contactName).toBe('Jane Doe');
    expect(enriched.contactCompany).toBe('Acme Corp');
    expect(voicemailDisplayName(enriched)).toBe('Jane Doe');
  });

  it('filters voicemails by contact name', () => {
    const contacts = new Map<string, UnifiedContact>();
    const enriched = enrichVoicemail(sampleVm, contacts);
    enriched.contactName = 'Support Team';

    expect(filterVoicemails([enriched], 'support')).toHaveLength(1);
    expect(filterVoicemails([enriched], 'missing')).toHaveLength(0);
  });
});
