const express = require('express');
const { getPrisma } = require('../db');
const { authMiddleware, requireRole } = require('../lib/auth');
const { assertTenantActive } = require('../lib/tenantGuard');
const {
  listExtensions,
  getExtensionDetail,
  createExtension,
  updateExtension,
  disableExtension,
  deleteExtension,
  getExtensionAnalytics,
  listExtensionVoicemails,
  listAllTenantDevices,
  getExtensionDashboardStats,
  suggestNextExtensionNumber,
  listRegistrationMonitoring,
  updateExtensionBusinessFeatures,
  initiateIntercom,
} = require('../lib/extensions');
const {
  updateExtensionSecurity,
  listExtensionAuditLogs,
  listTenantSecurityAuditLogs,
  serializeSecurity,
} = require('../lib/extensionSecurity');
const {
  reassignExtensionEmployee,
  resetExtensionSipCredentials,
  forceLogoutExtensionDevices,
  setPrimaryPhoneNumber,
  listExtensionPhoneNumbersContext,
  listAvailablePhoneNumbersForExtension,
  serializePhoneNumber,
} = require('../lib/extensionOwnership');

const {
  createExtensionProvisioningToken,
  getExtensionSipCredentials,
} = require('../lib/extensionProvisioning');
const {
  syncTenantPhoneExtensionLinks,
  resolveOwnershipChain,
  validateTenantNumbersChain,
} = require('../lib/pbxOwnership');

const router = express.Router();

function requireTenant(req, res) {
  if (!req.user.tenantId) {
    res.status(403).json({ error: 'No organization linked to this account' });
    return false;
  }
  return true;
}

router.post(
  '/tenant/extensions/sync-phone-links',
  authMiddleware,
  requireRole('SUPER_ADMIN', 'TENANT_ADMIN'),
  async (req, res) => {
    try {
      if (!requireTenant(req, res)) return;
      const prisma = await getPrisma();
      await assertTenantActive(prisma, req.user.tenantId);
      const result = await syncTenantPhoneExtensionLinks(prisma, req.user.tenantId);
      res.json({ success: true, ...result });
    } catch (error) {
      res.status(500).json({ error: error.message || 'Failed to sync phone links' });
    }
  },
);

router.get(
  '/tenant/ownership/validate',
  authMiddleware,
  requireRole('SUPER_ADMIN', 'TENANT_ADMIN'),
  async (req, res) => {
    try {
      if (!requireTenant(req, res)) return;
      const prisma = await getPrisma();
      await assertTenantActive(prisma, req.user.tenantId);
      const report = await validateTenantNumbersChain(prisma, req.user.tenantId);
      res.json({ success: true, report });
    } catch (error) {
      res.status(500).json({ error: error.message || 'Failed to validate ownership chain' });
    }
  },
);

router.get(
  '/tenant/ownership/chain/:phoneRef',
  authMiddleware,
  requireRole('SUPER_ADMIN', 'TENANT_ADMIN'),
  async (req, res) => {
    try {
      if (!requireTenant(req, res)) return;
      const prisma = await getPrisma();
      await assertTenantActive(prisma, req.user.tenantId);
      const chain = await resolveOwnershipChain(prisma, req.user.tenantId, req.params.phoneRef);
      res.json({ success: true, chain });
    } catch (error) {
      res.status(500).json({ error: error.message || 'Failed to resolve ownership chain' });
    }
  },
);

router.get(
  '/tenant/extensions/stats',
  authMiddleware,
  requireRole('SUPER_ADMIN', 'TENANT_ADMIN', 'TENANT_USER'),
  async (req, res) => {
    try {
      if (!requireTenant(req, res)) return;
      const prisma = await getPrisma();
      const stats = await getExtensionDashboardStats(prisma, req.user.tenantId);
      res.json({ success: true, stats });
    } catch (error) {
      res.status(500).json({ error: 'Failed to load extension stats' });
    }
  },
);

