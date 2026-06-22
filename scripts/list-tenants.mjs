import 'dotenv/config';
import { PrismaClient } from '../generated/prisma/client.js';

const prisma = new PrismaClient();
const tenants = await prisma.tenant.findMany({
  select: {
    id: true,
    name: true,
    createdAt: true,
    _count: { select: { users: true, phoneNumbers: true } },
  },
  orderBy: { createdAt: 'desc' },
});
console.log(JSON.stringify(tenants, null, 2));
console.log('Total:', tenants.length);
await prisma.$disconnect();
