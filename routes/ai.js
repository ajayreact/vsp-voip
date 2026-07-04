const express = require('express');
const { getPrisma } = require('../db');
const { authMiddleware } = require('../lib/auth');
const { assertTenantActive } = require('../lib/tenantGuard');
const {
  getAiStatus,
  getTenantAiSettings,
  upsertTenantAiSettings,
  getTenantUsageSummary,
  isPlatformAiEnabled,
  KNOWN_FEATURES,
} = require('../lib/ai');

const router = express.Router();

function resolveTenantId(req) {
  if (req.user.role === 'SUPER_ADMIN' && req.query.tenantId) {
    return String(req.query.tenantId);
  }
  return req.user.tenantId;
}

function requireTenantAdmin(req, res, next) {
  if (req.user.role === 'SUPER_ADMIN' || req.user.role === 'TENANT_ADMIN') {
    return next();
  }
  return res.status(403).json({ error: 'Tenant admin access required' });
}

router.get('/ai/status', authMiddleware, async (req, res) => {
  try {
    const tenantId = resolveTenantId(req);
    if (!tenantId) {
      return res.status(403).json({ error: 'No organization linked to this account' });
    }

    const prisma = await getPrisma();
    await assertTenantActive(prisma, tenantId);
    const status = await getAiStatus(prisma, tenantId);

    res.json({ success: true, status });
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message || 'Failed to load AI status' });
  }
});

router.get('/ai/settings', authMiddleware, requireTenantAdmin, async (req, res) => {
  try {
    const tenantId = resolveTenantId(req);
    if (!tenantId) {
      return res.status(403).json({ error: 'No organization linked to this account' });
    }

    const prisma = await getPrisma();
    await assertTenantActive(prisma, tenantId);
    const settings = await getTenantAiSettings(prisma, tenantId);

    res.json({
      success: true,
      platformEnabled: isPlatformAiEnabled(),
      knownFeatures: KNOWN_FEATURES,
      settings,
    });
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message || 'Failed to load AI settings' });
  }
});

router.patch('/ai/settings', authMiddleware, requireTenantAdmin, async (req, res) => {
  try {
    const tenantId = resolveTenantId(req);
    if (!tenantId) {
      return res.status(403).json({ error: 'No organization linked to this account' });
    }

    const prisma = await getPrisma();
    await assertTenantActive(prisma, tenantId);

    const patch = {};
    if (typeof req.body.enabled === 'boolean') patch.enabled = req.body.enabled;
    if (req.body.allowedProvider !== undefined) patch.allowedProvider = req.body.allowedProvider || null;
    if (req.body.allowedModel !== undefined) patch.allowedModel = req.body.allowedModel || null;
    if (req.body.provider !== undefined) patch.allowedProvider = req.body.provider || null;
    if (req.body.defaultModel !== undefined) patch.allowedModel = req.body.defaultModel || null;
    if (typeof req.body.piiRedactionEnabled === 'boolean') patch.piiRedactionEnabled = req.body.piiRedactionEnabled;
    if (req.body.dailyBudgetCents !== undefined) patch.dailyBudgetCents = req.body.dailyBudgetCents;
    if (req.body.monthlyBudgetCents !== undefined) patch.monthlyBudgetCents = req.body.monthlyBudgetCents;
    if (req.body.maxRequestsPerDay !== undefined) patch.maxRequestsPerDay = req.body.maxRequestsPerDay;
    if (req.body.maxTokens !== undefined) patch.maxTokens = req.body.maxTokens;
    if (req.body.temperature !== undefined) patch.temperature = req.body.temperature;
    if (typeof req.body.streamingEnabled === 'boolean') patch.streamingEnabled = req.body.streamingEnabled;
    if (req.body.features && typeof req.body.features === 'object') patch.features = req.body.features;

    const settings = await upsertTenantAiSettings(prisma, tenantId, patch);
    res.json({ success: true, settings });
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message || 'Failed to update AI settings' });
  }
});

router.get('/ai/usage', authMiddleware, requireTenantAdmin, async (req, res) => {
  try {
    const tenantId = resolveTenantId(req);
    if (!tenantId) {
      return res.status(403).json({ error: 'No organization linked to this account' });
    }

    const prisma = await getPrisma();
    await assertTenantActive(prisma, tenantId);

    const since = req.query.since ? new Date(String(req.query.since)) : undefined;
    const summary = await getTenantUsageSummary(prisma, tenantId, { since });

    res.json({ success: true, summary });
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message || 'Failed to load AI usage' });
  }
});

module.exports = router;
