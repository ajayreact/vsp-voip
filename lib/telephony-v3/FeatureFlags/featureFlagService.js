const { getPrisma } = require('../internal/prisma');
const { GLOBAL_FLAGS } = require('../constants');
const {
  getFeatureFlagCache,
  setFeatureFlagCache,
  invalidateFeatureFlagCache,
} = require('../Redis/featureFlagCache');

const DEFAULT_FLAGS = {
  engineEnabled: false,
  deskEnabled: false,
  mobileEnabled: false,
  pstnEnabled: false,
  transferEnabled: false,
  holdEnabled: false,
  recordingEnabled: false,
  voicemailEnabled: false,
  conferenceEnabled: false,
  queueEnabled: false,
  ivrEnabled: false,
  observeOnly: false,
};

function isGlobalEngineEnabled() {
  return process.env[GLOBAL_FLAGS.TELEPHONY_V3_GLOBAL] === 'true';
}

/**
 * @param {string} tenantId
 * @returns {Promise<import('../types').V3FeatureFlagSnapshot>}
 */
async function getTenantFlags(tenantId) {
  const cached = await getFeatureFlagCache(tenantId).catch(() => null);
  if (cached) return /** @type {import('../types').V3FeatureFlagSnapshot} */ (cached);

  const prisma = await getPrisma();
  const row = await prisma.v3FeatureFlag.findUnique({ where: { tenantId } });
  const snapshot = row
    ? {
        tenantId: row.tenantId,
        engineEnabled: row.engineEnabled,
        deskEnabled: row.deskEnabled,
        mobileEnabled: row.mobileEnabled,
        pstnEnabled: row.pstnEnabled,
        transferEnabled: row.transferEnabled,
        holdEnabled: row.holdEnabled ?? false,
        recordingEnabled: row.recordingEnabled,
        voicemailEnabled: row.voicemailEnabled,
        conferenceEnabled: row.conferenceEnabled ?? false,
        queueEnabled: row.queueEnabled ?? false,
        ivrEnabled: row.ivrEnabled ?? false,
        observeOnly: row.observeOnly,
      }
    : { tenantId, ...DEFAULT_FLAGS };

  await setFeatureFlagCache(tenantId, snapshot).catch(() => {});
  return snapshot;
}

/**
 * @param {string} tenantId
 * @param {string} flagName
 */
async function isEnabled(tenantId, flagName) {
  if (!isGlobalEngineEnabled()) return false;
  const flags = await getTenantFlags(tenantId);
  if (!flags.engineEnabled) return false;
  return Boolean(flags[flagName]);
}

/**
 * @param {string} tenantId
 * @param {Partial<import('../types').V3FeatureFlagSnapshot>} patch
 * @param {string} [updatedByUserId]
 */
async function upsertTenantFlags(tenantId, patch, updatedByUserId = null) {
  const prisma = await getPrisma();
  const row = await prisma.v3FeatureFlag.upsert({
    where: { tenantId },
    create: {
      tenantId,
      ...DEFAULT_FLAGS,
      ...patch,
      updatedByUserId,
    },
    update: {
      ...patch,
      updatedByUserId,
      updatedAt: new Date(),
    },
  });
  await invalidateFeatureFlagCache(tenantId);
  return row;
}

async function invalidateFlags(tenantId) {
  await invalidateFeatureFlagCache(tenantId);
}

function getGlobalFlagStatus() {
  return {
    globalEnabled: isGlobalEngineEnabled(),
    ingressEnabled: process.env[GLOBAL_FLAGS.TELEPHONY_V3_INGRESS_ENABLED] === 'true',
    callManagerEnabled: process.env[GLOBAL_FLAGS.TELEPHONY_V3_CALLMANAGER_ENABLED] === 'true',
    outboxPaused: process.env[GLOBAL_FLAGS.TELEPHONY_V3_OUTBOX_PAUSED] === 'true',
    executorEnabled: process.env[GLOBAL_FLAGS.TELEPHONY_V3_EXECUTOR_ENABLED] === 'true',
  };
}

module.exports = {
  getTenantFlags,
  isEnabled,
  upsertTenantFlags,
  invalidateFlags,
  isGlobalEngineEnabled,
  getGlobalFlagStatus,
  DEFAULT_FLAGS,
};
