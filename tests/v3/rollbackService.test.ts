import { beforeEach, describe, expect, it, vi } from 'vitest';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const rollbackService = require('../../lib/v3/rollbackService.js');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const restoreService = require('../../lib/v3/restoreService.js');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const auditService = require('../../lib/v3/auditService.js');

describe('V3 rollbackService', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('previews rollback from latest backup', async () => {
    const prisma = {
      v3TenantBackup: {
        findFirst: vi.fn(async () => ({
          id: 'b1',
          label: 'Pre-migration',
          createdAt: new Date(),
          payload: { version: 1 },
        })),
      },
    };
    vi.spyOn(restoreService, 'restorePreview').mockResolvedValue({ valid: true, summary: { items: 5 } });

    const preview = await rollbackService.rollbackPreview(prisma, 't1');
    expect(preview.readOnly).toBe(true);
    expect(preview.backupId).toBe('b1');
    expect(preview.preview.summary.items).toBe(5);
  });

  it('executes dry-run rollback with audit', async () => {
    const prisma = {
      v3TenantBackup: {
        findFirst: vi.fn(async () => ({ id: 'b1', label: 'Backup', createdAt: new Date(), payload: {} })),
      },
    };
    vi.spyOn(restoreService, 'restorePreview').mockResolvedValue({ valid: true, summary: {} });
    vi.spyOn(auditService, 'log').mockResolvedValue(undefined);

    const result = await rollbackService.rollbackExecute(prisma, 't1', { dryRun: true, req: {} });
    expect(result.dryRun).toBe(true);
    expect(auditService.log).toHaveBeenCalledWith(expect.anything(), {}, expect.objectContaining({ action: 'v3.rollback.preview' }));
  });
});
