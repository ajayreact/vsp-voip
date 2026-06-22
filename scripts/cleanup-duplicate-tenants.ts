import 'dotenv/config';
import { PrismaClient } from '../generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { removeEmptyDuplicateTenants } from '../lib/tenantCleanup.js';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  const result = await removeEmptyDuplicateTenants(prisma);
  console.log(result.message);
  if (result.removed) {
    console.log(`Removed ${result.removed} tenant(s).`);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
