/**
 * Tenant Portal V3 API — mounted at /api/v3, gated by V3_PORTAL_ENABLED.
 *
 * Additive surface only. Reuses existing auth (lib/auth.js) and tenant guards.
 * When the flag is off, `requireV3Enabled` makes every route 404. No existing
 * route, telephony path, or Call Control logic is touched.
 */

const express = require('express');
const { getPrisma } = require('../db');
const { authMiddleware, requireRole } = require('../lib/auth');
const { requireV3Enabled } = require('../lib/v3/featureFlag');
const employeeService = require('../lib/v3/employeeService');
const healthCheckService = require('../lib/v3/healthCheckService');
const repairService = require('../lib/v3/repairService');
const provisioningService = require('../lib/v3/provisioningService');
const auditService = require('../lib/v3/auditService');

const router = express.Router();

router.use(authMiddleware, requireV3Enabled);

function requireTenant(req, res) {
  if (!req.user.tenantId) {
    res.status(403).json({ error: 'No organization linked to this account' });
    return false;
  }
  return true;
}

function sendError(res, error, fallback) {
  res.status(error.status || 500).json({ error: error.message || fallback, code: error.code });
}

const adminOnly = requireRole('SUPER_ADMIN', 'TENANT_ADMIN');

router.post('/employees', adminOnly, async (req, res) => {
  try {
    if (!requireTenant(req, res)) return;
    const prisma = await getPrisma();
    const result = await employeeService.createEmployee(prisma, req.user.tenantId, req.body || {}, {
      req,
      actor: req.user,
    });
    res.status(201).json({ success: true, ...result });
  } catch (error) {
    sendError(res, error, 'Failed to create employee');
  }
});

router.get('/health', adminOnly, async (req, res) => {
  try {
    if (!requireTenant(req, res)) return;
    const prisma = await getPrisma();
    const [health, summary] = await Promise.all([
      healthCheckService.employeeHealth(prisma, req.user.tenantId),
      healthCheckService.tenantHealthSummary(prisma, req.user.tenantId),
    ]);
    res.json({ success: true, summary, employees: health.employees, readiness: health.readiness });
  } catch (error) {
    sendError(res, error, 'Failed to load health');
  }
});

router.get('/health/:employeeId', adminOnly, async (req, res) => {
  try {
    if (!requireTenant(req, res)) return;
    const prisma = await getPrisma();
    const health = await healthCheckService.employeeHealth(prisma, req.user.tenantId, req.params.employeeId);
    res.json({ success: true, employee: health.employees?.[0] || null, readiness: health.readiness });
  } catch (error) {
    sendError(res, error, 'Failed to load health');
  }
});

router.post('/repair/inspect', adminOnly, async (req, res) => {
  try {
    if (!requireTenant(req, res)) return;
    const prisma = await getPrisma();
    const report = await repairService.inspect(prisma, req.user.tenantId);
    res.json({ success: true, ...report });
  } catch (error) {
    sendError(res, error, 'Inspection failed');
  }
});

router.post('/repair/apply', adminOnly, async (req, res) => {
  try {
    if (!requireTenant(req, res)) return;
    const prisma = await getPrisma();
    const report = await repairService.repair(prisma, req.user.tenantId, { apply: true });
    await auditService.log(prisma, req, {
      action: 'v3.pbx.repair',
      entityType: 'Tenant',
      entityId: req.user.tenantId,
      newValue: { applied: report.applied, scanned: report.scanned },
    });
    res.json({ success: true, ...report });
  } catch (error) {
    sendError(res, error, 'Repair failed');
  }
});

router.post('/employees/:id/provision-device', adminOnly, async (req, res) => {
  try {
    if (!requireTenant(req, res)) return;
    const prisma = await getPrisma();
    const target = String(req.body?.target || 'sip_phone');
    const result = await provisioningService.provisionDeviceForEmployee(
      prisma,
      req.user.tenantId,
      req.params.id,
      { target },
      { userId: req.user.sub, userEmail: req.user.email },
    );
    await auditService.log(prisma, req, {
      action: 'v3.employee.provision_device',
      entityType: 'User',
      entityId: req.params.id,
      newValue: { extensionId: result.extensionId, target, provisioned: result.provision?.provisioned },
    });
    res.json({ success: true, ...result });
  } catch (error) {
    sendError(res, error, 'Provisioning failed');
  }
});

module.exports = router;
