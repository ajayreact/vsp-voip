import { beforeEach, describe, expect, it, vi } from 'vitest';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const reportService = require('../../lib/v3/reportService.js');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const healthCheckService = require('../../lib/v3/healthCheckService.js');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const auditService = require('../../lib/v3/auditService.js');

describe('V3 reportService', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('exports CSV with BOM', () => {
    const exported = reportService.exportReport({
      title: 'Test Report',
      columns: [{ key: 'name', label: 'Name' }],
      rows: [{ name: 'Alice' }],
    }, 'csv');
    expect(exported.contentType).toContain('csv');
    expect(exported.body.startsWith('\uFEFF')).toBe(true);
    expect(exported.body).toContain('Alice');
  });

  it('exports excel xml', () => {
    const exported = reportService.exportReport({
      title: 'Test',
      columns: [{ key: 'a', label: 'A' }],
      rows: [{ a: '1' }],
    }, 'excel');
    expect(exported.contentType).toContain('excel');
    expect(exported.body).toContain('Workbook');
  });

  it('generates employees report and audits export', async () => {
    vi.spyOn(healthCheckService, 'employeeHealth').mockResolvedValue({
      employees: [{ name: 'Alice', email: 'a@x.com', extensionNumber: '101', did: null, overall: 'green', sipUsername: 'sip' }],
    });
    vi.spyOn(auditService, 'log').mockResolvedValue(undefined);

    const report = await reportService.generateReport({}, 't1', 'employees');
    expect(report.rows).toHaveLength(1);

    const exported = await reportService.exportReportForTenant({}, 't1', 'employees', 'csv', { req: {} });
    expect(exported.filename).toContain('.csv');
    expect(auditService.log).toHaveBeenCalledWith(expect.anything(), {}, expect.objectContaining({ action: 'v3.report.exported' }));
  });

  it('rejects invalid report type', async () => {
    await expect(reportService.generateReport({}, 't1', 'invalid')).rejects.toMatchObject({ status: 400 });
  });
});
