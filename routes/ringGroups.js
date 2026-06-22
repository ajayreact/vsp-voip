const express = require('express');
const { getPrisma } = require('../db');
const { authMiddleware, requireRole } = require('../lib/auth');
const { assertTenantActive } = require('../lib/tenantGuard');
const { getCredentialConnectionId } = require('../lib/telnyxConfig');
const {
  listRingGroups,
  getRingGroupDetail,
  createRingGroup,
  updateRingGroup,
  deleteRingGroup,
  addRingGroupMember,
  removeRingGroupMember,
  reorderRingGroupMembers,
  listRingGroupVoicemails,
  getRingGroupAnalytics,
  listRingGroupDestinations,
  simulateRingGroupRouting,
  migrateLegacyGreetingRingGroup,
} = require('../lib/ringGroups');

const router = express.Router();

function requireTenant(req, res) {
  if (!req.user.tenantId) {
    res.status(403).json({ error: 'No organization linked to this account' });
    return false;
  }
  return true;
}

router.get(
  '/tenant/ring-groups',
  authMiddleware,
  requireRole('SUPER_ADMIN', 'TENANT_ADMIN', 'TENANT_USER'),
  async (req, res) => {
    try {
      if (!requireTenant(req, res)) return;
      const prisma = await getPrisma();
      const ringGroups = await listRingGroups(prisma, req.user.tenantId);
      res.json({ success: true, ringGroups });
    } catch (error) {
      res.status(500).json({ error: 'Failed to load ring groups' });
    }
  },
);

router.get(
  '/tenant/ring-groups/destinations',
  authMiddleware,
  requireRole('SUPER_ADMIN', 'TENANT_ADMIN'),
  async (req, res) => {
    try {
      if (!requireTenant(req, res)) return;
      const prisma = await getPrisma();
      const ringGroups = await listRingGroupDestinations(prisma, req.user.tenantId);
      res.json({ success: true, ringGroups });
    } catch (error) {
      res.status(500).json({ error: 'Failed to load ring group destinations' });
    }
  },
);

router.post(
  '/tenant/ring-groups/migrate-legacy',
  authMiddleware,
  requireRole('SUPER_ADMIN', 'TENANT_ADMIN'),
  async (req, res) => {
    try {
      if (!requireTenant(req, res)) return;
      const prisma = await getPrisma();
      await assertTenantActive(prisma, req.user.tenantId);
      const group = await migrateLegacyGreetingRingGroup(prisma, req.user.tenantId);
      res.json({ success: true, migrated: Boolean(group), ringGroupId: group?.id || null });
    } catch (error) {
      res.status(error.status || 500).json({ error: error.message || 'Migration failed' });
    }
  },
);

router.post(
  '/tenant/ring-groups',
  authMiddleware,
  requireRole('SUPER_ADMIN', 'TENANT_ADMIN'),
  async (req, res) => {
    try {
      if (!requireTenant(req, res)) return;
      const prisma = await getPrisma();
      await assertTenantActive(prisma, req.user.tenantId);
      const ringGroup = await createRingGroup(prisma, req.user.tenantId, req.body);
      res.status(201).json({ success: true, ringGroup });
    } catch (error) {
      res.status(error.status || 500).json({ error: error.message || 'Failed to create ring group' });
    }
  },
);

router.get(
  '/tenant/ring-groups/:id',
  authMiddleware,
  requireRole('SUPER_ADMIN', 'TENANT_ADMIN', 'TENANT_USER'),
  async (req, res) => {
    try {
      if (!requireTenant(req, res)) return;
      const prisma = await getPrisma();
      const ringGroup = await getRingGroupDetail(prisma, req.user.tenantId, req.params.id);
      res.json({ success: true, ringGroup });
    } catch (error) {
      res.status(error.status || 500).json({ error: error.message || 'Failed to load ring group' });
    }
  },
);

router.patch(
  '/tenant/ring-groups/:id',
  authMiddleware,
  requireRole('SUPER_ADMIN', 'TENANT_ADMIN'),
  async (req, res) => {
    try {
      if (!requireTenant(req, res)) return;
      const prisma = await getPrisma();
      await assertTenantActive(prisma, req.user.tenantId);
      const ringGroup = await updateRingGroup(prisma, req.user.tenantId, req.params.id, req.body);
      res.json({ success: true, ringGroup });
    } catch (error) {
      res.status(error.status || 500).json({ error: error.message || 'Failed to update ring group' });
    }
  },
);

