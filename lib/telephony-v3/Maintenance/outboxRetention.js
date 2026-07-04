const { getPrisma } = require('../internal/prisma');
const { RETENTION } = require('../constants');
const { v3Logger } = require('../Utils/v3Logger');
const { metrics } = require('../Utils/metrics');

/**
 * Purge old ACKED and DEAD outbox rows.
 * @param {{ ackedDays?: number, deadDays?: number }} [options]
 */
async function purgeOutboxRows(options = {}) {
  const ackedDays = options.ackedDays ?? RETENTION.OUTBOX_ACKED_DAYS;
  const deadDays = options.deadDays ?? RETENTION.OUTBOX_DEAD_DAYS;
  const prisma = await getPrisma();
  const ackedCutoff = new Date(Date.now() - ackedDays * 86400000);
  const deadCutoff = new Date(Date.now() - deadDays * 86400000);

  const acked = await prisma.v3CommandOutbox.deleteMany({
    where: { status: 'ACKED', updatedAt: { lt: ackedCutoff } },
  });
  const dead = await prisma.v3CommandOutbox.deleteMany({
    where: { status: 'DEAD', updatedAt: { lt: deadCutoff } },
  });

  const total = acked.count + dead.count;
  if (total > 0) {
    metrics.outboxCleanupTotal({ acked: String(acked.count), dead: String(dead.count) });
    v3Logger.info('outbox.retention.purged', {
      acked: acked.count,
      dead: dead.count,
      ackedDays,
      deadDays,
    });
  }

  return { acked: acked.count, dead: dead.count };
}

module.exports = {
  purgeOutboxRows,
};
