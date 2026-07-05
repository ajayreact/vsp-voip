#!/usr/bin/env node
/**
 * Confirm DESK_FIRST is configured on the pilot extension via Extension.deviceRingStrategy.
 * Usage: npx tsx scripts/check-desk-first-pilot-tenant.ts
 */
import 'dotenv/config';
import { resolveDeviceRingStrategy } from '../lib/ringTargetPolicy.js';

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
          deviceRingStrategy: true,
        },
      },
    },
  });

  if (!phone) {
    console.error(`FAIL — DID ${PILOT_DID} not found in database`);
    process.exit(1);
  }

  const strategy = resolveDeviceRingStrategy(phone.extension);
  const deskFirstConfigured = strategy === 'DESK_FIRST';

  console.log('=== DESK_FIRST pilot extension check ===\n');
  console.log(`DID:              ${phone.number}`);
  console.log(`Tenant:           ${phone.tenant?.name || '—'}`);
  console.log(`Tenant ID:        ${phone.tenantId}`);
  console.log(`Extension:        ${phone.extension?.extensionNumber || '—'} (${phone.extension?.displayName || '—'})`);
  console.log(`Extension ID:     ${phone.extension?.id || '—'}`);
  console.log('');
  console.log(`DB field:           ${phone.extension?.deviceRingStrategy || '—'}`);
  console.log(`Resolved strategy:  ${strategy}`);
  console.log(`DESK_FIRST ready:   ${deskFirstConfigured ? 'YES — safe to deploy' : 'NO — set deviceRingStrategy to DESK_FIRST on this extension'}`);

  await prisma.$disconnect();
  process.exit(deskFirstConfigured ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
