require('dotenv').config();
const { getPrisma } = require('../db');

(async () => {
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
  process.exit(0);
})();
