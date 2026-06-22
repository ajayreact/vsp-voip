const { getPrisma } = require('../db');
const { runBillingIntegrityChecks } = require('./revenueProtection');
const { logger } = require('./logger');

async function runBillingIntegrityJob() {
  const prisma = await getPrisma();
  const result = await runBillingIntegrityChecks(prisma);
  logger.info('billing_integrity_job_complete', {
    alertCount: result.alertCount,
    checkedAt: result.checkedAt,
  });
  return result;
}

function startBillingIntegrityScheduler() {
  const intervalMs = Number(process.env.BILLING_INTEGRITY_INTERVAL_MS || 24 * 60 * 60 * 1000);

  runBillingIntegrityJob().catch((err) => {
    logger.error('billing_integrity_job_failed', { error: err.message });
  });

  setInterval(() => {
    runBillingIntegrityJob().catch((err) => {
      logger.error('billing_integrity_job_failed', { error: err.message });
    });
  }, intervalMs);

  logger.info('billing_integrity_scheduler_started', { intervalMs });
}

module.exports = {
  runBillingIntegrityJob,
  startBillingIntegrityScheduler,
};