router.get(
  '/tenant/extensions/suggest-number',
  authMiddleware,
  requireRole('SUPER_ADMIN', 'TENANT_ADMIN'),
  async (req, res) => {
    try {
      if (!requireTenant(req, res)) return;
      const prisma = await getPrisma();
      const extensionNumber = await suggestNextExtensionNumber(prisma, req.user.tenantId);
      res.json({ success: true, extensionNumber });
    } catch (error) {
      res.status(error.status || 500).json({ error: error.message || 'Failed to suggest extension number' });
    }
  },
);

router.get(
  '/tenant/extensions/available-dids',
  authMiddleware,
  requireRole('SUPER_ADMIN', 'TENANT_ADMIN'),
  async (req, res) => {
    try {
      if (!requireTenant(req, res)) return;
      const prisma = await getPrisma();
      await assertTenantActive(prisma, req.user.tenantId);
      const rows = await listAvailablePhoneNumbersForExtension(prisma, req.user.tenantId);
      res.json({
        success: true,
        available: rows.map((row) => serializePhoneNumber(row)),
      });
    } catch (error) {
      res.status(500).json({ error: error.message || 'Failed to load available DIDs' });
    }
  },
);

router.get(
  '/tenant/extensions/devices',
  authMiddleware,
  requireRole('SUPER_ADMIN', 'TENANT_ADMIN', 'TENANT_USER'),
  async (req, res) => {
    try {
      if (!requireTenant(req, res)) return;
      const prisma = await getPrisma();
      const payload = await listAllTenantDevices(prisma, req.user.tenantId);
      res.json({ success: true, ...payload });
    } catch (error) {
      res.status(500).json({ error: 'Failed to load devices' });
    }
  },
);

router.get(
  '/tenant/extensions',
  authMiddleware,
  requireRole('SUPER_ADMIN', 'TENANT_ADMIN', 'TENANT_USER'),
  async (req, res) => {
    try {
      if (!requireTenant(req, res)) return;
      const prisma = await getPrisma();
      const extensions = await listExtensions(prisma, req.user.tenantId);
      res.json({ success: true, extensions });
    } catch (error) {
      res.status(500).json({ error: 'Failed to load extensions' });
    }
  },
);

router.get(
  '/tenant/extensions/registration',
  authMiddleware,
  requireRole('SUPER_ADMIN', 'TENANT_ADMIN', 'TENANT_USER'),
  async (req, res) => {
    try {
      if (!requireTenant(req, res)) return;
      const prisma = await getPrisma();
      const payload = await listRegistrationMonitoring(prisma, req.user.tenantId);
      res.json({ success: true, ...payload });
    } catch (error) {
      res.status(500).json({ error: 'Failed to load registration status' });
    }
  },
);

router.get(
  '/tenant/extensions/destinations',
  authMiddleware,
  requireRole('SUPER_ADMIN', 'TENANT_ADMIN'),
  async (req, res) => {
    try {
      if (!requireTenant(req, res)) return;
      const prisma = await getPrisma();
      const [extensions, ringGroups] = await Promise.all([
        prisma.extension.findMany({
          where: { tenantId: req.user.tenantId, status: 'ACTIVE' },
          select: { id: true, extensionNumber: true, displayName: true },
          orderBy: { extensionNumber: 'asc' },
        }),
        prisma.ringGroup.findMany({
          where: { tenantId: req.user.tenantId, isActive: true },
          select: { id: true, name: true, extensionNumber: true },
          orderBy: { name: 'asc' },
        }),
      ]);
      res.json({
        success: true,
        extensions: extensions.map((e) => ({
          id: e.id,
          label: `${e.extensionNumber} — ${e.displayName}`,
          extensionNumber: e.extensionNumber,
        })),
        ringGroups: ringGroups.map((g) => ({
          id: g.id,
          label: g.extensionNumber ? `${g.extensionNumber} — ${g.name}` : g.name,
          extensionNumber: g.extensionNumber,
        })),
      });
    } catch (error) {
      res.status(500).json({ error: 'Failed to load forward destinations' });
    }
  },
);

