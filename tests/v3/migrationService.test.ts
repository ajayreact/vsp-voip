import { beforeEach, describe, expect, it, vi } from 'vitest';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const migrationService = require('../../lib/v3/migrationService.js');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const backupService = require('../../lib/v3/backupService.js');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const runtimeValidationService = require('../../lib/v3/runtimeValidationService.js');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const auditService = require('../../lib/v3/auditService.js');

describe('V3 migrationService', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('returns read-only migration preview', async () => {
    vi.spyOn(backupService, 'collectConfiguration').mockResolvedValue({ version: 1, pbx: {} });
    vi.spyOn(backupService, 'countItems').mockReturnValue({ employees: 2 });

    const preview = await migrationService.migrationPreview({}, 't1');
    expect(preview.readOnly).toBe(true);
    expect(preview.dryRun).toBe(true);
    expect(preview.currentCounts.employees).toBe(2);
  });

  it('executes dry-run migration without backup', async () => {
    const runs: any[] = [];
    const prisma = {
      v3MigrationRun: {
        create: vi.fn(async ({ data }: any) => {
          runs.push({ ...data });
          return { id: 'run1', ...data };
        }),
        update: vi.fn(async ({ data }: any) => ({ id: 'run1', ...runs[0], ...data })),
        findFirst: vi.fn(async () => null),
        findMany: vi.fn(async () => []),
        count: vi.fn(async () => 0),
      },
    };

    vi.spyOn(runtimeValidationService, 'getValidationReport').mockResolvedValue({
      overall: 'green',
      domains: [],
      readOnly: true,
    });
    vi.spyOn(auditService, 'log').mockResolvedValue(undefined);

    const result = await migrationService.migrationExecute(prisma, 't1', { dryRun: true, req: {} });
    expect(result.run.status).toBe('VALIDATED');
    expect(result.report.dryRun).toBe(true);
    expect(auditService.log).toHaveBeenCalled();
  });

  it('lists migration reports', async () => {
    const prisma = {
      v3MigrationRun: {
        findMany: vi.fn(async () => [{ id: 'r1', status: 'SUCCESS' }]),
        count: vi.fn(async () => 1),
      },
    };
    const report = await migrationService.getMigrationReport(prisma, 't1');
    expect(report.total).toBe(1);
    expect(report.items).toHaveLength(1);
  });
});