router.delete(
  '/tenant/ring-groups/:id',
  authMiddleware,
  requireRole('SUPER_ADMIN', 'TENANT_ADMIN'),
  async (req, res) => {
    try {
      if (!requireTenant(req, res)) return;
      const prisma = await getPrisma();
      await assertTenantActive(prisma, req.user.tenantId);
      const result = await deleteRingGroup(prisma, req.user.tenantId, req.params.id);
      res.json({ success: true, ...result });
    } catch (error) {
      res.status(error.status || 500).json({ error: error.message || 'Failed to delete ring group' });
    }
  },
);

router.post(
  '/tenant/ring-groups/:id/members',
  authMiddleware,
  requireRole('SUPER_ADMIN', 'TENANT_ADMIN'),
  async (req, res) => {
    try {
      if (!requireTenant(req, res)) return;
      const prisma = await getPrisma();
      await assertTenantActive(prisma, req.user.tenantId);
      const member = await addRingGroupMember(prisma, req.user.tenantId, req.params.id, req.body);
      res.status(201).json({ success: true, member });
    } catch (error) {
      res.status(error.status || 500).json({ error: error.message || 'Failed to add member' });
    }
  },
);

router.delete(
  '/tenant/ring-groups/:id/members/:memberId',
  authMiddleware,
  requireRole('SUPER_ADMIN', 'TENANT_ADMIN'),
  async (req, res) => {
    try {
      if (!requireTenant(req, res)) return;
      const prisma = await getPrisma();
      await assertTenantActive(prisma, req.user.tenantId);
      const result = await removeRingGroupMember(
        prisma,
        req.user.tenantId,
        req.params.id,
        req.params.memberId,
      );
      res.json({ success: true, ...result });
    } catch (error) {
      res.status(error.status || 500).json({ error: error.message || 'Failed to remove member' });
    }
  },
);

router.patch(
  '/tenant/ring-groups/:id/members/reorder',
  authMiddleware,
  requireRole('SUPER_ADMIN', 'TENANT_ADMIN'),
  async (req, res) => {
    try {
      if (!requireTenant(req, res)) return;
      const prisma = await getPrisma();
      await assertTenantActive(prisma, req.user.tenantId);
      const ringGroup = await reorderRingGroupMembers(
        prisma,
        req.user.tenantId,
        req.params.id,
        req.body.memberIds,
      );
      res.json({ success: true, ringGroup });
    } catch (error) {
      res.status(error.status || 500).json({ error: error.message || 'Failed to reorder members' });
    }
  },
);

router.get(
  '/tenant/ring-groups/:id/voicemails',
  authMiddleware,
  requireRole('SUPER_ADMIN', 'TENANT_ADMIN', 'TENANT_USER'),
  async (req, res) => {
    try {
      if (!requireTenant(req, res)) return;
      const prisma = await getPrisma();
      const limit = Number(req.query.limit) || 50;
      const voicemails = await listRingGroupVoicemails(prisma, req.user.tenantId, req.params.id, limit);
      res.json({ success: true, voicemails });
    } catch (error) {
      res.status(error.status || 500).json({ error: error.message || 'Failed to load voicemails' });
    }
  },
);

router.get(
  '/tenant/ring-groups/:id/analytics',
  authMiddleware,
  requireRole('SUPER_ADMIN', 'TENANT_ADMIN', 'TENANT_USER'),
  async (req, res) => {
    try {
      if (!requireTenant(req, res)) return;
      const prisma = await getPrisma();
      const analytics = await getRingGroupAnalytics(prisma, req.user.tenantId, req.params.id);
      res.json({ success: true, analytics });
    } catch (error) {
      res.status(error.status || 500).json({ error: error.message || 'Failed to load analytics' });
    }
  },
);

router.get(
  '/tenant/ring-groups/:id/routing-preview',
  authMiddleware,
  requireRole('SUPER_ADMIN', 'TENANT_ADMIN'),
  async (req, res) => {
    try {
      if (!requireTenant(req, res)) return;
      const prisma = await getPrisma();
      const credentialConnectionId = await getCredentialConnectionId(prisma);
      const preview = await simulateRingGroupRouting(
        prisma,
        req.user.tenantId,
        req.params.id,
        credentialConnectionId,
      );
      res.json({
        success: true,
        preview: {
          targetCount: preview.targets.length,
          strategy: preview.strategy,
          ringTimeout: preview.ringTimeout,
          targets: preview.targets.map((t) => ({
            type: t.type,
            label: t.label,
            extensionId: t.extensionId,
            memberId: t.memberId,
            sipUsername: t.user?.telnyxSipUsername || null,
          })),
        },
      });
    } catch (error) {
      res.status(error.status || 500).json({ error: error.message || 'Routing preview failed' });
    }
  },
);

module.exports = router;