router.get(
  '/tenant/extensions/registration',
  authMiddleware,
  requireRole('SUPER_ADMIN', 'TENANT_ADMIN', 'TENANT_USER'),
  async (req, res) => {
    try {
      if (!requireTenant(req, res)) return;
      const prisma = await getPrisma();
      const payload = await listRegistrationMonitoring(prisma, req.user.tenantId);
      res.json({ success: true, ...payload });
    } catch (error) {
      res.status(500).json({ error: 'Failed to load registration status' });
    }
  },
);

router.get(
  '/tenant/extensions/destinations',
  authMiddleware,
  requireRole('SUPER_ADMIN', 'TENANT_ADMIN'),
  async (req, res) => {
    try {
      if (!requireTenant(req, res)) return;
      const prisma = await getPrisma();
      const [extensions, ringGroups] = await Promise.all([
        prisma.extension.findMany({
          where: { tenantId: req.user.tenantId, status: 'ACTIVE' },
          select: { id: true, extensionNumber: true, displayName: true },
          orderBy: { extensionNumber: 'asc' },
        }),
        prisma.ringGroup.findMany({
          where: { tenantId: req.user.tenantId, isActive: true },
          select: { id: true, name: true, extensionNumber: true },
          orderBy: { name: 'asc' },
        }),
      ]);
      res.json({
        success: true,
        extensions: extensions.map((e) => ({
          id: e.id,
          label: `${e.extensionNumber} — ${e.displayName}`,
          extensionNumber: e.extensionNumber,
        })),
        ringGroups: ringGroups.map((g) => ({
          id: g.id,
          label: g.extensionNumber ? `${g.extensionNumber} — ${g.name}` : g.name,
          extensionNumber: g.extensionNumber,
        })),
      });
    } catch (error) {
      res.status(500).json({ error: 'Failed to load forward destinations' });
    }
  },
);

router.get(
  '/tenant/extensions/security/audit',
  authMiddleware,
  requireRole('SUPER_ADMIN', 'TENANT_ADMIN'),
  async (req, res) => {
    try {
      if (!requireTenant(req, res)) return;
      const prisma = await getPrisma();
      const logs = await listTenantSecurityAuditLogs(prisma, req.user.tenantId, Number(req.query.limit) || 50);
      res.json({ success: true, logs });
    } catch (error) {
      res.status(500).json({ error: 'Failed to load security audit logs' });
    }
  },
);

router.get(
  '/tenant/extensions/:id/sip',
  authMiddleware,
  requireRole('SUPER_ADMIN', 'TENANT_ADMIN'),
  async (req, res) => {
    try {
      if (!requireTenant(req, res)) return;
      const prisma = await getPrisma();
      await assertTenantActive(prisma, req.user.tenantId);
      const sip = await getExtensionSipCredentials(prisma, req.user.tenantId, req.params.id);
      res.json({ success: true, sip });
    } catch (error) {
      if (error.status === 404) return res.status(404).json({ error: error.message });
      if (error.status === 400) return res.status(400).json({ error: error.message });
      res.status(500).json({ error: error.message || 'Failed to load SIP credentials' });
    }
  },
);

router.post(
  '/tenant/extensions/:id/provisioning-token',
  authMiddleware,
  requireRole('SUPER_ADMIN', 'TENANT_ADMIN'),
  async (req, res) => {
    try {
      if (!requireTenant(req, res)) return;
      const prisma = await getPrisma();
      await assertTenantActive(prisma, req.user.tenantId);
      const provisioning = await createExtensionProvisioningToken(
        prisma,
        req.user.tenantId,
        req.params.id,
        { target: req.body?.target || 'mobile' },
        { userId: req.user.sub, userEmail: req.user.email },
      );
      res.json({ success: true, provisioning });
    } catch (error) {
      if (error.status === 404) return res.status(404).json({ error: error.message });
      if (error.status === 400) return res.status(400).json({ error: error.message });
      res.status(500).json({ error: error.message || 'Failed to create provisioning token' });
    }
  },
);

