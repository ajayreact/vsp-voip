import 'dotenv/config';
import { PrismaClient } from '../generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  const tenants = await prisma.tenant.findMany({
    select: {
      id: true,
      name: true,
      createdAt: true,
      _count: { select: { users: true, phoneNumbers: true, numberOrders: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  console.log(JSON.stringify(tenants, null, 2));
  console.log('Total:', tenants.length);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
