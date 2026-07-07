import 'dotenv/config';
import { getPrisma } from '../db.js';

const prisma = await getPrisma();
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