router.get(
  '/tenant/extensions/:id',
  authMiddleware,
  requireRole('SUPER_ADMIN', 'TENANT_ADMIN', 'TENANT_USER'),
  async (req, res) => {
    try {
      if (!requireTenant(req, res)) return;
      const prisma = await getPrisma();
      const extensionId = String(req.params.id || '').trim();
      if (process.env.NODE_ENV !== 'production') {
        console.log('[extensions] GET detail', {
          extensionId,
          tenantId: req.user.tenantId,
        });
      }
      const extension = await getExtensionDetail(prisma, req.user.tenantId, extensionId);
      res.json({ success: true, extension });
    } catch (error) {
      if (error.status === 404) return res.status(404).json({ error: error.message });
      res.status(500).json({ error: 'Failed to load extension' });
    }
  },
);

router.get(
  '/tenant/extensions/:id/analytics',
  authMiddleware,
  requireRole('SUPER_ADMIN', 'TENANT_ADMIN', 'TENANT_USER'),
  async (req, res) => {
    try {
      if (!requireTenant(req, res)) return;
      const prisma = await getPrisma();
      const analytics = await getExtensionAnalytics(prisma, req.user.tenantId, req.params.id);
      res.json({ success: true, analytics });
    } catch (error) {
      if (error.status === 404) return res.status(404).json({ error: error.message });
      res.status(500).json({ error: 'Failed to load analytics' });
    }
  },
);

router.get(
  '/tenant/extensions/:id/voicemails',
  authMiddleware,
  requireRole('SUPER_ADMIN', 'TENANT_ADMIN', 'TENANT_USER'),
  async (req, res) => {
    try {
      if (!requireTenant(req, res)) return;
      const prisma = await getPrisma();
      const limit = Number(req.query.limit) || 50;
      const voicemails = await listExtensionVoicemails(prisma, req.user.tenantId, req.params.id, limit);
      res.json({ success: true, voicemails });
    } catch (error) {
      if (error.status === 404) return res.status(404).json({ error: error.message });
      res.status(500).json({ error: 'Failed to load voicemails' });
    }
  },
);

router.post(
  '/tenant/extensions',
  authMiddleware,
  requireRole('SUPER_ADMIN', 'TENANT_ADMIN'),
  async (req, res) => {
    try {
      if (!requireTenant(req, res)) return;
      const prisma = await getPrisma();
      await assertTenantActive(prisma, req.user.tenantId);
      const extension = await createExtension(prisma, req.user.tenantId, req.body, {
        userId: req.user.sub,
        userEmail: req.user.email,
      });
      res.status(201).json({ success: true, extension });
    } catch (error) {
      if (error.code === 'P2002') {
        return res.status(409).json({ error: 'Extension number already in use' });
      }
      if (error.status === 400) return res.status(400).json({ error: error.message });
      res.status(500).json({ error: error.message || 'Failed to create extension' });
    }
  },
);

router.patch(
  '/tenant/extensions/:id',
  authMiddleware,
  requireRole('SUPER_ADMIN', 'TENANT_ADMIN'),
  async (req, res) => {
    try {
      if (!requireTenant(req, res)) return;
      const prisma = await getPrisma();
      await assertTenantActive(prisma, req.user.tenantId);
      const extension = await updateExtension(prisma, req.user.tenantId, req.params.id, req.body);
      res.json({ success: true, extension });
    } catch (error) {
      if (error.status === 404) return res.status(404).json({ error: error.message });
      if (error.status === 400) return res.status(400).json({ error: error.message });
      if (error.code === 'P2002') return res.status(409).json({ error: 'Extension number already in use' });
      res.status(500).json({ error: error.message || 'Failed to update extension' });
    }
  },
);

router.post(
  '/tenant/extensions/:id/disable',
  authMiddleware,
  requireRole('SUPER_ADMIN', 'TENANT_ADMIN'),
  async (req, res) => {
    try {
      if (!requireTenant(req, res)) return;
      const prisma = await getPrisma();
      const extension = await disableExtension(prisma, req.user.tenantId, req.params.id);
      res.json({ success: true, extension });
    } catch (error) {
      if (error.status === 404) return res.status(404).json({ error: error.message });
      res.status(500).json({ error: 'Failed to disable extension' });
    }
  },
);

