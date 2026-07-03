import { beforeEach, describe, expect, it, vi } from 'vitest';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const exportImportService = require('../../lib/v3/exportImportService.js');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const backupService = require('../../lib/v3/backupService.js');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const auditService = require('../../lib/v3/auditService.js');

describe('V3 exportImportService', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('validates import payload version', () => {
    const bad = exportImportService.validateImportPayload({ version: 99 });
    expect(bad.valid).toBe(false);
    const good = exportImportService.validateImportPayload({ version: backupService.BACKUP_VERSION, settings: {} });
    expect(good.valid).toBe(true);
  });

  it('exports json with audit', async () => {
    vi.spyOn(backupService, 'collectConfiguration').mockResolvedValue({ version: 1, employees: [] });
    vi.spyOn(auditService, 'log').mockResolvedValue(undefined);
    const exported = await exportImportService.exportConfiguration({}, 't1', 'json', { req: {} });
    expect(exported.contentType).toContain('json');
    expect(auditService.log).toHaveBeenCalledWith(expect.anything(), {}, expect.objectContaining({ action: 'v3.export.completed' }));
  });

  it('creates zip buffer', () => {
    const zip = exportImportService.createZipBuffer({ 'a.txt': 'hello' });
    expect(zip.slice(0, 2).toString()).toBe('PK');
  });
});
