#!/usr/bin/env node
/**
 * Development-only tenant PBX reset.
 *
 * Clears tenant PBX operational data (extensions, employees, ring groups,
 * devices, QR tokens, greetings, forwarding) while preserving purchased DIDs,
 * billing, platform settings, and admin accounts.
 *
 * Call history and SMS are preserved by default. Pass --clear-call-history
 * for a complete communications wipe.
 *
 * Usage:
 *   node scripts/reset-tenant-pbx-data.js --tenant-id=<uuid> --dry-run
 *   node scripts/reset-tenant-pbx-data.js --tenant-id=<uuid> --confirm
 *   node scripts/reset-tenant-pbx-data.js --all-tenants --confirm
 *   node scripts/reset-tenant-pbx-data.js --tenant-id=<uuid> --confirm --clear-call-history
 *
 * Options:
 *   --confirm                 Required to execute (not dry-run)
 *   --tenant-id=<uuid>        Reset one tenant
 *   --all-tenants             Reset PBX data for every tenant
 *   --dry-run                 Show counts only; no writes
 *   --clear-call-history      Also remove call logs, recordings, voicemail, SMS
 *   --skip-telnyx             Do not delete employee Telnyx SIP credentials via API
 *   --skip-redis              Do not flush tenant SIP presence keys in Redis
 */
require('dotenv').config();

const { getPrisma } = require('../db');
const {
  assertDevelopmentEnvironment,
  resetTenantPbxData,
  resetAllTenantsPbxData,
} = require('../lib/tenantPbxReset');

function parseArgs(argv) {
  const options = {
    confirm: false,
    dryRun: false,
    tenantId: null,
    allTenants: false,
    clearCallHistory: false,
    skipTelnyx: false,
    flushRedis: true,
  };

  for (const arg of argv) {
    if (arg === '--confirm') options.confirm = true;
    else if (arg === '--dry-run') options.dryRun = true;
    else if (arg === '--all-tenants') options.allTenants = true;
    else if (arg === '--clear-call-history') options.clearCallHistory = true;
    else if (arg === '--skip-telnyx') options.skipTelnyx = true;
    else if (arg === '--skip-redis') options.flushRedis = false;
    else if (arg.startsWith('--tenant-id=')) options.tenantId = arg.slice('--tenant-id='.length).trim();
    else if (arg === '--help' || arg === '-h') options.help = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }

  return options;
}

function printHelp() {
  console.log(`Development tenant PBX reset

Examples:
  node scripts/reset-tenant-pbx-data.js --tenant-id=<uuid> --dry-run
  node scripts/reset-tenant-pbx-data.js --tenant-id=<uuid> --confirm
  node scripts/reset-tenant-pbx-data.js --tenant-id=<uuid> --confirm --clear-call-history
  node scripts/reset-tenant-pbx-data.js --all-tenants --confirm

Default:
  Preserves call history, recordings metadata, voicemail metadata, and SMS history.

Safety:
  Refuses when NODE_ENV=production.
  Refuses when API_PUBLIC_URL contains vspphone.com unless ALLOW_DEV_RESET_ON_VSPPHONE=1.
`);
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    printHelp();
    return;
  }

  if (!options.tenantId && !options.allTenants) {
    throw new Error('Specify --tenant-id=<uuid> or --all-tenants');
  }
  if (options.tenantId && options.allTenants) {
    throw new Error('Use either --tenant-id or --all-tenants, not both');
  }
  if (!options.dryRun && !options.confirm) {
    throw new Error('Refusing to run without --confirm. Use --dry-run to preview.');
  }

  assertDevelopmentEnvironment();

  const prisma = await getPrisma();
  const resetOptions = {
    dryRun: options.dryRun,
    clearCallHistory: options.clearCallHistory,
    skipTelnyx: options.skipTelnyx,
    flushRedis: options.flushRedis,
  };

  const report = options.allTenants
    ? await resetAllTenantsPbxData(prisma, resetOptions)
    : await resetTenantPbxData(prisma, options.tenantId, resetOptions);

  console.log(JSON.stringify(report, null, 2));

  await prisma.$disconnect();

  const ok = report.ok !== false && (report.results ? report.results.every((row) => row.ok || row.dryRun) : true);
  process.exit(ok ? 0 : 1);
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