router.patch(
  '/tenant/extensions/:id/business',
  authMiddleware,
  requireRole('SUPER_ADMIN', 'TENANT_ADMIN'),
  async (req, res) => {
    try {
      if (!requireTenant(req, res)) return;
      const prisma = await getPrisma();
      await assertTenantActive(prisma, req.user.tenantId);
      await updateExtensionBusinessFeatures(prisma, req.user.tenantId, req.params.id, req.body, {
        userId: req.user.sub,
        userEmail: req.user.email,
      });
      const extension = await getExtensionDetail(prisma, req.user.tenantId, req.params.id);
      res.json({ success: true, extension });
    } catch (error) {
      if (error.status === 404) return res.status(404).json({ error: error.message });
      if (error.status === 400) return res.status(400).json({ error: error.message });
      res.status(500).json({ error: error.message || 'Failed to update business features' });
    }
  },
);

router.post(
  '/tenant/extensions/:id/intercom',
  authMiddleware,
  requireRole('SUPER_ADMIN', 'TENANT_ADMIN', 'TENANT_USER'),
  async (req, res) => {
    try {
      if (!requireTenant(req, res)) return;
      const prisma = await getPrisma();
      const targetExtensionNumber = req.body?.targetExtensionNumber;
      if (!targetExtensionNumber) {
        return res.status(400).json({ error: 'targetExtensionNumber is required' });
      }
      const intercom = await initiateIntercom(
        prisma,
        req.user.tenantId,
        req.params.id,
        targetExtensionNumber,
      );
      res.json({ success: true, intercom });
    } catch (error) {
      if (error.status === 404) return res.status(404).json({ error: error.message });
      if (error.status === 400) return res.status(400).json({ error: error.message });
      res.status(500).json({ error: error.message || 'Intercom failed' });
    }
  },
);

router.patch(
  '/tenant/extensions/:id/security',
  authMiddleware,
  requireRole('SUPER_ADMIN', 'TENANT_ADMIN'),
  async (req, res) => {
    try {
      if (!requireTenant(req, res)) return;
      const prisma = await getPrisma();
      await assertTenantActive(prisma, req.user.tenantId);
      await updateExtensionSecurity(prisma, req.user.tenantId, req.params.id, req.body, {
        userId: req.user.sub,
        userEmail: req.user.email,
      });
      const extension = await getExtensionDetail(prisma, req.user.tenantId, req.params.id);
      res.json({ success: true, extension, security: extension.security });
    } catch (error) {
      if (error.status === 404) return res.status(404).json({ error: error.message });
      if (error.status === 400) return res.status(400).json({ error: error.message });
      res.status(500).json({ error: error.message || 'Failed to update security' });
    }
  },
);

router.get(
  '/tenant/extensions/:id/audit-logs',
  authMiddleware,
  requireRole('SUPER_ADMIN', 'TENANT_ADMIN'),
  async (req, res) => {
    try {
      if (!requireTenant(req, res)) return;
      const prisma = await getPrisma();
      const logs = await listExtensionAuditLogs(prisma, req.user.tenantId, req.params.id, {
        limit: Number(req.query.limit) || 50,
        category: req.query.category ? String(req.query.category) : undefined,
      });
      res.json({ success: true, logs });
    } catch (error) {
      res.status(500).json({ error: 'Failed to load audit logs' });
    }
  },
);

router.post(
  '/tenant/extensions/:id/reassign-employee',
  authMiddleware,
  requireRole('SUPER_ADMIN', 'TENANT_ADMIN'),
  async (req, res) => {
    try {
      if (!requireTenant(req, res)) return;
      const prisma = await getPrisma();
      await assertTenantActive(prisma, req.user.tenantId);
      await reassignExtensionEmployee(prisma, req.user.tenantId, req.params.id, req.body, {
        userId: req.user.sub,
        userEmail: req.user.email,
      });
      const extension = await getExtensionDetail(prisma, req.user.tenantId, req.params.id);
      res.json({ success: true, extension });
    } catch (error) {
      if (error.status === 404) return res.status(404).json({ error: error.message });
      if (error.status === 400) return res.status(400).json({ error: error.message });
      res.status(500).json({ error: error.message || 'Failed to reassign employee' });
    }
  },
);

