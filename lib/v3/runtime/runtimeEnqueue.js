/**
 * V3 Runtime Enqueue — fire-and-forget hook for V3 mutation services.
 * Never throws; sync is optional behind V3_RUNTIME_SYNC_ENABLED.
 */

const { isRuntimeSyncEnabledForTenant } = require('./runtimeFeatureFlag');

let runtimeSyncService;

function getSyncService() {
  if (!runtimeSyncService) {
    // Lazy require avoids circular dependency during module init.
    // eslint-disable-next-line global-require
    runtimeSyncService = require('./runtimeSyncService');
  }
  return runtimeSyncService;
}

async function enqueueRuntimeSync(prisma, tenantId, entityType, entityId, action = 'sync', { req, payload } = {}) {
  if (!isRuntimeSyncEnabledForTenant(tenantId)) {
    return { enqueued: false, reason: 'disabled' };
  }
  try {
    const job = await getSyncService().enqueue(prisma, tenantId, {
      entityType,
      entityId,
      action,
      payload,
      req,
    });
    return { enqueued: true, jobId: job.id, status: job.status };
  } catch (error) {
    console.warn('[V3 runtime] enqueue failed:', error.message);
    return { enqueued: false, reason: error.message };
  }
}

module.exports = { enqueueRuntimeSync };
