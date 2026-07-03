/**
 * V3 Report Service — read-only report generation and export (CSV / Excel / PDF).
 */

const healthCheckService = require('./healthCheckService');
const deviceHealthService = require('./deviceHealthService');
const pbxHealthService = require('./pbxHealthService');
const softphoneHealthService = require('./softphoneHealthService');
const inventoryHealthService = require('./inventoryHealthService');
const repairService = require('./repairService');
const dashboardService = require('./dashboardService');
const auditService = require('./auditService');

const REPORT_TYPES = ['employees', 'extensions', 'numbers', 'devices', 'pbx', 'health', 'provisioning'];

function escapeCsv(value) {
  const str = value == null ? '' : String(value);
  if (/[",\n\r]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
}

function toCsv(columns, rows) {
  const header = columns.map((c) => escapeCsv(c.label)).join(',');
  const body = rows.map((row) => columns.map((c) => escapeCsv(row[c.key])).join(',')).join('\n');
  return `\uFEFF${header}\n${body}`;
}

function toExcelXml(title, columns, rows) {
  const headerCells = columns.map((c) => `<Cell><Data ss:Type="String">${escapeXml(c.label)}</Data></Cell>`).join('');
  const dataRows = rows.map((row) => {
    const cells = columns.map((c) => `<Cell><Data ss:Type="String">${escapeXml(row[c.key])}</Data></Cell>`).join('');
    return `<Row>${cells}</Row>`;
  }).join('');
  return `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
 <Worksheet ss:Name="${escapeXml(title)}">
  <Table>
   <Row>${headerCells}</Row>
   ${dataRows}
  </Table>
 </Worksheet>
</Workbook>`;
}

function escapeXml(str) {
  return String(str == null ? '' : str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function toPdf(title, columns, rows) {
  const lines = [
    title,
    `Generated: ${new Date().toISOString()}`,
    '',
    columns.map((c) => c.label).join(' | '),
    '-'.repeat(80),
    ...rows.slice(0, 200).map((row) => columns.map((c) => String(row[c.key] ?? '')).join(' | ')),
  ];
  const text = lines.join('\n');
  const objects = [];
  let offset = 0;
  function addObject(obj) {
    objects.push(`${offset} ${obj}`);
    offset += obj.split('\n').length;
  }
  addObject('<< /Type /Catalog /Pages 2 0 R >>');
  addObject('<< /Type /Pages /Kids [3 0 R] /Count 1 >>');
  addObject(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>`);
  const stream = `BT /F1 10 Tf 50 750 Td (${escapePdf(text)}) Tj ET`;
  addObject(`<< /Length ${stream.length} >> stream\n${stream}\nendstream`);
  addObject('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
  const body = `%PDF-1.4\n${objects.map((o, i) => `${i + 1} 0 obj\n${o}\nendobj`).join('\n')}\nxref\n0 ${objects.length + 1}\n0000000000 65535 f \n${objects.map((_, i) => `${String((i + 1) * 10).padStart(10, '0')} 00000 n `).join('\n')}\ntrailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${offset * 20}\n%%EOF`;
  return body;
}

function escapePdf(text) {
  return text.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)').replace(/\n/g, ') Tj T* (');
}

async function buildEmployeesReport(prisma, tenantId) {
  const { employees } = await healthCheckService.employeeHealth(prisma, tenantId);
  const columns = [
    { key: 'name', label: 'Name' },
    { key: 'email', label: 'Email' },
    { key: 'extensionNumber', label: 'Extension' },
    { key: 'did', label: 'DID' },
    { key: 'overall', label: 'Health' },
    { key: 'sipUsername', label: 'SIP Username' },
  ];
  const rows = employees.map((e) => ({
    name: e.name,
    email: e.email,
    extensionNumber: e.extensionNumber || '',
    did: e.did || '',
    overall: e.overall,
    sipUsername: e.sipUsername || '',
  }));
  return { title: 'Employees Report', columns, rows };
}

async function buildExtensionsReport(prisma, tenantId) {
  const extensions = await prisma.extension.findMany({
    where: { tenantId },
    include: { user: { select: { name: true, email: true } }, primaryPhoneNumber: { select: { number: true } } },
    orderBy: { extensionNumber: 'asc' },
  });
  const columns = [
    { key: 'extensionNumber', label: 'Extension' },
    { key: 'displayName', label: 'Display Name' },
    { key: 'department', label: 'Department' },
    { key: 'status', label: 'Status' },
    { key: 'employee', label: 'Employee' },
    { key: 'did', label: 'Primary DID' },
  ];
  const rows = extensions.map((e) => ({
    extensionNumber: e.extensionNumber,
    displayName: e.displayName,
    department: e.department || '',
    status: e.status,
    employee: e.user?.name || '',
    did: e.primaryPhoneNumber?.number || '',
  }));
  return { title: 'Extensions Report', columns, rows };
}

async function buildNumbersReport(prisma, tenantId) {
  const { numbers } = await inventoryHealthService.listNumbersHealth(prisma, { tenantId, limit: 1000 });
  const columns = [
    { key: 'number', label: 'Number' },
    { key: 'inventoryStatus', label: 'Status' },
    { key: 'extensionNumber', label: 'Extension' },
    { key: 'employeeName', label: 'Employee' },
    { key: 'overall', label: 'Health' },
  ];
  const rows = numbers.map((n) => ({
    number: n.number,
    inventoryStatus: n.inventoryStatus,
    extensionNumber: n.extensionNumber || '',
    employeeName: n.employeeName || '',
    overall: n.overall,
  }));
  return { title: 'Numbers Report', columns, rows };
}

async function buildDevicesReport(prisma, tenantId) {
  const { devices } = await deviceHealthService.listDevicesHealth(prisma, { tenantId });
  const columns = [
    { key: 'macAddress', label: 'MAC' },
    { key: 'vendor', label: 'Vendor' },
    { key: 'model', label: 'Model' },
    { key: 'extensionNumber', label: 'Extension' },
    { key: 'status', label: 'Status' },
    { key: 'overall', label: 'Health' },
  ];
  const rows = devices.map((d) => ({
    macAddress: d.macAddress || '',
    vendor: d.vendor || '',
    model: d.model || '',
    extensionNumber: d.extensionNumber || '',
    status: d.status,
    overall: d.overall,
  }));
  return { title: 'Devices Report', columns, rows };
}

async function buildPbxReport(prisma, tenantId) {
  const pbx = await pbxHealthService.pbxObjectsHealth(prisma, tenantId);
  const all = [
    ...pbx.ringGroups.map((i) => ({ type: 'Ring Group', name: i.name, overall: i.overall })),
    ...pbx.queues.map((i) => ({ type: 'Queue', name: i.name, overall: i.overall })),
    ...pbx.businessHours.map((i) => ({ type: 'Business Hours', name: i.name, overall: i.overall })),
    ...pbx.holidays.map((i) => ({ type: 'Holiday', name: i.name, overall: i.overall })),
    ...pbx.voicemails.map((i) => ({ type: 'Voicemail', name: i.name, overall: i.overall })),
  ];
  const columns = [
    { key: 'type', label: 'Type' },
    { key: 'name', label: 'Name' },
    { key: 'overall', label: 'Health' },
  ];
  return { title: 'PBX Objects Report', columns, rows: all };
}

async function buildHealthReport(prisma, tenantId) {
  const [employeeSummary, deviceHealth, pbx, softphone, numberHealth, cards] = await Promise.all([
    healthCheckService.tenantHealthSummary(prisma, tenantId),
    deviceHealthService.listDevicesHealth(prisma, { tenantId }),
    pbxHealthService.pbxObjectsHealth(prisma, tenantId),
    softphoneHealthService.softphoneUxHealth(prisma, tenantId),
    inventoryHealthService.listNumbersHealth(prisma, { tenantId, limit: 500 }),
    dashboardService.getHealthIssues(prisma, tenantId),
  ]);
  const columns = [
    { key: 'domain', label: 'Domain' },
    { key: 'total', label: 'Total' },
    { key: 'ready', label: 'Ready' },
    { key: 'warnings', label: 'Warnings' },
    { key: 'errors', label: 'Errors' },
  ];
  const rows = [
    { domain: 'Employees', ...pickSummary(employeeSummary) },
    { domain: 'Devices', ...pickSummary(deviceHealth.summary) },
    { domain: 'Numbers', ...pickSummary(numberHealth.summary) },
    { domain: 'PBX', ...pickSummary(pbx.summary) },
    { domain: 'Softphone UX', ...pickSummary(softphone.summary) },
    { domain: 'All Issues', total: cards.total, ready: 0, warnings: cards.total, errors: 0 },
  ];
  return { title: 'Health Report', columns, rows };
}

function pickSummary(summary) {
  return {
    total: summary.total ?? summary.totalEmployees ?? 0,
    ready: summary.ready ?? 0,
    warnings: summary.warnings ?? 0,
    errors: summary.errors ?? 0,
  };
}

async function buildProvisioningReport(prisma, tenantId) {
  const inspect = await repairService.inspect(prisma, tenantId);
  const columns = [
    { key: 'type', label: 'Type' },
    { key: 'entity', label: 'Entity' },
    { key: 'ref', label: 'Reference' },
    { key: 'detail', label: 'Detail' },
  ];
  const rows = inspect.changes.map((c) => ({
    type: c.type,
    entity: c.entity,
    ref: c.ref,
    detail: c.detail,
  }));
  return { title: 'Provisioning Report', columns, rows };
}

async function generateReport(prisma, tenantId, type) {
  const normalized = String(type || '').toLowerCase();
  if (!REPORT_TYPES.includes(normalized)) {
    throw Object.assign(new Error(`Invalid report type: ${type}`), { status: 400, code: 'INVALID_REPORT_TYPE' });
  }
  const builders = {
    employees: buildEmployeesReport,
    extensions: buildExtensionsReport,
    numbers: buildNumbersReport,
    devices: buildDevicesReport,
    pbx: buildPbxReport,
    health: buildHealthReport,
    provisioning: buildProvisioningReport,
  };
  return builders[normalized](prisma, tenantId);
}

async function listReports(prisma, tenantId) {
  const summaries = await Promise.all(
    REPORT_TYPES.map(async (type) => {
      const report = await generateReport(prisma, tenantId, type);
      return { type, title: report.title, rowCount: report.rows.length };
    }),
  );
  return { reports: summaries, types: REPORT_TYPES };
}

function exportReport(report, format = 'csv') {
  const fmt = String(format || 'csv').toLowerCase();
  if (fmt === 'csv') {
    return {
      contentType: 'text/csv; charset=utf-8',
      filename: `${report.title.replace(/\s+/g, '_').toLowerCase()}.csv`,
      body: toCsv(report.columns, report.rows),
      encoding: 'utf8',
    };
  }
  if (fmt === 'excel' || fmt === 'xlsx' || fmt === 'xls') {
    return {
      contentType: 'application/vnd.ms-excel',
      filename: `${report.title.replace(/\s+/g, '_').toLowerCase()}.xls`,
      body: toExcelXml(report.title, report.columns, report.rows),
      encoding: 'utf8',
    };
  }
  if (fmt === 'pdf') {
    return {
      contentType: 'application/pdf',
      filename: `${report.title.replace(/\s+/g, '_').toLowerCase()}.pdf`,
      body: toPdf(report.title, report.columns, report.rows),
      encoding: 'binary',
    };
  }
  throw Object.assign(new Error(`Unsupported export format: ${format}`), { status: 400, code: 'INVALID_FORMAT' });
}

async function exportReportForTenant(prisma, tenantId, type, format, { req } = {}) {
  const report = await generateReport(prisma, tenantId, type);
  const exported = exportReport(report, format);
  await auditService.log(prisma, req, {
    action: 'v3.report.exported',
    entityType: 'V3Report',
    entityId: type,
    newValue: { type, format, rowCount: report.rows.length, title: report.title },
  });
  return { report, ...exported };
}

module.exports = {
  REPORT_TYPES,
  generateReport,
  listReports,
  exportReport,
  exportReportForTenant,
  toCsv,
  toExcelXml,
  toPdf,
};
