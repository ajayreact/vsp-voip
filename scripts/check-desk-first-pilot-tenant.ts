#!/usr/bin/env node
/**
 * Confirm TEMP_DESK_FIRST_OVERRIDES matches production DID routing.
 * Usage: npx tsx scripts/check-desk-first-pilot-tenant.ts
 */
import 'dotenv/config';
import { TEMP_DESK_FIRST_OVERRIDES } from '../lib/ringTargetPolicy.js';

const PILOT_DID = process.env.DESK_FIRST_PILOT_DID || '+19563961388';

async function main() {
  const { getPrisma } = await import('../db.js');
  const prisma = await getPrisma();

  const phone = await prisma.phoneNumber.findFirst({
    where: { number: PILOT_DID },
    include: {
      tenant: { select: { id: true, name: true } },
      extension: {
        select: {
          id: true,
          tenantId: true,
          extensionNumber: true,
          displayName: true,
        },
      },
    },
  });

  if (!phone) {
    console.error(`FAIL — DID ${PILOT_DID} not found in database`);
    process.exit(1);
  }

  const override = TEMP_DESK_FIRST_OVERRIDES[0];
  const extensionIdMatch = phone.extension?.id === override?.extensionId;
  const tenantMatch = !override?.tenantId || phone.tenantId === override.tenantId;
  const extNumberMatch = !override?.extensionNumber
    || phone.extension?.extensionNumber === override.extensionNumber;
  const overrideApplies = override?.extensionId
    ? extensionIdMatch
    : tenantMatch && extNumberMatch;

  console.log('=== DESK_FIRST pilot tenant check ===\n');
  console.log(`DID:              ${phone.number}`);
  console.log(`Tenant:           ${phone.tenant?.name || '—'}`);
  console.log(`Tenant ID:        ${phone.tenantId}`);
  console.log(`Extension:        ${phone.extension?.extensionNumber || '—'} (${phone.extension?.displayName || '—'})`);
  console.log(`Extension ID:     ${phone.extension?.id || '—'}`);
  console.log('');
  console.log('Configured override:');
  console.log(JSON.stringify(override, null, 2));
  console.log('');
  console.log(`Extension ID match: ${extensionIdMatch ? 'YES' : 'NO'}`);
  if (override?.tenantId) {
    console.log(`Tenant ID match:    ${tenantMatch ? 'YES' : 'NO'}`);
    console.log(`Extension # match:  ${extNumberMatch ? 'YES' : 'NO'}`);
  }
  console.log(`Override applies:   ${overrideApplies ? 'YES — safe to deploy' : 'NO — update TEMP_DESK_FIRST_OVERRIDES'}`);

  await prisma.$disconnect();
  process.exit(overrideApplies ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
