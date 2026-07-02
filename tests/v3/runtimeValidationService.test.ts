import { beforeEach, describe, expect, it, vi } from 'vitest';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const runtimeValidationService = require('../../lib/v3/runtimeValidationService.js');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const healthCheckService = require('../../lib/v3/healthCheckService.js');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const auditService = require('../../lib/v3/auditService.js');

function basePrisma() {
  return {
    user: { count: vi.fn(async () => 5) },
    extension: {
      findMany: vi.fn(async () => []),
    },
    phoneNumber: { findMany: vi.fn(async () => []) },
    v3RingGroup: { findMany: vi.fn(async () => []) },
    v3Queue: { findMany: vi.fn(async () => []) },
    v3CallFlow: { findMany: vi.fn(async () => []) },
    v3VoicemailBox: { findMany: vi.fn(async () => []) },
    v3BusinessHoursSchedule: { findMany: vi.fn(async () => []) },
    v3DeskDevice: { findMany: vi.fn(async () => []) },
    v3RuntimeLink: { count: vi.fn(async () => 0) },
    v3RuntimeSyncJob: { groupBy: vi.fn(async () => []) },
  };
}

describe('V3 runtimeValidationService', () => {
  beforeEach(() => {
    process.env.V3_RUNTIME_SYNC_ENABLED = 'false';
    vi.restoreAllMocks();
  });

  it('builds read-only validation report', async () => {
    vi.spyOn(healthCheckService, 'tenantHealthSummary').mockResolvedValue({
      errors: 0,
      warnings: 1,
      total: 5,
    });

    const report = await runtimeValidationService.getValidationReport(basePrisma(), 't1');
    expect(report.readOnly).toBe(true);
    expect(report.domains.some((d: { domain: string }) => d.domain === 'employees')).toBe(true);
    expect(report.overall).toBe('yellow');
  });

  it('logs audit on runValidation', async () => {
    vi.spyOn(healthCheckService, 'tenantHealthSummary').mockResolvedValue({ errors: 0, warnings: 0, total: 1 });
    vi.spyOn(auditService, 'log').mockResolvedValue(undefined);

    const report = await runtimeValidationService.runValidation(basePrisma(), 't1', { req: {} });
    expect(report.readOnly).toBe(true);
    expect(auditService.log).toHaveBeenCalledWith(expect.anything(), {}, expect.objectContaining({ action: 'v3.validation.completed' }));
  });
});
