const { getPrisma } = require('../internal/prisma');
const { RETENTION } = require('../constants');
const { v3Logger } = require('../Utils/v3Logger');

/**
 * Purge ProcessedTelnyxEvent rows older than retention window.
 * @param {number} [retentionDays]
 * @returns {Promise<{ deleted: number }>}
 */
async function purgeProcessedTelnyxEvents(retentionDays = RETENTION.PROCESSED_EVENT_DAYS) {
  const days = Math.max(retentionDays, 1);
  const cutoff = new Date(Date.now() - days * 86400 * 1000);
  const prisma = await getPrisma();
  const result = await prisma.processedTelnyxEvent.deleteMany({
    where: { processedAt: { lt: cutoff } },
  });
  if (result.count > 0) {
    v3Logger.info('maintenance.purge_processed_events', { deleted: result.count, retentionDays: days });
  }
  return { deleted: result.count };
}

module.exports = { purgeProcessedTelnyxEvents };
