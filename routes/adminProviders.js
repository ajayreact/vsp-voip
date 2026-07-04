/**
 * Super Admin telephony provider management (VSP Phone V3 Multi-Provider
 * Architecture, Phase 5). Mounted under /api/admin/providers by routes/admin.js,
 * which already applies `authMiddleware, requireRole('SUPER_ADMIN')` to every
 * route in this file.
 *
 * This is new, additive API surface — it does not modify or replace
 * `/api/admin/platform-settings` or `/api/admin/telnyx/status`, which
 * continue to serve the existing Telnyx-only settings UI unchanged.
 */

const express = require('express');
const ProviderManager = require('../lib/providers/ProviderManager');
const { writeAuditLog } = require('../lib/auditLog');
const { getPrisma } = require('../db');

const router = express.Router();

const KNOWN_PROVIDERS = [
  { key: 'telnyx', displayName: 'Telnyx' },
  { key: 'twilio', displayName: 'Twilio' },
];

async function ensureKnownProviderRows() {
  await Promise.all(KNOWN_PROVIDERS.map((p) => ProviderManager.ensureProviderRow(p.key, { displayName: p.displayName })));
}

router.get('/', async (req, res) => {
  try {
    await ensureKnownProviderRows();
    const providers = await ProviderManager.listProviders();
    const defaultProvider = await ProviderManager.getDefaultProvider();
    res.json({
      success: true,
      providers,
      defaultProviderKey: defaultProvider?.key || null,
      registeredKeys: ProviderManager.getRegisteredProviderKeys(),
    });
  } catch (error) {
    res.status(500).json({ error: error.message || 'Failed to load providers' });
  }
});

router.patch('/:key', async (req, res) => {
  try {
    const provider = await ProviderManager.setProviderActive(req.params.key, Boolean(req.body?.isActive));
    const prisma = await getPrisma();
    await writeAuditLog(prisma, req, {
      action: 'provider.active_toggled',
      entityType: 'Provider',
      entityId: provider.id,
      details: { key: provider.key, isActive: provider.isActive },
    });
    res.json({ success: true, provider });
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message || 'Failed to update provider' });
  }
});

router.get('/:key/health', async (req, res) => {
  const health = await ProviderManager.checkHealth(req.params.key);
  res.json({ success: true, health });
});

router.get('/:key/logs', async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 50, 200);
    const result = await ProviderManager.getRecentEvents(req.params.key, limit);
    res.json({ success: true, ...result });
  } catch (error) {
    res.status(500).json({ error: error.message || 'Failed to load provider logs' });
  }
});

router.get('/credentials', async (req, res) => {
  try {
    const credentials = await ProviderManager.listCredentials(req.query.providerKey);
    res.json({ success: true, credentials });
  } catch (error) {
    res.status(500).json({ error: error.message || 'Failed to load credentials' });
  }
});

router.put('/credentials', async (req, res) => {
  try {
    const { tenantId, providerKey, scope, externalAccountId, secret, authToken, metadata } = req.body || {};
    if (!providerKey || !scope) {
      return res.status(400).json({ error: 'providerKey and scope are required' });
    }
    const credential = await ProviderManager.upsertCredential({
      tenantId: tenantId || null,
      providerKey,
      scope,
      externalAccountId,
      secret,
      authToken,
      metadata,
    });

    const prisma = await getPrisma();
    await writeAuditLog(prisma, req, {
      action: 'provider.credential_updated',
      entityType: 'ProviderCredential',
      entityId: credential.id,
      details: { providerKey, scope, tenantId: tenantId || null },
    });

    res.json({ success: true, credential: await ProviderManager.getCredential({ tenantId: tenantId || null, providerKey, scope }) });
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message || 'Failed to save credential' });
  }
});

router.get('/default', async (req, res) => {
  const provider = await ProviderManager.getDefaultProvider();
  res.json({ success: true, provider });
});

router.put('/default', async (req, res) => {
  try {
    const { providerKey } = req.body || {};
    if (!providerKey) return res.status(400).json({ error: 'providerKey is required' });
    await ProviderManager.setDefaultProvider(providerKey);
    const prisma = await getPrisma();
    await writeAuditLog(prisma, req, {
      action: 'provider.default_changed',
      entityType: 'PlatformSettings',
      entityId: 'platform',
      details: { providerKey },
    });
    res.json({ success: true, provider: await ProviderManager.getDefaultProvider() });
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message || 'Failed to set default provider' });
  }
});

router.get('/tenant/:tenantId', async (req, res) => {
  const tenantProvider = await ProviderManager.getTenantProvider(req.params.tenantId);
  res.json({ success: true, tenantProvider });
});

router.put('/tenant/:tenantId', async (req, res) => {
  try {
    const { providerKey, isPrimary } = req.body || {};
    if (!providerKey) return res.status(400).json({ error: 'providerKey is required' });
    const tenantProvider = await ProviderManager.setTenantProvider({
      tenantId: req.params.tenantId,
      providerKey,
      isPrimary,
    });
    const prisma = await getPrisma();
    await writeAuditLog(prisma, req, {
      action: 'provider.tenant_mapping_changed',
      entityType: 'TenantProvider',
      entityId: tenantProvider.id,
      details: { tenantId: req.params.tenantId, providerKey },
    });
    res.json({ success: true, tenantProvider });
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message || 'Failed to update tenant provider mapping' });
  }
});

module.exports = router;
