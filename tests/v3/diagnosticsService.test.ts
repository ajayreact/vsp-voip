import { beforeEach, describe, expect, it, vi } from 'vitest';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const diagnosticsService = require('../../lib/v3/diagnosticsService.js');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const runtimeValidationService = require('../../lib/v3/runtimeValidationService.js');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const deploymentService = require('../../lib/v3/deploymentService.js');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const backupService = require('../../lib/v3/backupService.js');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const runtimeSyncService = require('../../lib/v3/runtime/runtimeSyncService.js');

describe('V3 diagnosticsService', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('detects drift and missing backup', async () => {
    vi.spyOn(runtimeValidationService, 'getValidationReport').mockResolvedValue({
      domains: [{ domain: 'ringGroups', level: 'red', errors: 1, warnings: 0 }],
      provisioning: { missingCredentials: 2 },
    });
    vi.spyOn(deploymentService, 'getDeploymentStatus').mockResolvedValue({
      readiness: { portalEnabled: true },
    });
    vi.spyOn(backupService, 'collectConfiguration').mockResolvedValue({ version: 1, exportedAt: new Date().toISOString() });
    vi.spyOn(backupService, 'countItems').mockReturnValue({ ringGroups: 1 });
    vi.spyOn(runtimeSyncService, 'getStatus').mockResolvedValue({ jobs: { deadLetter: 1 } });

    const prisma = {
      v3RuntimeLink: { findMany: vi.fn(async () => []) },
      v3TenantBackup: { findFirst: vi.fn(async () => null) },
    };

    const diagnostics = await diagnosticsService.getDiagnostics(prisma, 't1');
    expect(diagnostics.readOnly).toBe(true);
    expect(diagnostics.issues.some((i: { code: string }) => i.code === 'NO_BACKUP')).toBe(true);
    expect(diagnostics.issues.some((i: { code: string }) => i.code === 'SYNC_DEAD_LETTER')).toBe(true);
    expect(diagnostics.repairRecommendations.length).toBeGreaterThan(0);
  });
});
