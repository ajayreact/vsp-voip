/**
 * Tenant Portal V3 API — mounted at /api/v3, gated by V3_PORTAL_ENABLED.
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
const numberInventoryService = require('../lib/v3/numberInventoryService');
const marketplaceService = require('../lib/v3/marketplaceService');
const assignmentService = require('../lib/v3/assignmentService');
const inventoryHealthService = require('../lib/v3/inventoryHealthService');
const telnyxService = require('../lib/v3/telnyxService');
const deviceService = require('../lib/v3/deviceService');
const deviceProvisioningService = require('../lib/v3/deviceProvisioningService');
const deviceHealthService = require('../lib/v3/deviceHealthService');
const deviceRepairService = require('../lib/v3/deviceRepairService');
const deviceTemplateService = require('../lib/v3/deviceTemplateService');

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
const superAdminOnly = requireRole('SUPER_ADMIN');

// --- Phase 1: Employees & PBX health ---

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

// --- Phase 2: Number Inventory & Marketplace ---

router.get('/numbers', adminOnly, async (req, res) => {
  try {
    const prisma = await getPrisma();
    const readiness = await telnyxService.getTenantTelephonyReadiness(prisma);
    const isSuperAdmin = req.user.role === 'SUPER_ADMIN';
    const search = req.query.search ? String(req.query.search) : undefined;
    const status = req.query.status ? String(req.query.status) : undefined;
    const limit = req.query.limit ? Number(req.query.limit) : 100;
    const offset = req.query.offset ? Number(req.query.offset) : 0;

    if (isSuperAdmin && !req.query.tenantScoped) {
      const inventory = await numberInventoryService.listInventory(prisma, {
        search, status, limit, offset, readiness,
      });
      return res.json({ success: true, scope: 'global', ...inventory });
    }

    if (!requireTenant(req, res)) return;
    const inventory = await numberInventoryService.listInventory(prisma, {
      tenantId: req.user.tenantId,
      search,
      status,
      limit,
      offset,
      readiness,
    });
    res.json({ success: true, scope: 'tenant', ...inventory });
  } catch (error) {
    sendError(res, error, 'Failed to load numbers');
  }
});

router.post('/numbers/search', superAdminOnly, async (req, res) => {
  try {
    const result = await marketplaceService.searchMarketplace(req.body || {});
    res.json({ success: true, ...result });
  } catch (error) {
    sendError(res, error, 'Number search failed');
  }
});

router.post('/numbers/purchase', superAdminOnly, async (req, res) => {
  try {
    const prisma = await getPrisma();
    const body = req.body || {};
    if (body.reserveOnly) {
      const reserved = await marketplaceService.reserveMarketplaceNumber(prisma, body, req.user);
      await auditService.log(prisma, req, {
        action: 'v3.number.reserved',
        entityType: 'PhoneNumber',
        entityId: reserved.id,
        newValue: { number: reserved.number, status: reserved.inventoryStatus },
      });
      return res.status(201).json({ success: true, reserved });
    }

    const purchased = await marketplaceService.purchaseMarketplaceNumber(prisma, body, req.user);
    await auditService.log(prisma, req, {
      action: 'v3.number.purchased',
      entityType: 'PhoneNumber',
      entityId: purchased.id,
      newValue: { number: purchased.number, status: purchased.inventoryStatus },
    });
    res.status(201).json({ success: true, number: purchased });
  } catch (error) {
    sendError(res, error, 'Purchase failed');
  }
});

router.post('/numbers/assign', adminOnly, async (req, res) => {
  try {
    const prisma = await getPrisma();
    const body = req.body || {};
    const phoneNumberId = String(body.phoneNumberId || '');
    if (!phoneNumberId) {
      return res.status(400).json({ error: 'phoneNumberId is required' });
    }

    if (body.tenantId && req.user.role === 'SUPER_ADMIN') {
      const saved = await assignmentService.assignNumberToTenant(prisma, {
        phoneNumberId,
        tenantId: String(body.tenantId),
        assignedByUserId: req.user.sub,
        notes: body.notes,
      }, req);
      return res.json({ success: true, assignment: 'tenant', number: saved });
    }

    if (!requireTenant(req, res)) return;
    const result = await assignmentService.assignNumberToExtension(
      prisma,
      req.user.tenantId,
      {
        phoneNumberId,
        extensionId: body.extensionId,
        employeeId: body.employeeId,
      },
      { req, actor: req.user },
    );
    res.json({ success: true, assignment: 'extension', ...result });
  } catch (error) {
    sendError(res, error, 'Assignment failed');
  }
});

router.post('/numbers/unassign', adminOnly, async (req, res) => {
  try {
    const prisma = await getPrisma();
    const phoneNumberId = String(req.body?.phoneNumberId || '');
    if (!phoneNumberId) {
      return res.status(400).json({ error: 'phoneNumberId is required' });
    }

    if (req.body?.fromTenant && req.user.role === 'SUPER_ADMIN') {
      const updated = await assignmentService.unassignNumberFromTenant(
        prisma, phoneNumberId, req.user, req,
      );
      return res.json({ success: true, unassign: 'tenant', number: updated });
    }

    if (!requireTenant(req, res)) return;
    const result = await assignmentService.unassignNumberFromExtension(
      prisma,
      req.user.tenantId,
      phoneNumberId,
      { req, actor: req.user },
    );
    res.json({ success: true, unassign: 'extension', ...result });
  } catch (error) {
    sendError(res, error, 'Unassign failed');
  }
});

router.post('/numbers/release', superAdminOnly, async (req, res) => {
  try {
    const prisma = await getPrisma();
    const phoneNumberId = String(req.body?.phoneNumberId || '');
    if (!phoneNumberId) {
      return res.status(400).json({ error: 'phoneNumberId is required' });
    }
    const result = await marketplaceService.releaseMarketplaceNumber(
      prisma, phoneNumberId, req.user, { notes: req.body?.notes },
    );
    await auditService.log(prisma, req, {
      action: 'v3.number.released',
      entityType: 'PhoneNumber',
      entityId: phoneNumberId,
      newValue: { number: result.suspended?.number, status: result.suspended?.inventoryStatus },
    });
    res.json({ success: true, ...result });
  } catch (error) {
    sendError(res, error, 'Release failed');
  }
});

router.post('/numbers/repair', adminOnly, async (req, res) => {
  try {
    const prisma = await getPrisma();
    const apply = Boolean(req.body?.apply);
    const tenantId = req.user.role === 'SUPER_ADMIN' && req.body?.global
      ? null
      : req.user.tenantId;

    if (tenantId === undefined && req.user.role !== 'SUPER_ADMIN') {
      if (!requireTenant(req, res)) return;
    }
    if (req.user.role !== 'SUPER_ADMIN' && !req.user.tenantId) {
      return res.status(403).json({ error: 'No organization linked to this account' });
    }

    const scopedTenantId = req.user.role === 'SUPER_ADMIN' && req.body?.global
      ? null
      : req.user.tenantId;

    const report = await repairService.repairNumbers(prisma, scopedTenantId, { apply });
    if (apply) {
      await auditService.log(prisma, req, {
        action: 'v3.number.repair',
        entityType: scopedTenantId ? 'Tenant' : 'Platform',
        entityId: scopedTenantId || 'platform',
        newValue: { applied: report.applied, scanned: report.scanned },
      });
    }
    res.json({ success: true, ...report });
  } catch (error) {
    sendError(res, error, 'Number repair failed');
  }
});

router.get('/numbers/health', adminOnly, async (req, res) => {
  try {
    const prisma = await getPrisma();
    const tenantId = req.user.role === 'SUPER_ADMIN' && req.query.global === 'true'
      ? null
      : req.user.tenantId;

    if (!tenantId && req.user.role !== 'SUPER_ADMIN') {
      if (!requireTenant(req, res)) return;
    }

    const scopedTenantId = req.user.role === 'SUPER_ADMIN' && req.query.global === 'true'
      ? null
      : req.user.tenantId;

    const result = await inventoryHealthService.listNumbersHealth(prisma, {
      tenantId: scopedTenantId || undefined,
      limit: req.query.limit ? Number(req.query.limit) : 100,
    });
    res.json({ success: true, ...result });
  } catch (error) {
    sendError(res, error, 'Failed to load number health');
  }
});

// --- Phase 3: Desk Phone Management ---

router.get('/devices/health', adminOnly, async (req, res) => {
  try {
    if (!requireTenant(req, res)) return;
    const prisma = await getPrisma();
    const result = await deviceHealthService.listDevicesHealth(prisma, {
      tenantId: req.user.tenantId,
      limit: req.query.limit ? Number(req.query.limit) : 100,
    });
    res.json({ success: true, ...result });
  } catch (error) {
    sendError(res, error, 'Failed to load device health');
  }
});

router.post('/devices/provision', adminOnly, async (req, res) => {
  try {
    if (!requireTenant(req, res)) return;
    const prisma = await getPrisma();
    const deviceId = String(req.body?.deviceId || '');
    if (!deviceId) {
      return res.status(400).json({ error: 'deviceId is required' });
    }
    const result = await deviceProvisioningService.provisionDevice(
      prisma,
      req.user.tenantId,
      deviceId,
      { regenerate: Boolean(req.body?.regenerate) },
      { req, actor: req.user },
    );
    res.json({ success: true, ...result });
  } catch (error) {
    sendError(res, error, 'Device provisioning failed');
  }
});

router.post('/devices/repair', adminOnly, async (req, res) => {
  try {
    if (!requireTenant(req, res)) return;
    const prisma = await getPrisma();
    const apply = Boolean(req.body?.apply);
    const regenerate = Boolean(req.body?.regenerate);
    const report = await deviceRepairService.repairDevices(
      prisma,
      req.user.tenantId,
      { apply, regenerate },
    );
    if (apply) {
      await auditService.log(prisma, req, {
        action: 'v3.device.repair',
        entityType: 'Tenant',
        entityId: req.user.tenantId,
        newValue: { applied: report.applied, scanned: report.scanned, regenerate },
      });
    }
    res.json({ success: true, ...report });
  } catch (error) {
    sendError(res, error, 'Device repair failed');
  }
});

router.get('/devices/vendors', adminOnly, async (req, res) => {
  res.json({ success: true, vendors: deviceTemplateService.listVendors() });
});

router.get('/devices', adminOnly, async (req, res) => {
  try {
    if (!requireTenant(req, res)) return;
    const prisma = await getPrisma();
    const result = await deviceService.listDevices(prisma, req.user.tenantId, {
      search: req.query.search ? String(req.query.search) : undefined,
      status: req.query.status ? String(req.query.status) : undefined,
      limit: req.query.limit ? Number(req.query.limit) : 100,
      offset: req.query.offset ? Number(req.query.offset) : 0,
    });
    res.json({ success: true, ...result });
  } catch (error) {
    sendError(res, error, 'Failed to load devices');
  }
});

router.post('/devices', adminOnly, async (req, res) => {
  try {
    if (!requireTenant(req, res)) return;
    const prisma = await getPrisma();
    const device = await deviceService.createDevice(
      prisma,
      req.user.tenantId,
      req.body || {},
      { req, actor: req.user },
    );
    res.status(201).json({ success: true, device });
  } catch (error) {
    sendError(res, error, 'Failed to create device');
  }
});

router.get('/devices/:id/config', adminOnly, async (req, res) => {
  try {
    if (!requireTenant(req, res)) return;
    const prisma = await getPrisma();
    const generated = await deviceProvisioningService.generateDeviceConfig(
      prisma,
      req.user.tenantId,
      req.params.id,
      { regenerate: req.query.regenerate === 'true' },
    );
    res.setHeader('Content-Type', generated.config.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${generated.device.vendor}-provision.${generated.config.format.includes('json') ? 'json' : 'cfg'}"`);
    res.send(generated.config.body);
  } catch (error) {
    sendError(res, error, 'Failed to generate device config');
  }
});

router.put('/devices/:id', adminOnly, async (req, res) => {
  try {
    if (!requireTenant(req, res)) return;
    const prisma = await getPrisma();
    const device = await deviceService.updateDevice(
      prisma,
      req.user.tenantId,
      req.params.id,
      req.body || {},
      { req, actor: req.user },
    );
    res.json({ success: true, device });
  } catch (error) {
    sendError(res, error, 'Failed to update device');
  }
});

router.delete('/devices/:id', adminOnly, async (req, res) => {
  try {
    if (!requireTenant(req, res)) return;
    const prisma = await getPrisma();
    const device = await deviceService.removeDevice(
      prisma,
      req.user.tenantId,
      req.params.id,
      { req, actor: req.user },
    );
    res.json({ success: true, device });
  } catch (error) {
    sendError(res, error, 'Failed to remove device');
  }
});

module.exports = router;
