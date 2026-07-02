/**
 * V3 Export/Import Service — JSON, CSV summary, ZIP package (configuration only).
 */

const { randomUUID } = require('crypto');
const auditService = require('./auditService');
const backupService = require('./backupService');
const restoreService = require('./restoreService');

function escapeCsv(value) {
  const str = value == null ? '' : String(value);
  if (/[",\n\r]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
}

function payloadToCsvSummary(payload) {
  const counts = backupService.countItems(payload);
  const rows = Object.entries(counts).map(([key, value]) => ({ section: key, count: value }));
  const header = 'section,count';
  const body = rows.map((r) => `${escapeCsv(r.section)},${escapeCsv(r.count)}`).join('\n');
  return `\uFEFF${header}\n${body}`;
}

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i += 1) {
    crc ^= buf[i];
    for (let j = 0; j < 8; j += 1) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function createZipBuffer(files) {
  const parts = [];
  let offset = 0;
  const central = [];

  for (const [name, content] of Object.entries(files)) {
    const data = Buffer.from(content, 'utf8');
    const nameBuf = Buffer.from(name, 'utf8');
    const crc = crc32(data);
    const localHeader = Buffer.alloc(30 + nameBuf.length);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(0, 6);
    localHeader.writeUInt16LE(0, 8);
    localHeader.writeUInt16LE(0, 10);
    localHeader.writeUInt16LE(0, 12);
    localHeader.writeUInt32LE(crc, 14);
    localHeader.writeUInt32LE(data.length, 18);
    localHeader.writeUInt32LE(data.length, 22);
    localHeader.writeUInt16LE(nameBuf.length, 26);
    localHeader.writeUInt16LE(0, 28);
    nameBuf.copy(localHeader, 30);

    central.push({ nameBuf, crc, size: data.length, offset });
    parts.push(localHeader, data);
    offset += localHeader.length + data.length;
  }

  const centralStart = offset;
  for (const entry of central) {
    const header = Buffer.alloc(46 + entry.nameBuf.length);
    header.writeUInt32LE(0x02014b50, 0);
    header.writeUInt16LE(20, 4);
    header.writeUInt16LE(20, 6);
    header.writeUInt16LE(0, 8);
    header.writeUInt16LE(0, 10);
    header.writeUInt16LE(0, 12);
    header.writeUInt16LE(0, 14);
    header.writeUInt32LE(entry.crc, 16);
    header.writeUInt32LE(entry.size, 20);
    header.writeUInt32LE(entry.size, 24);
    header.writeUInt16LE(entry.nameBuf.length, 28);
    header.writeUInt16LE(0, 30);
    header.writeUInt16LE(0, 32);
    header.writeUInt16LE(0, 34);
    header.writeUInt16LE(0, 36);
    header.writeUInt32LE(0, 38);
    header.writeUInt32LE(entry.offset, 42);
    entry.nameBuf.copy(header, 46);
    parts.push(header);
    offset += header.length;
  }

  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(central.length, 8);
  end.writeUInt16LE(central.length, 10);
  end.writeUInt32LE(offset - centralStart, 12);
  end.writeUInt32LE(centralStart, 16);
  end.writeUInt16LE(0, 20);
  parts.push(end);

  return Buffer.concat(parts);
}

async function exportConfiguration(prisma, tenantId, format = 'json', { req } = {}) {
  const payload = await backupService.collectConfiguration(prisma, tenantId);
  const counts = backupService.countItems(payload);

  let body;
  let contentType;
  let filename;
  let encoding = 'utf8';

  const fmt = String(format || 'json').toLowerCase();
  if (fmt === 'csv') {
    body = payloadToCsvSummary(payload);
    contentType = 'text/csv; charset=utf-8';
    filename = `tenant-export-${tenantId.slice(0, 8)}.csv`;
  } else if (fmt === 'zip') {
    body = createZipBuffer({
      'backup.json': JSON.stringify(payload, null, 2),
      'manifest.json': JSON.stringify({ version: payload.version, itemCounts: counts, exportedAt: payload.exportedAt }, null, 2),
      'summary.csv': payloadToCsvSummary(payload),
    });
    contentType = 'application/zip';
    filename = `tenant-export-${tenantId.slice(0, 8)}.zip`;
    encoding = 'binary';
  } else {
    body = JSON.stringify(payload, null, 2);
    contentType = 'application/json; charset=utf-8';
    filename = `tenant-export-${tenantId.slice(0, 8)}.json`;
  }

  await auditService.log(prisma, req, {
    action: 'v3.export.completed',
    entityType: 'Tenant',
    entityId: tenantId,
    newValue: { format: fmt, itemCounts: counts },
  });

  return { body, contentType, filename, encoding, itemCounts: counts };
}

function validateImportPayload(payload) {
  const issues = [];
  if (!payload || typeof payload !== 'object') {
    issues.push({ severity: 'error', code: 'INVALID_PAYLOAD', message: 'Import payload must be an object' });
    return { valid: false, issues };
  }
  if (payload.version !== backupService.BACKUP_VERSION) {
    issues.push({ severity: 'error', code: 'UNSUPPORTED_VERSION', message: `Unsupported backup version: ${payload.version}` });
  }
  if (!payload.tenantId && !payload.settings) {
    issues.push({ severity: 'warning', code: 'MISSING_SETTINGS', message: 'No tenant settings block found' });
  }
  const errors = issues.filter((i) => i.severity === 'error');
  return { valid: errors.length === 0, issues, errors, warnings: issues.filter((i) => i.severity === 'warning') };
}

async function validateImport(prisma, tenantId, payload) {
  const validation = validateImportPayload(payload);
  if (!validation.valid) return { ...validation, preview: null };

  const preview = await restoreService.restorePreview(prisma, tenantId, { payload });
  return { ...validation, preview };
}

async function importConfiguration(prisma, tenantId, { payload, dryRun = true, apply = false } = {}, { req } = {}) {
  const validation = await validateImport(prisma, tenantId, payload);
  if (!validation.valid) {
    throw Object.assign(new Error(validation.errors[0]?.message || 'Import validation failed'), { status: 400, details: validation });
  }

  const result = await restoreService.applyRestore(
    prisma,
    tenantId,
    { payload },
    { req, dryRun: dryRun || !apply },
  );

  if (apply && !dryRun) {
    await auditService.log(prisma, req, {
      action: 'v3.import.applied',
      entityType: 'Tenant',
      entityId: tenantId,
      newValue: { applied: result.applied?.length || 0, summary: result.summary },
    });
  } else {
    await auditService.log(prisma, req, {
      action: 'v3.import.validated',
      entityType: 'Tenant',
      entityId: tenantId,
      newValue: { dryRun: true, summary: result.summary },
    });
  }

  return { validation, result };
}

module.exports = {
  exportConfiguration,
  validateImport,
  importConfiguration,
  validateImportPayload,
  payloadToCsvSummary,
  createZipBuffer,
};