router.post(
  '/tenant/extensions/:id/reset-sip-credentials',
  authMiddleware,
  requireRole('SUPER_ADMIN', 'TENANT_ADMIN'),
  async (req, res) => {
    try {
      if (!requireTenant(req, res)) return;
      const prisma = await getPrisma();
      await assertTenantActive(prisma, req.user.tenantId);
      const result = await resetExtensionSipCredentials(
        prisma,
        req.user.tenantId,
        req.params.id,
        { userId: req.user.sub, userEmail: req.user.email },
      );
      const extension = await getExtensionDetail(prisma, req.user.tenantId, req.params.id);
      res.json({ success: true, result, extension });
    } catch (error) {
      if (error.status === 404) return res.status(404).json({ error: error.message });
      if (error.status === 400) return res.status(400).json({ error: error.message });
      res.status(500).json({ error: error.message || 'Failed to reset SIP credentials' });
    }
  },
);

router.post(
  '/tenant/extensions/:id/force-logout-devices',
  authMiddleware,
  requireRole('SUPER_ADMIN', 'TENANT_ADMIN'),
  async (req, res) => {
    try {
      if (!requireTenant(req, res)) return;
      const prisma = await getPrisma();
      await assertTenantActive(prisma, req.user.tenantId);
      const result = await forceLogoutExtensionDevices(
        prisma,
        req.user.tenantId,
        req.params.id,
        { userId: req.user.sub, userEmail: req.user.email },
      );
      const extension = await getExtensionDetail(prisma, req.user.tenantId, req.params.id);
      res.json({ success: true, result, extension });
    } catch (error) {
      if (error.status === 404) return res.status(404).json({ error: error.message });
      if (error.status === 400) return res.status(400).json({ error: error.message });
      res.status(500).json({ error: error.message || 'Failed to force logout devices' });
    }
  },
);

router.get(
  '/tenant/extensions/:id/phone-numbers',
  authMiddleware,
  requireRole('SUPER_ADMIN', 'TENANT_ADMIN'),
  async (req, res) => {
    try {
      if (!requireTenant(req, res)) return;
      const prisma = await getPrisma();
      await assertTenantActive(prisma, req.user.tenantId);
      const context = await listExtensionPhoneNumbersContext(
        prisma,
        req.user.tenantId,
        req.params.id,
      );
      res.json({ success: true, ...context });
    } catch (error) {
      if (error.status === 404) return res.status(404).json({ error: error.message });
      res.status(500).json({ error: error.message || 'Failed to load phone numbers' });
    }
  },
);

router.patch(
  '/tenant/extensions/:id/primary-phone-number',
  authMiddleware,
  requireRole('SUPER_ADMIN', 'TENANT_ADMIN'),
  async (req, res) => {
    try {
      if (!requireTenant(req, res)) return;
      const prisma = await getPrisma();
      await assertTenantActive(prisma, req.user.tenantId);
      const phoneNumberId = req.body.phoneNumberId ? String(req.body.phoneNumberId) : null;
      await setPrimaryPhoneNumber(
        prisma,
        req.user.tenantId,
        req.params.id,
        phoneNumberId,
        { userId: req.user.sub, userEmail: req.user.email },
      );
      const extension = await getExtensionDetail(prisma, req.user.tenantId, req.params.id);
      res.json({ success: true, extension });
    } catch (error) {
      if (error.status === 404) return res.status(404).json({ error: error.message });
      if (error.status === 400) return res.status(400).json({ error: error.message });
      res.status(500).json({ error: error.message || 'Failed to set primary DID' });
    }
  },
);

router.delete(
  '/tenant/extensions/:id',
  authMiddleware,
  requireRole('SUPER_ADMIN', 'TENANT_ADMIN'),
  async (req, res) => {
    try {
      if (!requireTenant(req, res)) return;
      const prisma = await getPrisma();
      const result = await deleteExtension(prisma, req.user.tenantId, req.params.id);
      res.json({ success: true, ...result });
    } catch (error) {
      if (error.status === 404) return res.status(404).json({ error: error.message });
      res.status(500).json({ error: 'Failed to delete extension' });
    }
  },
);

module.exports = router;
