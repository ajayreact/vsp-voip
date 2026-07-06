/**
 * Tenant Portal V3 API — mounted at /api/v3, gated by V3_PORTAL_ENABLED.
 */

const express = require('express');
const { getPrisma } = require('../db');
const { authMiddleware, requireRole } = require('../lib/auth');
const {
  searchLimiter,
  billingLimiter,
  v3RepairLimiter,
  v3HeavyMutationLimiter,
} = require('../lib/rateLimit');
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
const callFlowService = require('../lib/v3/callFlowService');
const callFlowNodeService = require('../lib/v3/callFlowNodeService');
const callFlowValidationService = require('../lib/v3/callFlowValidationService');
const callFlowSimulationService = require('../lib/v3/callFlowSimulationService');
const ringGroupService = require('../lib/v3/ringGroupService');
const queueService = require('../lib/v3/queueService');
const businessHoursService = require('../lib/v3/businessHoursService');
const holidayService = require('../lib/v3/holidayService');
const voicemailService = require('../lib/v3/voicemailService');
const pbxHealthService = require('../lib/v3/pbxHealthService');
const softphoneProfileService = require('../lib/v3/softphoneProfileService');
const userPreferenceService = require('../lib/v3/userPreferenceService');
const devicePreferenceService = require('../lib/v3/devicePreferenceService');
const contactDirectoryService = require('../lib/v3/contactDirectoryService');
const presenceService = require('../lib/v3/presenceService');
const softphoneHealthService = require('../lib/v3/softphoneHealthService');
const dashboardService = require('../lib/v3/dashboardService');
const analyticsService = require('../lib/v3/analyticsService');
const reportService = require('../lib/v3/reportService');
const systemHealthService = require('../lib/v3/systemHealthService');
const activityService = require('../lib/v3/activityService');
const notificationCenterService = require('../lib/v3/notificationCenterService');
const billingService = require('../lib/v3/billingService');
const subscriptionService = require('../lib/v3/subscriptionService');
const licenseService = require('../lib/v3/licenseService');
const backupService = require('../lib/v3/backupService');
const restoreService = require('../lib/v3/restoreService');
const tenantLifecycleService = require('../lib/v3/tenantLifecycleService');
const exportImportService = require('../lib/v3/exportImportService');
const runtimeSyncService = require('../lib/v3/runtime/runtimeSyncService');
const runtimeHealthService = require('../lib/v3/runtime/runtimeHealthService');
const { isV3RuntimeSyncEnabled } = require('../lib/v3/runtime/runtimeFeatureFlag');
const deploymentService = require('../lib/v3/deploymentService');
const migrationService = require('../lib/v3/migrationService');
const runtimeValidationService = require('../lib/v3/runtimeValidationService');
const rollbackService = require('../lib/v3/rollbackService');
const monitoringService = require('../lib/v3/monitoringService');
const metricsService = require('../lib/v3/metricsService');
const diagnosticsService = require('../lib/v3/diagnosticsService');
const productionHealthService = require('../lib/v3/productionHealthService');
const testLabService = require('../lib/v3/testLabService');
const migrationWizardService = require('../lib/v3/migrationWizardService');

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

