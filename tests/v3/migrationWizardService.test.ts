import { beforeEach, describe, expect, it, vi } from 'vitest';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const migrationWizardService = require('../../lib/v3/migrationWizardService.js');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const backupService = require('../../lib/v3/backupService.js');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const licenseService = require('../../lib/v3/licenseService.js');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const healthCheckService = require('../../lib/v3/healthCheckService.js');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const repairService = require('../../lib/v3/repairService.js');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const runtimeValidationService = require('../../lib/v3/runtimeValidationService.js');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const rollbackService = require('../../lib/v3/rollbackService.js');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const auditService = require('../../lib/v3/auditService.js');

function mockPrisma(overrides: Record<string, unknown> = {}) {
  return {
    tenant: {
      findUnique: vi.fn(async () => ({ id: 't1', name: 'Acme', isActive: true })),
    },
    user: { findMany: vi.fn(async () => []), count: vi.fn(async () => 0) },
    extension: { findMany: vi.fn(async () => []), count: vi.fn(async () => 0) },
    phoneNumber: { findMany: vi.fn(async () => []), count: vi.fn(async () => 0) },
    v3RingGroup: { findMany: vi.fn(async () => []) },
    v3Queue: { findMany: vi.fn(async () => []) },
    v3VoicemailBox: { findMany: vi.fn(async () => []) },
    v3BusinessHoursSchedule: { findMany: vi.fn(async () => []) },
    v3Holiday: { findMany: vi.fn(async () => []) },
    v3CallFlow: { findMany: vi.fn(async () => []) },
    v3RuntimeLink: {
      findMany: vi.fn(async () => []),
      findUnique: vi.fn(async () => null),
      count: vi.fn(async () => 0),
    },
    v3DeskDevice: { findMany: vi.fn(async () => []) },
    ringGroup: { findMany: vi.fn(async () => []) },
    v3MigrationRun: {
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({ id: 'run1', ...data })),
      update: vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({ id: 'run1', ...data })),
      findFirst: vi.fn(async () => ({ id: 'run1', backupId: 'bak1', runType: 'wizard' })),
    },
    v3RuntimeSyncJob: { groupBy: vi.fn(async () => []) },
    ...overrides,
  };
}

