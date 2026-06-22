require('dotenv').config();
const { getPrisma } = require('../db');
const { runBillingIntegrityChecks } = require('../lib/revenueProtection');

async function main() {
  const prisma = await getPrisma();
  const result = await runBillingIntegrityChecks(prisma);
  console.log(JSON.stringify({
    success: true,
    checkedAt: result.checkedAt,
    alertCount: result.alertCount,
    alerts: result.alerts.map((a) => ({ type: a.type, severity: a.severity, message: a.message })),
  }, null, 2));
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