function resolveTargetUserId(req) {
  const requested = req.query.userId || req.body?.userId;
  if (requested && (req.user.role === 'TENANT_ADMIN' || req.user.role === 'SUPER_ADMIN')) {
    return String(requested);
  }
  return req.user.sub;
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
    const [health, summary, pbx, softphone, systemHealth] = await Promise.all([
      healthCheckService.employeeHealth(prisma, req.user.tenantId),
      healthCheckService.tenantHealthSummary(prisma, req.user.tenantId),
      pbxHealthService.pbxObjectsHealth(prisma, req.user.tenantId),
      softphoneHealthService.softphoneUxHealth(prisma, req.user.tenantId),
      systemHealthService.getSystemHealth(prisma, req.user.tenantId),
    ]);
    res.json({
      success: true,
      summary,
      employees: health.employees,
      readiness: health.readiness,
      pbx,
      softphone,
      systemHealth,
    });
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

router.post('/repair/inspect', adminOnly, v3RepairLimiter, async (req, res) => {
  try {
    if (!requireTenant(req, res)) return;
    const prisma = await getPrisma();
    const report = await repairService.inspect(prisma, req.user.tenantId);
    res.json({ success: true, ...report });
  } catch (error) {
    sendError(res, error, 'Inspection failed');
  }
});

router.post('/repair/apply', adminOnly, v3RepairLimiter, async (req, res) => {
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

router.post('/numbers/search', superAdminOnly, searchLimiter, async (req, res) => {
  try {
    const result = await marketplaceService.searchMarketplace(req.body || {});
    res.json({ success: true, ...result });
  } catch (error) {
    sendError(res, error, 'Number search failed');
  }
});

router.post('/numbers/purchase', superAdminOnly, billingLimiter, async (req, res) => {
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

router.post('/numbers/repair', adminOnly, v3RepairLimiter, async (req, res) => {
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

router.post('/devices/repair', adminOnly, v3RepairLimiter, async (req, res) => {
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

router.delete('/devices/by-mac/:mac', adminOnly, async (req, res) => {
  try {
    if (!requireTenant(req, res)) return;
    const prisma = await getPrisma();
    const removed = await deviceService.removeDeviceByMac(
      prisma,
      req.user.tenantId,
      req.params.mac,
      { req, actor: req.user },
    );
    res.json({ success: true, removed });
  } catch (error) {
    sendError(res, error, 'Failed to remove device');
  }
});

router.delete('/devices/:id', adminOnly, async (req, res) => {
  try {
    if (!requireTenant(req, res)) return;
    const prisma = await getPrisma();
    const removed = await deviceService.removeDevice(
      prisma,
      req.user.tenantId,
      req.params.id,
      { req, actor: req.user },
    );
    res.json({ success: true, removed });
  } catch (error) {
    sendError(res, error, 'Failed to remove device');
  }
});

// --- Phase 5: PBX Objects (configuration only — no live routing) ---

router.get('/pbx/references', adminOnly, async (req, res) => {
  try {
    if (!requireTenant(req, res)) return;
    const prisma = await getPrisma();
    const tenantId = req.user.tenantId;
    const [ringGroups, queues, schedules, holidays, voicemails, extensions] = await Promise.all([
      ringGroupService.listRingGroups(prisma, tenantId),
      queueService.listQueues(prisma, tenantId),
      businessHoursService.listSchedules(prisma, tenantId),
      holidayService.listHolidays(prisma, tenantId),
      voicemailService.listVoicemailBoxes(prisma, tenantId),
      prisma.extension.findMany({
        where: { tenantId, status: 'ACTIVE' },
        select: { id: true, extensionNumber: true, displayName: true },
        orderBy: { extensionNumber: 'asc' },
      }),
    ]);
    res.json({
      success: true,
      extensions: extensions.map((e) => ({
        id: e.id,
        extensionNumber: e.extensionNumber,
        displayName: e.displayName,
        label: `${e.extensionNumber}${e.displayName ? ` — ${e.displayName}` : ''}`,
      })),
      ringGroups: ringGroups.items.map((r) => ({ id: r.id, name: r.name, extensionNumber: r.extensionNumber })),
      queues: queues.items.map((q) => ({ id: q.id, name: q.name, queueNumber: q.queueNumber })),
      businessHours: schedules.items.map((s) => ({ id: s.id, name: s.name, timezone: s.timezone })),
      holidays: holidays.items.map((h) => ({ id: h.id, name: h.name, date: h.date })),
      voicemails: voicemails.items.map((v) => ({ id: v.id, mailboxNumber: v.mailboxNumber })),
    });
  } catch (error) {
    sendError(res, error, 'Failed to load PBX references');
  }
});

function mountPbxCrud(basePath, service, entityKey, auditValidateAction) {
  router.get(basePath, adminOnly, async (req, res) => {
    try {
      if (!requireTenant(req, res)) return;
      const prisma = await getPrisma();
      const result = await service.list(prisma, req.user.tenantId, {
        search: req.query.search ? String(req.query.search) : undefined,
        limit: req.query.limit ? Number(req.query.limit) : 100,
        offset: req.query.offset ? Number(req.query.offset) : 0,
      });
      res.json({ success: true, ...result });
    } catch (error) {
      sendError(res, error, `Failed to load ${entityKey}`);
    }
  });

  router.post(`${basePath}/validate`, adminOnly, async (req, res) => {
    try {
      if (!requireTenant(req, res)) return;
      const prisma = await getPrisma();
      const report = await service.validate(prisma, req.user.tenantId, req.body || {}, {
        excludeId: req.body?.id,
      });
      await auditService.log(prisma, req, {
        action: auditValidateAction,
        entityType: entityKey,
        entityId: req.body?.id || null,
        newValue: { valid: report.valid, errors: report.errors.length },
      });
      res.json({ success: true, ...report });
    } catch (error) {
      sendError(res, error, 'Validation failed');
    }
  });

  router.post(basePath, adminOnly, async (req, res) => {
    try {
      if (!requireTenant(req, res)) return;
      const prisma = await getPrisma();
      const item = await service.create(prisma, req.user.tenantId, req.body || {}, { req, actor: req.user });
      res.status(201).json({ success: true, item });
    } catch (error) {
      sendError(res, error, `Failed to create ${entityKey}`);
    }
  });

  router.get(`${basePath}/:id`, adminOnly, async (req, res) => {
    try {
      if (!requireTenant(req, res)) return;
      const prisma = await getPrisma();
      const item = await service.get(prisma, req.user.tenantId, req.params.id);
      if (!item) return res.status(404).json({ error: `${entityKey} not found` });
      res.json({ success: true, item });
    } catch (error) {
      sendError(res, error, `Failed to load ${entityKey}`);
    }
  });

  router.put(`${basePath}/:id`, adminOnly, async (req, res) => {
    try {
      if (!requireTenant(req, res)) return;
      const prisma = await getPrisma();
      const item = await service.update(prisma, req.user.tenantId, req.params.id, req.body || {}, { req, actor: req.user });
      res.json({ success: true, item });
    } catch (error) {
      sendError(res, error, `Failed to update ${entityKey}`);
    }
  });

  router.delete(`${basePath}/:id`, adminOnly, async (req, res) => {
    try {
      if (!requireTenant(req, res)) return;
      const prisma = await getPrisma();
      const item = await service.remove(prisma, req.user.tenantId, req.params.id, { req, actor: req.user });
      res.json({ success: true, item });
    } catch (error) {
      sendError(res, error, `Failed to delete ${entityKey}`);
    }
  });
}

mountPbxCrud('/ringgroups', {
  list: ringGroupService.listRingGroups,
  get: ringGroupService.getRingGroup,
  create: ringGroupService.createRingGroup,
  update: ringGroupService.updateRingGroup,
  remove: ringGroupService.removeRingGroup,
  validate: ringGroupService.validateRingGroup,
}, 'V3RingGroup', 'v3.ringgroup.validated');

mountPbxCrud('/queues', {
  list: queueService.listQueues,
  get: queueService.getQueue,
  create: queueService.createQueue,
  update: queueService.updateQueue,
  remove: queueService.removeQueue,
  validate: queueService.validateQueue,
}, 'V3Queue', 'v3.queue.validated');

mountPbxCrud('/business-hours', {
  list: businessHoursService.listSchedules,
  get: businessHoursService.getSchedule,
  create: businessHoursService.createSchedule,
  update: businessHoursService.updateSchedule,
  remove: businessHoursService.removeSchedule,
  validate: businessHoursService.validateBusinessHours,
}, 'V3BusinessHoursSchedule', 'v3.business_hours.validated');

mountPbxCrud('/holidays', {
  list: holidayService.listHolidays,
  get: holidayService.getHoliday,
  create: holidayService.createHoliday,
  update: holidayService.updateHoliday,
  remove: holidayService.removeHoliday,
  validate: holidayService.validateHoliday,
}, 'V3Holiday', 'v3.holiday.validated');

mountPbxCrud('/voicemails', {
  list: voicemailService.listVoicemailBoxes,
  get: voicemailService.getVoicemailBox,
  create: voicemailService.createVoicemailBox,
  update: voicemailService.updateVoicemailBox,
  remove: voicemailService.removeVoicemailBox,
  validate: voicemailService.validateVoicemailBox,
}, 'V3VoicemailBox', 'v3.voicemail.validated');

// --- Phase 4: Call Flow Builder (engine only — no live routing) ---

router.get('/callflows/node-types', adminOnly, async (req, res) => {
  res.json({ success: true, nodeTypes: callFlowNodeService.listNodeTypes() });
});

router.post('/callflows/validate', adminOnly, async (req, res) => {
  try {
    if (!requireTenant(req, res)) return;
    const prisma = await getPrisma();
    const body = req.body || {};
    let definition = body.definition;

    if (body.callFlowId) {
      const flow = await callFlowService.getCallFlow(prisma, req.user.tenantId, String(body.callFlowId));
      if (!flow) return res.status(404).json({ error: 'Call flow not found' });
      definition = flow.definition;
    }

    const report = await callFlowValidationService.validateFlow(prisma, req.user.tenantId, definition);
    await auditService.log(prisma, req, {
      action: 'v3.callflow.validated',
      entityType: 'V3CallFlow',
      entityId: body.callFlowId || null,
      newValue: { valid: report.valid, errors: report.errors.length, warnings: report.warnings.length },
    });
    res.json({ success: true, ...report });
  } catch (error) {
    sendError(res, error, 'Validation failed');
  }
});

router.post('/callflows/simulate', adminOnly, async (req, res) => {
  try {
    if (!requireTenant(req, res)) return;
    const prisma = await getPrisma();
    const body = req.body || {};
    let definition = body.definition;

    if (body.callFlowId) {
      const flow = await callFlowService.getCallFlow(prisma, req.user.tenantId, String(body.callFlowId));
      if (!flow) return res.status(404).json({ error: 'Call flow not found' });
      definition = flow.definition;
    }

    const result = await callFlowSimulationService.simulateFlow(
      prisma,
      req.user.tenantId,
      definition,
      body.input || {},
    );

    await auditService.log(prisma, req, {
      action: 'v3.callflow.simulated',
      entityType: 'V3CallFlow',
      entityId: body.callFlowId || null,
      newValue: {
        ok: result.ok,
        finalDestination: result.finalDestination,
        steps: result.executionPath.length,
      },
      extra: { input: body.input || {} },
    });

    res.json({ success: true, ...result });
  } catch (error) {
    sendError(res, error, 'Simulation failed');
  }
});

router.get('/callflows', adminOnly, async (req, res) => {
  try {
    if (!requireTenant(req, res)) return;
    const prisma = await getPrisma();
    const result = await callFlowService.listCallFlows(prisma, req.user.tenantId, {
      search: req.query.search ? String(req.query.search) : undefined,
      status: req.query.status ? String(req.query.status) : undefined,
      limit: req.query.limit ? Number(req.query.limit) : 50,
      offset: req.query.offset ? Number(req.query.offset) : 0,
    });
    res.json({ success: true, ...result });
  } catch (error) {
    sendError(res, error, 'Failed to load call flows');
  }
});

router.post('/callflows', adminOnly, async (req, res) => {
  try {
    if (!requireTenant(req, res)) return;
    const prisma = await getPrisma();
    const flow = await callFlowService.createCallFlow(
      prisma,
      req.user.tenantId,
      req.body || {},
      { req, actor: req.user },
    );
    res.status(201).json({ success: true, callFlow: flow });
  } catch (error) {
    sendError(res, error, 'Failed to create call flow');
  }
});

router.get('/callflows/:id', adminOnly, async (req, res) => {
  try {
    if (!requireTenant(req, res)) return;
    const prisma = await getPrisma();
    const flow = await callFlowService.getCallFlow(prisma, req.user.tenantId, req.params.id);
    if (!flow) return res.status(404).json({ error: 'Call flow not found' });
    res.json({ success: true, callFlow: flow });
  } catch (error) {
    sendError(res, error, 'Failed to load call flow');
  }
});

router.put('/callflows/:id', adminOnly, async (req, res) => {
  try {
    if (!requireTenant(req, res)) return;
    const prisma = await getPrisma();
    const flow = await callFlowService.updateCallFlow(
      prisma,
      req.user.tenantId,
      req.params.id,
      req.body || {},
      { req, actor: req.user },
    );
    res.json({ success: true, callFlow: flow });
  } catch (error) {
    sendError(res, error, 'Failed to update call flow');
  }
});

router.delete('/callflows/:id', adminOnly, async (req, res) => {
  try {
    if (!requireTenant(req, res)) return;
    const prisma = await getPrisma();
    const flow = await callFlowService.removeCallFlow(
      prisma,
      req.user.tenantId,
      req.params.id,
      { req, actor: req.user },
    );
    res.json({ success: true, callFlow: flow });
  } catch (error) {
    sendError(res, error, 'Failed to delete call flow');
  }
});

// --- Phase 6: Softphone UX (management only — no runtime telephony) ---

router.get('/profile', async (req, res) => {
  try {
    if (!requireTenant(req, res)) return;
    const prisma = await getPrisma();
    const userId = resolveTargetUserId(req);
    const profile = await softphoneProfileService.getOrCreateProfile(prisma, req.user.tenantId, userId);
    res.json({ success: true, profile });
  } catch (error) {
    sendError(res, error, 'Failed to load profile');
  }
});

router.put('/profile', async (req, res) => {
  try {
    if (!requireTenant(req, res)) return;
    const prisma = await getPrisma();
    const userId = resolveTargetUserId(req);
    const profile = await softphoneProfileService.updateProfile(
      prisma,
      req.user.tenantId,
      userId,
      req.body || {},
      { req },
    );
    res.json({ success: true, profile });
  } catch (error) {
    sendError(res, error, 'Failed to update profile');
  }
});

router.get('/directory', async (req, res) => {
  try {
    if (!requireTenant(req, res)) return;
    const prisma = await getPrisma();
    const result = await contactDirectoryService.searchDirectory(prisma, req.user.tenantId, {
      search: req.query.search ? String(req.query.search) : undefined,
      department: req.query.department ? String(req.query.department) : undefined,
      limit: req.query.limit ? Number(req.query.limit) : 50,
      offset: req.query.offset ? Number(req.query.offset) : 0,
      favoritesOnly: req.query.favorites === 'true',
      recentOnly: req.query.recent === 'true',
      userId: req.user.sub,
    });
    res.json({ success: true, ...result });
  } catch (error) {
    sendError(res, error, 'Failed to search directory');
  }
});

router.get('/presence', async (req, res) => {
  try {
    if (!requireTenant(req, res)) return;
    const prisma = await getPrisma();
    const userId = resolveTargetUserId(req);
    const presence = await presenceService.getPresence(prisma, req.user.tenantId, userId);
    res.json({ success: true, presence });
  } catch (error) {
    sendError(res, error, 'Failed to load presence');
  }
});

router.put('/presence', async (req, res) => {
  try {
    if (!requireTenant(req, res)) return;
    const prisma = await getPrisma();
    const userId = resolveTargetUserId(req);
    const presence = await presenceService.updatePresence(
      prisma,
      req.user.tenantId,
      userId,
      req.body || {},
      { req },
    );
    res.json({ success: true, presence });
  } catch (error) {
    sendError(res, error, 'Failed to update presence');
  }
});

router.get('/preferences', async (req, res) => {
  try {
    if (!requireTenant(req, res)) return;
    const prisma = await getPrisma();
    const userId = resolveTargetUserId(req);
    const [preferences, devices] = await Promise.all([
      userPreferenceService.getPreferences(prisma, req.user.tenantId, userId),
      devicePreferenceService.listDevicePreferences(prisma, req.user.tenantId, userId),
    ]);
    res.json({ success: true, preferences, devices });
  } catch (error) {
    sendError(res, error, 'Failed to load preferences');
  }
});

router.put('/preferences', async (req, res) => {
  try {
    if (!requireTenant(req, res)) return;
    const prisma = await getPrisma();
    const userId = resolveTargetUserId(req);
    const body = req.body || {};

    const preferences = body.preferences !== undefined
      ? await userPreferenceService.updatePreferences(prisma, req.user.tenantId, userId, body, { req })
      : await userPreferenceService.getPreferences(prisma, req.user.tenantId, userId);

    let devices = null;
    if (body.device) {
      const device = await devicePreferenceService.upsertDevicePreference(
        prisma,
        req.user.tenantId,
        userId,
        body.device,
        { req },
      );
      devices = { items: [device], total: 1 };
    } else if (Array.isArray(body.devices)) {
      const items = await Promise.all(
        body.devices.map((d) => devicePreferenceService.upsertDevicePreference(
          prisma,
          req.user.tenantId,
          userId,
          d,
          { req },
        )),
      );
      devices = { items, total: items.length };
    } else {
      devices = await devicePreferenceService.listDevicePreferences(prisma, req.user.tenantId, userId);
    }

    res.json({ success: true, preferences, devices });
  } catch (error) {
    sendError(res, error, 'Failed to update preferences');
  }
});

// --- Phase 7: Operations Center & Analytics (read-only) ---

router.get('/dashboard', adminOnly, async (req, res) => {
  try {
    if (!requireTenant(req, res)) return;
    const prisma = await getPrisma();
    const dashboard = await dashboardService.getDashboard(prisma, req.user.tenantId);
    res.json({ success: true, dashboard });
  } catch (error) {
    sendError(res, error, 'Failed to load dashboard');
  }
});

router.get('/dashboard/summary', adminOnly, async (req, res) => {
  try {
    if (!requireTenant(req, res)) return;
    const prisma = await getPrisma();
    const summary = await dashboardService.getDashboardSummary(prisma, req.user.tenantId);
    res.json({ success: true, summary });
  } catch (error) {
    sendError(res, error, 'Failed to load dashboard summary');
  }
});

router.get('/dashboard/charts', adminOnly, async (req, res) => {
  try {
    if (!requireTenant(req, res)) return;
    const prisma = await getPrisma();
    const charts = await dashboardService.getDashboardCharts(prisma, req.user.tenantId);
    res.json({ success: true, charts });
  } catch (error) {
    sendError(res, error, 'Failed to load dashboard charts');
  }
});

router.get('/analytics', adminOnly, async (req, res) => {
  try {
    if (!requireTenant(req, res)) return;
    const prisma = await getPrisma();
    const analytics = await analyticsService.getAnalytics(prisma, req.user.tenantId);
    res.json({ success: true, analytics });
  } catch (error) {
    sendError(res, error, 'Failed to load analytics');
  }
});

router.get('/reports', adminOnly, async (req, res) => {
  try {
    if (!requireTenant(req, res)) return;
    const prisma = await getPrisma();
    const type = req.query.type ? String(req.query.type) : null;
    if (type) {
      const report = await reportService.generateReport(prisma, req.user.tenantId, type);
      return res.json({ success: true, report });
    }
    const reports = await reportService.listReports(prisma, req.user.tenantId);
    res.json({ success: true, ...reports });
  } catch (error) {
    sendError(res, error, 'Failed to load reports');
  }
});

router.post('/reports/export', adminOnly, async (req, res) => {
  try {
    if (!requireTenant(req, res)) return;
    const prisma = await getPrisma();
    const body = req.body || {};
    const type = String(body.type || req.query.type || '');
    const format = String(body.format || req.query.format || 'csv');
    if (!type) return res.status(400).json({ error: 'Report type is required' });

    const exported = await reportService.exportReportForTenant(
      prisma,
      req.user.tenantId,
      type,
      format,
      { req },
    );

    res.setHeader('Content-Type', exported.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${exported.filename}"`);
    if (exported.encoding === 'binary') {
      return res.send(Buffer.from(exported.body, 'utf8'));
    }
    return res.send(exported.body);
  } catch (error) {
    sendError(res, error, 'Failed to export report');
  }
});

router.get('/activity', adminOnly, async (req, res) => {
  try {
    if (!requireTenant(req, res)) return;
    const prisma = await getPrisma();
    const timeline = await activityService.getActivityTimeline(prisma, req.user.tenantId, {
      limit: req.query.limit ? Number(req.query.limit) : 50,
      offset: req.query.offset ? Number(req.query.offset) : 0,
      category: req.query.category ? String(req.query.category) : undefined,
    });
    res.json({ success: true, ...timeline });
  } catch (error) {
    sendError(res, error, 'Failed to load activity');
  }
});

router.get('/notifications', adminOnly, async (req, res) => {
  try {
    if (!requireTenant(req, res)) return;
    const prisma = await getPrisma();
    const center = await notificationCenterService.getNotifications(prisma, req.user.tenantId);
    res.json({ success: true, ...center });
  } catch (error) {
    sendError(res, error, 'Failed to load notifications');
  }
});

router.get('/system-health', adminOnly, async (req, res) => {
  try {
    if (!requireTenant(req, res)) return;
    const prisma = await getPrisma();
    const systemHealth = await systemHealthService.getSystemHealth(prisma, req.user.tenantId);
    res.json({ success: true, systemHealth });
  } catch (error) {
    sendError(res, error, 'Failed to load system health');
  }
});

// --- Phase 8: Billing, Subscription, Lifecycle & Backup ---

router.get('/billing', adminOnly, async (req, res) => {
  try {
    if (!requireTenant(req, res)) return;
    const prisma = await getPrisma();
    const billing = await billingService.getBillingOverview(prisma, req.user.tenantId);
    res.json({ success: true, billing });
  } catch (error) {
    sendError(res, error, 'Failed to load billing');
  }
});

router.get('/subscription', adminOnly, async (req, res) => {
  try {
    if (!requireTenant(req, res)) return;
    const prisma = await getPrisma();
    const subscription = await subscriptionService.getSubscription(prisma, req.user.tenantId);
    res.json({ success: true, subscription });
  } catch (error) {
    sendError(res, error, 'Failed to load subscription');
  }
});

router.put('/subscription', superAdminOnly, async (req, res) => {
  try {
    if (!requireTenant(req, res)) return;
    const prisma = await getPrisma();
    const subscription = await subscriptionService.changePlan(
      prisma,
      req.user.tenantId,
      req.body || {},
      { req },
    );
    res.json({ success: true, subscription });
  } catch (error) {
    sendError(res, error, 'Failed to update subscription');
  }
});

router.get('/license', adminOnly, async (req, res) => {
  try {
    if (!requireTenant(req, res)) return;
    const prisma = await getPrisma();
    const license = await licenseService.getLicense(prisma, req.user.tenantId);
    res.json({ success: true, license });
  } catch (error) {
    sendError(res, error, 'Failed to load license');
  }
});

router.get('/backup', adminOnly, async (req, res) => {
  try {
    if (!requireTenant(req, res)) return;
    const prisma = await getPrisma();
    const backups = await backupService.listBackups(prisma, req.user.tenantId, {
      limit: req.query.limit ? Number(req.query.limit) : 20,
      offset: req.query.offset ? Number(req.query.offset) : 0,
    });
    res.json({ success: true, ...backups });
  } catch (error) {
    sendError(res, error, 'Failed to load backups');
  }
});

router.post('/backup/create', adminOnly, async (req, res) => {
  try {
    if (!requireTenant(req, res)) return;
    const prisma = await getPrisma();
    const backup = await backupService.createBackup(
      prisma,
      req.user.tenantId,
      req.body || {},
      { req, actor: req.user },
    );
    res.status(201).json({ success: true, backup });
  } catch (error) {
    sendError(res, error, 'Failed to create backup');
  }
});

router.post('/backup/restore-preview', adminOnly, async (req, res) => {
  try {
    if (!requireTenant(req, res)) return;
    const prisma = await getPrisma();
    const preview = await restoreService.restorePreview(prisma, req.user.tenantId, req.body || {});
    res.json({ success: true, preview });
  } catch (error) {
    sendError(res, error, 'Failed to preview restore');
  }
});

router.post('/backup/restore', adminOnly, async (req, res) => {
  try {
    if (!requireTenant(req, res)) return;
    const prisma = await getPrisma();
    const body = req.body || {};
    const result = await restoreService.applyRestore(
      prisma,
      req.user.tenantId,
      body,
      { req, dryRun: body.dryRun !== false && body.apply !== true },
    );
    res.json({ success: true, result });
  } catch (error) {
    sendError(res, error, 'Failed to restore backup');
  }
});

router.post('/backup/rollback-preview', adminOnly, async (req, res) => {
  try {
    if (!requireTenant(req, res)) return;
    const prisma = await getPrisma();
    const preview = await rollbackService.rollbackPreview(prisma, req.user.tenantId, req.body || {});
    res.json({ success: true, preview });
  } catch (error) {
    sendError(res, error, 'Failed to preview rollback');
  }
});

router.post('/backup/rollback', adminOnly, v3HeavyMutationLimiter, async (req, res) => {
  try {
    if (!requireTenant(req, res)) return;
    const prisma = await getPrisma();
    const body = req.body || {};
    const dryRun = body.dryRun !== false && body.apply !== true;
    const result = await rollbackService.rollbackExecute(prisma, req.user.tenantId, {
      ...body,
      dryRun,
      req,
    });
    res.json({ success: true, result });
  } catch (error) {
    sendError(res, error, 'Failed to execute rollback');
  }
});

router.post('/export', adminOnly, async (req, res) => {
  try {
    if (!requireTenant(req, res)) return;
    const prisma = await getPrisma();
    const format = req.body?.format || req.query.format || 'json';
    const exported = await exportImportService.exportConfiguration(
      prisma,
      req.user.tenantId,
      format,
      { req },
    );
    res.setHeader('Content-Type', exported.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${exported.filename}"`);
    if (exported.encoding === 'binary') {
      return res.send(exported.body);
    }
    return res.send(exported.body);
  } catch (error) {
    sendError(res, error, 'Failed to export configuration');
  }
});

router.post('/import', adminOnly, async (req, res) => {
  try {
    if (!requireTenant(req, res)) return;
    const prisma = await getPrisma();
    const body = req.body || {};
    const result = await exportImportService.importConfiguration(
      prisma,
      req.user.tenantId,
      {
        payload: body.payload || body,
        dryRun: body.dryRun !== false && body.apply !== true,
        apply: body.apply === true,
      },
      { req },
    );
    res.json({ success: true, ...result });
  } catch (error) {
    sendError(res, error, 'Failed to import configuration');
  }
});

router.get('/lifecycle', adminOnly, async (req, res) => {
  try {
    if (!requireTenant(req, res)) return;
    const prisma = await getPrisma();
    const lifecycle = await tenantLifecycleService.getLifecycle(prisma, req.user.tenantId);
    res.json({ success: true, lifecycle });
  } catch (error) {
    sendError(res, error, 'Failed to load lifecycle');
  }
});

router.post('/lifecycle', adminOnly, async (req, res) => {
  try {
    if (!requireTenant(req, res)) return;
    const prisma = await getPrisma();
    const action = String(req.body?.action || '').toLowerCase();
    const ctx = { req, actor: req.user };

    let result;
    switch (action) {
      case 'snapshot':
        result = await tenantLifecycleService.createSnapshot(prisma, req.user.tenantId, req.body || {}, ctx);
        break;
      case 'archive':
        result = await tenantLifecycleService.archiveTenant(prisma, req.user.tenantId, ctx);
        break;
      case 'deactivate':
        result = await tenantLifecycleService.deactivateTenant(prisma, req.user.tenantId, ctx);
        break;
      case 'reactivate':
        result = await tenantLifecycleService.reactivateTenant(prisma, req.user.tenantId, ctx);
        break;
      case 'clone-preview':
        result = await tenantLifecycleService.clonePreview(prisma, req.user.tenantId);
        break;
      default:
        return res.status(400).json({ error: 'Invalid lifecycle action', code: 'INVALID_ACTION' });
    }

    res.json({ success: true, result });
  } catch (error) {
    sendError(res, error, 'Lifecycle action failed');
  }
});

// --- Phase 9: Runtime Telephony Integration ---

router.get('/runtime/status', adminOnly, async (req, res) => {
  try {
    if (!requireTenant(req, res)) return;
    const prisma = await getPrisma();
    const status = await runtimeSyncService.getStatus(prisma, req.user.tenantId);
    res.json({
      success: true,
      status,
      featureFlag: {
        globalEnabled: isV3RuntimeSyncEnabled(),
        tenantEnabled: status.enabled,
      },
    });
  } catch (error) {
    sendError(res, error, 'Failed to load runtime status');
  }
});

router.get('/runtime/jobs', adminOnly, async (req, res) => {
  try {
    if (!requireTenant(req, res)) return;
    const prisma = await getPrisma();
    const jobs = await runtimeSyncService.listJobs(prisma, req.user.tenantId, {
      status: req.query.status ? String(req.query.status).toUpperCase() : undefined,
      limit: Number(req.query.limit) || 50,
      offset: Number(req.query.offset) || 0,
    });
    res.json({ success: true, ...jobs });
  } catch (error) {
    sendError(res, error, 'Failed to list runtime jobs');
  }
});

router.get('/runtime/health', adminOnly, async (req, res) => {
  try {
    if (!requireTenant(req, res)) return;
    const prisma = await getPrisma();
    const health = await runtimeHealthService.getRuntimeHealth(prisma, req.user.tenantId);
    res.json({ success: true, health });
  } catch (error) {
    sendError(res, error, 'Failed to load runtime health');
  }
});

router.post('/runtime/sync', adminOnly, v3HeavyMutationLimiter, async (req, res) => {
  try {
    if (!requireTenant(req, res)) return;
    const { entityType, entityId, action } = req.body || {};
    if (!entityType || !entityId) {
      return res.status(400).json({ error: 'entityType and entityId are required' });
    }
    const prisma = await getPrisma();
    const job = await runtimeSyncService.syncNow(prisma, req.user.tenantId, {
      entityType,
      entityId,
      action: action || 'sync',
      req,
    });
    res.json({ success: true, job });
  } catch (error) {
    sendError(res, error, 'Runtime sync failed');
  }
});

router.post('/runtime/resync', adminOnly, v3HeavyMutationLimiter, async (req, res) => {
  try {
    if (!requireTenant(req, res)) return;
    const prisma = await getPrisma();
    const result = await runtimeSyncService.resyncAll(prisma, req.user.tenantId, { req });
    res.json({ success: true, result });
  } catch (error) {
    sendError(res, error, 'Runtime resync failed');
  }
});

router.post('/runtime/repair', adminOnly, v3RepairLimiter, async (req, res) => {
  try {
    if (!requireTenant(req, res)) return;
    const prisma = await getPrisma();
    const result = await runtimeSyncService.repairRuntime(prisma, req.user.tenantId, {
      entityType: req.body?.entityType,
      entityId: req.body?.entityId,
      req,
    });
    res.json({ success: true, result });
  } catch (error) {
    sendError(res, error, 'Runtime repair failed');
  }
});

router.post('/runtime/jobs/:jobId/retry', adminOnly, async (req, res) => {
  try {
    if (!requireTenant(req, res)) return;
    const prisma = await getPrisma();
    const job = await runtimeSyncService.retryJob(prisma, req.user.tenantId, req.params.jobId, { req });
    res.json({ success: true, job });
  } catch (error) {
    sendError(res, error, 'Runtime job retry failed');
  }
});

// --- Phase 10: Production Readiness, Monitoring & Migration ---

router.get('/monitoring', adminOnly, async (req, res) => {
  try {
    if (!requireTenant(req, res)) return;
    const prisma = await getPrisma();
    const monitoring = await monitoringService.getMonitoringOverview(prisma, req.user.tenantId);
    res.json({ success: true, monitoring });
  } catch (error) {
    sendError(res, error, 'Failed to load monitoring');
  }
});

router.get('/metrics', adminOnly, async (req, res) => {
  try {
    if (!requireTenant(req, res)) return;
    const prisma = await getPrisma();
    const metrics = await metricsService.getMetrics(prisma, req.user.tenantId, {
      windowHours: Number(req.query.windowHours) || 24,
    });
    res.json({ success: true, metrics });
  } catch (error) {
    sendError(res, error, 'Failed to load metrics');
  }
});

router.get('/diagnostics', adminOnly, async (req, res) => {
  try {
    if (!requireTenant(req, res)) return;
    const prisma = await getPrisma();
    const diagnostics = await diagnosticsService.getDiagnostics(prisma, req.user.tenantId);
    res.json({ success: true, diagnostics });
  } catch (error) {
    sendError(res, error, 'Failed to load diagnostics');
  }
});

router.get('/runtime-validation', adminOnly, async (req, res) => {
  try {
    if (!requireTenant(req, res)) return;
    const prisma = await getPrisma();
    const validation = await runtimeValidationService.getValidationReport(prisma, req.user.tenantId);
    res.json({ success: true, validation });
  } catch (error) {
    sendError(res, error, 'Failed to load runtime validation');
  }
});

router.post('/runtime-validation/run', adminOnly, async (req, res) => {
  try {
    if (!requireTenant(req, res)) return;
    const prisma = await getPrisma();
    const validation = await runtimeValidationService.runValidation(prisma, req.user.tenantId, { req });
    res.json({ success: true, validation });
  } catch (error) {
    sendError(res, error, 'Runtime validation failed');
  }
});

router.post('/migration/preview', adminOnly, async (req, res) => {
  try {
    if (!requireTenant(req, res)) return;
    const prisma = await getPrisma();
    const preview = await migrationService.migrationPreview(prisma, req.user.tenantId, req.body || {});
    res.json({ success: true, preview });
  } catch (error) {
    sendError(res, error, 'Migration preview failed');
  }
});

router.post('/migration/run', adminOnly, v3HeavyMutationLimiter, async (req, res) => {
  try {
    if (!requireTenant(req, res)) return;
    const prisma = await getPrisma();
    const dryRun = req.body?.apply === true ? false : req.body?.dryRun !== false;
    const result = await migrationService.migrationExecute(prisma, req.user.tenantId, {
      ...req.body,
      dryRun,
      req,
    });
    res.json({ success: true, ...result });
  } catch (error) {
    sendError(res, error, 'Migration failed');
  }
});

router.post('/migration/rollback', adminOnly, v3HeavyMutationLimiter, async (req, res) => {
  try {
    if (!requireTenant(req, res)) return;
    const prisma = await getPrisma();
    const result = await migrationService.migrationRollback(prisma, req.user.tenantId, {
      ...req.body,
      req,
    });
    res.json({ success: true, result });
  } catch (error) {
    sendError(res, error, 'Migration rollback failed');
  }
});

router.get('/migration/report', adminOnly, async (req, res) => {
  try {
    if (!requireTenant(req, res)) return;
    const prisma = await getPrisma();
    const report = await migrationService.getMigrationReport(prisma, req.user.tenantId, {
      migrationRunId: req.query.migrationRunId ? String(req.query.migrationRunId) : undefined,
      limit: Number(req.query.limit) || 20,
    });
    res.json({ success: true, report });
  } catch (error) {
    sendError(res, error, 'Failed to load migration report');
  }
});

function resolveWizardTenantId(req) {
  const requested = req.query?.tenantId || req.body?.tenantId;
  if (requested) return String(requested);
  return req.user.tenantId;
}

router.get('/migration-wizard/discovery', superAdminOnly, async (req, res) => {
  try {
    const tenantId = resolveWizardTenantId(req);
    if (!tenantId) {
      return res.status(400).json({ error: 'tenantId is required for migration wizard' });
    }
    const prisma = await getPrisma();
    const discoveryResult = await migrationWizardService.discovery(prisma, tenantId);
    res.json({ success: true, discovery: discoveryResult });
  } catch (error) {
    sendError(res, error, 'Migration wizard discovery failed');
  }
});

router.post('/migration-wizard/validate', superAdminOnly, async (req, res) => {
  try {
    const tenantId = resolveWizardTenantId(req);
    if (!tenantId) {
      return res.status(400).json({ error: 'tenantId is required for migration wizard' });
    }
    const prisma = await getPrisma();
    const validation = await migrationWizardService.validate(prisma, tenantId);
    res.json({ success: true, validation });
  } catch (error) {
    sendError(res, error, 'Migration wizard validation failed');
  }
});

router.post('/migration-wizard/preview', superAdminOnly, async (req, res) => {
  try {
    const tenantId = resolveWizardTenantId(req);
    if (!tenantId) {
      return res.status(400).json({ error: 'tenantId is required for migration wizard' });
    }
    const prisma = await getPrisma();
    const previewResult = await migrationWizardService.preview(prisma, tenantId);
    res.json({ success: true, preview: previewResult });
  } catch (error) {
    sendError(res, error, 'Migration wizard preview failed');
  }
});

router.post('/migration-wizard/run', superAdminOnly, v3HeavyMutationLimiter, async (req, res) => {
  try {
    const tenantId = resolveWizardTenantId(req);
    if (!tenantId) {
      return res.status(400).json({ error: 'tenantId is required for migration wizard' });
    }
    const prisma = await getPrisma();
    const dryRun = req.body?.apply === true ? false : req.body?.dryRun !== false;
    const result = await migrationWizardService.runMigration(prisma, tenantId, {
      dryRun,
      autoRollback: req.body?.autoRollback !== false,
      req,
    });
    res.json({ success: true, ...result });
  } catch (error) {
    sendError(res, error, 'Migration wizard run failed');
  }
});

router.post('/migration-wizard/rollback', superAdminOnly, v3HeavyMutationLimiter, async (req, res) => {
  try {
    const tenantId = resolveWizardTenantId(req);
    if (!tenantId) {
      return res.status(400).json({ error: 'tenantId is required for migration wizard' });
    }
    const prisma = await getPrisma();
    const result = await migrationWizardService.rollbackMigration(prisma, tenantId, {
      migrationRunId: req.body?.migrationRunId,
      backupId: req.body?.backupId,
      dryRun: req.body?.dryRun === true,
      req,
    });
    res.json({ success: true, rollback: result });
  } catch (error) {
    sendError(res, error, 'Migration wizard rollback failed');
  }
});

router.get('/production-health', adminOnly, async (req, res) => {
  try {
    if (!requireTenant(req, res)) return;
    const prisma = await getPrisma();
    const health = await productionHealthService.getProductionHealth(prisma, req.user.tenantId);
    await auditService.log(prisma, req, {
      action: 'v3.production.health.checked',
      entityType: 'Tenant',
      entityId: req.user.tenantId,
      newValue: { overall: health.overall, critical: health.criticalIssues.length },
    });
    res.json({ success: true, health });
  } catch (error) {
    sendError(res, error, 'Failed to load production health');
  }
});

router.get('/deployment', adminOnly, async (req, res) => {
  try {
    if (!requireTenant(req, res)) return;
    const prisma = await getPrisma();
    const deployment = await deploymentService.getDeploymentStatus(prisma, req.user.tenantId);
    res.json({ success: true, deployment });
  } catch (error) {
    sendError(res, error, 'Failed to load deployment status');
  }
});

// --- V3 Test Lab (super admin integration harness) ---

router.get('/test-lab/status', superAdminOnly, async (req, res) => {
  try {
    const status = await testLabService.getTestLabStatus();
    res.json({ success: true, status });
  } catch (error) {
    sendError(res, error, 'Failed to load test lab status');
  }
});

router.get('/test-lab/runs', superAdminOnly, async (req, res) => {
  try {
    const prisma = await getPrisma();
    const runs = await testLabService.listRuns(prisma, { limit: Number(req.query.limit) || 20 });
    res.json({ success: true, ...runs });
  } catch (error) {
    sendError(res, error, 'Failed to list test lab runs');
  }
});

router.get('/test-lab/runs/:runId', superAdminOnly, async (req, res) => {
  try {
    const prisma = await getPrisma();
    const result = await testLabService.getRunReport(prisma, req.params.runId);
    res.json({ success: true, ...result });
  } catch (error) {
    sendError(res, error, 'Failed to load test lab report');
  }
});

router.post('/test-lab/run', superAdminOnly, v3HeavyMutationLimiter, async (req, res) => {
  try {
    const prisma = await getPrisma();
    const body = req.body || {};
    const result = await testLabService.runIntegrationSuite(prisma, {
      tenantName: body.tenantName,
      employeeCount: body.employeeCount,
      simulateNumbers: body.simulateNumbers,
      teardown: body.teardown,
      teardownOnFinish: body.teardownOnFinish,
    }, { req, actor: req.user });
    res.json({ success: true, ...result });
  } catch (error) {
    sendError(res, error, 'Test lab run failed');
  }
});

router.post('/test-lab/teardown', superAdminOnly, async (req, res) => {
  try {
    const prisma = await getPrisma();
    const tenantId = String(req.body?.tenantId || '');
    if (!tenantId) return res.status(400).json({ error: 'tenantId is required' });
    const result = await testLabService.teardownTestTenant(prisma, tenantId, { req, actor: req.user });
    res.json({ success: true, result });
  } catch (error) {
    sendError(res, error, 'Test lab teardown failed');
  }
});

module.exports = router;