describe('V3 migrationWizardService', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('returns read-only discovery inventory', async () => {
    vi.spyOn(backupService, 'collectConfiguration').mockResolvedValue({
      employees: [{ id: 'u1' }],
      extensions: [],
      phoneNumbers: [],
      pbx: { ringGroups: [], queues: [], businessHours: [], holidays: [], voicemailBoxes: [] },
      callFlows: [],
      deskPhones: [],
      softphone: { profiles: [] },
      settings: { tenant: { name: 'Acme' } },
    });
    vi.spyOn(backupService, 'countItems').mockReturnValue({ employees: 1, extensions: 0 });
    vi.spyOn(backupService, 'listBackups').mockResolvedValue({ items: [], total: 0 });
    vi.spyOn(licenseService, 'getLicense').mockResolvedValue({ plan: 'starter', health: { seats: 'green' } });
    vi.spyOn(healthCheckService, 'tenantHealthSummary').mockResolvedValue({
      totalEmployees: 1,
      ready: 1,
      warnings: 0,
      errors: 0,
    });

    const prisma = mockPrisma();
    const result = await migrationWizardService.discovery(prisma, 't1');
    expect(result.readOnly).toBe(true);
    expect(result.counts.employees).toBe(1);
    expect(result.inventory.employees).toHaveLength(1);
  });

  it('validates tenant and reports overall level', async () => {
    vi.spyOn(repairService, 'analyze').mockResolvedValue({ changes: [], observations: [], scanned: {} });
    vi.spyOn(repairService, 'analyzeNumbers').mockResolvedValue({ changes: [], observations: [], scanned: {} });
    vi.spyOn(runtimeValidationService, 'getValidationReport').mockResolvedValue({
      overall: 'green',
      domains: [],
      readOnly: true,
    });
    vi.spyOn(migrationWizardService, 'countMissingRuntimeLinks').mockResolvedValue({ total: 0, byDomain: {} });

    const prisma = mockPrisma({
      v3RingGroup: { findMany: vi.fn(async () => [{ id: 'rg1' }]) },
      v3Queue: { findMany: vi.fn(async () => [{ id: 'q1' }]) },
      v3VoicemailBox: { findMany: vi.fn(async () => [{ id: 'vm1' }]) },
      v3BusinessHoursSchedule: { findMany: vi.fn(async () => [{ id: 'bh1' }]) },
      v3Holiday: { findMany: vi.fn(async () => [{ id: 'h1' }]) },
    });
    const result = await migrationWizardService.validate(prisma, 't1');
    expect(result.readOnly).toBe(true);
    expect(['green', 'yellow']).toContain(result.overall);
  });

  it('returns read-only migration preview with actions', async () => {
    vi.spyOn(migrationWizardService, 'validate').mockResolvedValue({
      overall: 'yellow',
      grouped: { red: [], yellow: [], green: [] },
      summary: { red: 0, yellow: 1 },
    });
    vi.spyOn(repairService, 'analyze').mockResolvedValue({
      changes: [{ type: 'MISSING_VOICEMAIL', entity: 'Extension', ref: '101', detail: 'missing vm' }],
      observations: [],
    });
    vi.spyOn(repairService, 'analyzeNumbers').mockResolvedValue({ changes: [], observations: [] });
    vi.spyOn(migrationWizardService, 'countMissingRuntimeLinks').mockResolvedValue({ total: 3, byDomain: { extensions: 3 } });
    vi.spyOn(backupService, 'collectConfiguration').mockResolvedValue({
      employees: [],
      extensions: [],
      phoneNumbers: [],
      pbx: { ringGroups: [], queues: [], businessHours: [], holidays: [], voicemailBoxes: [] },
      callFlows: [],
      deskPhones: [],
      softphone: { profiles: [] },
      settings: { tenant: { name: 'Acme' } },
    });
    vi.spyOn(backupService, 'countItems').mockReturnValue({ employees: 2, extensions: 2, ringGroups: 1, queues: 0 });
    vi.spyOn(backupService, 'listBackups').mockResolvedValue({ items: [], total: 0 });
    vi.spyOn(licenseService, 'getLicense').mockResolvedValue({ plan: 'starter' });
    vi.spyOn(healthCheckService, 'tenantHealthSummary').mockResolvedValue({ totalEmployees: 0, ready: 0, warnings: 0, errors: 0 });

    const prisma = mockPrisma();
    const result = await migrationWizardService.preview(prisma, 't1');
    expect(result.readOnly).toBe(true);
    expect(result.actions.runtimeLinks.create).toBeGreaterThan(0);
    expect(result.actions.extensions.update).toBeGreaterThan(0);
  });

  it('executes dry-run migration without backup', async () => {
    const prisma = mockPrisma();
    vi.spyOn(migrationWizardService, 'validate').mockResolvedValue({ overall: 'green', summary: {}, grouped: { red: [], yellow: [], green: [] } });
    vi.spyOn(repairService, 'repair').mockResolvedValue({ mode: 'dry-run', applied: [], changes: [] });
    vi.spyOn(repairService, 'repairNumbers').mockResolvedValue({ mode: 'dry-run', applied: [], changes: [] });
    vi.spyOn(healthCheckService, 'employeeHealth').mockResolvedValue({ employees: [{ overall: 'green' }], readiness: {} });
    vi.spyOn(runtimeValidationService, 'getValidationReport').mockResolvedValue({ overall: 'green', domains: [{ level: 'green' }] });
    const runtimeHealthService = require('../../lib/v3/runtime/runtimeHealthService.js');
    vi.spyOn(runtimeHealthService, 'getRuntimeHealth').mockResolvedValue({ overall: 'green' });
    const productionHealthService = require('../../lib/v3/productionHealthService.js');
    vi.spyOn(productionHealthService, 'getProductionHealth').mockResolvedValue({ overall: 'green', criticalIssues: [] });
    const diagnosticsService = require('../../lib/v3/diagnosticsService.js');
    vi.spyOn(diagnosticsService, 'getDiagnostics').mockResolvedValue({ issues: [] });
    vi.spyOn(backupService, 'collectConfiguration').mockResolvedValue({ employees: [], extensions: [], phoneNumbers: [], pbx: {}, callFlows: [], deskPhones: [], softphone: { profiles: [] }, settings: {} });
    vi.spyOn(backupService, 'countItems').mockReturnValue({});
    vi.spyOn(backupService, 'listBackups').mockResolvedValue({ items: [], total: 0 });
    vi.spyOn(licenseService, 'getLicense').mockResolvedValue({});
    vi.spyOn(healthCheckService, 'tenantHealthSummary').mockResolvedValue({});
    vi.spyOn(migrationWizardService, 'countMissingRuntimeLinks').mockResolvedValue({ total: 0, byDomain: {} });
    vi.spyOn(repairService, 'analyze').mockResolvedValue({ changes: [], observations: [] });
    vi.spyOn(repairService, 'analyzeNumbers').mockResolvedValue({ changes: [], observations: [] });
    vi.spyOn(runtimeValidationService, 'getValidationReport').mockResolvedValue({ overall: 'green', domains: [] });
    vi.spyOn(auditService, 'log').mockResolvedValue(undefined);

    const result = await migrationWizardService.runMigration(prisma, 't1', { dryRun: true, req: {} });
    expect(result.run.status).toBe('VALIDATED');
    expect(result.report.dryRun).toBe(true);
    expect(result.postValidation.pass).toBe('PASS');
  });

  it('rolls back from wizard migration run backup', async () => {
    const prisma = mockPrisma();
    vi.spyOn(rollbackService, 'rollbackExecute').mockResolvedValue({
      dryRun: false,
      backupId: 'bak1',
      report: { applied: 2 },
    });
    vi.spyOn(auditService, 'log').mockResolvedValue(undefined);

    const result = await migrationWizardService.rollbackMigration(prisma, 't1', {
      migrationRunId: 'run1',
      req: {},
    });
    expect(result.backupId).toBe('bak1');
    expect(rollbackService.rollbackExecute).toHaveBeenCalledWith(prisma, 't1', expect.objectContaining({ backupId: 'bak1' }));
  });

  it('detects duplicate extension numbers as red', async () => {
    vi.spyOn(repairService, 'analyze').mockResolvedValue({ changes: [], observations: [], scanned: {} });
    vi.spyOn(repairService, 'analyzeNumbers').mockResolvedValue({ changes: [], observations: [], scanned: {} });
    vi.spyOn(runtimeValidationService, 'getValidationReport').mockResolvedValue({ overall: 'green', domains: [] });
    vi.spyOn(migrationWizardService, 'countMissingRuntimeLinks').mockResolvedValue({ total: 0, byDomain: {} });

    const prisma = mockPrisma({
      extension: {
        findMany: vi.fn(async () => [
          { id: 'e1', extensionNumber: '101', userId: 'u1', user: {}, primaryPhoneNumberId: null, voicemailSettings: {} },
          { id: 'e2', extensionNumber: '101', userId: 'u2', user: {}, primaryPhoneNumberId: null, voicemailSettings: {} },
        ]),
      },
    });

    const result = await migrationWizardService.validate(prisma, 't1');
    expect(result.grouped.red.some((i: { code: string }) => i.code === 'DUPLICATE_EXTENSION')).toBe(true);
    expect(result.overall).toBe('red');
  });

  it('post validation returns PASS when health checks succeed', async () => {
    vi.spyOn(healthCheckService, 'employeeHealth').mockResolvedValue({
      employees: [{ overall: 'green' }],
      readiness: {},
    });
    vi.spyOn(runtimeValidationService, 'getValidationReport').mockResolvedValue({
      overall: 'green',
      domains: [{ level: 'green' }],
    });
    const runtimeHealthService = require('../../lib/v3/runtime/runtimeHealthService.js');
    vi.spyOn(runtimeHealthService, 'getRuntimeHealth').mockResolvedValue({ overall: 'green' });
    const productionHealthService = require('../../lib/v3/productionHealthService.js');
    vi.spyOn(productionHealthService, 'getProductionHealth').mockResolvedValue({
      overall: 'green',
      criticalIssues: [],
    });
    const diagnosticsService = require('../../lib/v3/diagnosticsService.js');
    vi.spyOn(diagnosticsService, 'getDiagnostics').mockResolvedValue({ issues: [] });

    const prisma = mockPrisma();
    const result = await migrationWizardService.postValidation(prisma, 't1');
    expect(result.pass).toBe('PASS');
  });
});
