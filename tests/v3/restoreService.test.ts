import { beforeEach, describe, expect, it, vi } from 'vitest';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const restoreService = require('../../lib/v3/restoreService.js');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const backupService = require('../../lib/v3/backupService.js');

describe('V3 restoreService', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('previews restore diff', async () => {
    const payload = {
      version: 1,
      pbx: { ringGroups: [{ id: 'rg-new', name: 'Support', tenantId: 't1' }], queues: [], businessHours: [], holidays: [], voicemailBoxes: [] },
      callFlows: [],
      softphone: { profiles: [] },
    };

    vi.spyOn(backupService, 'collectConfiguration').mockResolvedValue({
      version: 1,
      pbx: { ringGroups: [], queues: [], businessHours: [], holidays: [], voicemailBoxes: [] },
      callFlows: [],
      softphone: { profiles: [] },
    });

    const preview = await restoreService.restorePreview({}, 't1', { payload });
    expect(preview.valid).toBe(true);
    expect(preview.summary.creates).toBeGreaterThan(0);
  });

  it('dry-run restore does not apply', async () => {
    const prisma = {
      v3RingGroup: { findFirst: vi.fn(async () => null), create: vi.fn(), update: vi.fn() },
      v3Queue: { findFirst: vi.fn(async () => null), create: vi.fn(), update: vi.fn() },
      v3BusinessHoursSchedule: { findFirst: vi.fn(async () => null), create: vi.fn(), update: vi.fn() },
      v3Holiday: { findFirst: vi.fn(async () => null), create: vi.fn(), update: vi.fn() },
      v3VoicemailBox: { findFirst: vi.fn(async () => null), create: vi.fn(), update: vi.fn() },
      v3CallFlow: { findFirst: vi.fn(async () => null), create: vi.fn(), update: vi.fn() },
      v3SoftphoneProfile: { findFirst: vi.fn(async () => null), create: vi.fn(), update: vi.fn() },
    };

    vi.spyOn(backupService, 'collectConfiguration').mockResolvedValue({
      version: 1,
      pbx: { ringGroups: [], queues: [], businessHours: [], holidays: [], voicemailBoxes: [] },
      callFlows: [],
      softphone: { profiles: [] },
    });

    const payload = {
      version: 1,
      pbx: { ringGroups: [{ id: 'rg1', name: 'Sales', tenantId: 't1' }], queues: [], businessHours: [], holidays: [], voicemailBoxes: [] },
      callFlows: [],
      softphone: { profiles: [] },
    };

    const result = await restoreService.applyRestore(prisma, 't1', { payload }, { dryRun: true });
    expect(result.dryRun).toBe(true);
    expect(prisma.v3RingGroup.create).not.toHaveBeenCalled();
  });
});
