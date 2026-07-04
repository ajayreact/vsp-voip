import { beforeEach, describe, expect, it, vi } from 'vitest';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const voicemailService = require('../../lib/v3/voicemailService.js');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const auditService = require('../../lib/v3/auditService.js');

function fakePrisma(store: { boxes: any[]; extensions: any[] }) {
  return {
    v3VoicemailBox: {
      findFirst: vi.fn(async ({ where }: any) => store.boxes.find((b) => {
        if (where.id && b.id !== where.id) return false;
        if (where.mailboxNumber && b.mailboxNumber !== where.mailboxNumber) return false;
        if (where.tenantId && b.tenantId !== where.tenantId) return false;
        if (where.removedAt === null && b.removedAt) return false;
        return true;
      }) || null),
      create: vi.fn(async ({ data }: any) => { store.boxes.push(data); return data; }),
      update: vi.fn(async ({ where, data }: any) => {
        const row = store.boxes.find((b) => b.id === where.id);
        Object.assign(row, data);
        return row;
      }),
    },
    extension: { findFirst: vi.fn(async ({ where }: any) => store.extensions.find((e) => e.id === where.id) || null) },
  };
}

describe('V3 voicemailService', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('creates mailbox and masks pin in serialize', async () => {
    const store = { boxes: [], extensions: [] };
    const prisma = fakePrisma(store);
    vi.spyOn(auditService, 'log').mockResolvedValue(undefined);

    const box = await voicemailService.createVoicemailBox(prisma, 't1', {
      mailboxNumber: '900',
      greeting: { text: 'Hi' },
      pin: '1234',
    }, { req: {} });

    expect(box.mailboxNumber).toBe('900');
    expect(box.hasPin).toBe(true);
    expect(box.pin).toBe('****');
  });
});
