require('dotenv').config();
const { getPrisma } = require('../db');

async function main() {
  const prisma = await getPrisma();
  const tenants = await prisma.tenant.findMany();
  const numbers = await prisma.phoneNumber.findMany({ include: { tenant: true } });

  console.log('Tenants:', tenants.length);
  for (const t of tenants) console.log(`  ${t.id}  ${t.name}`);
  console.log('Numbers:', numbers.length);
  for (const n of numbers) console.log(`  ${n.number}  ->  ${n.tenant.name}`);

  await prisma.$disconnect();
}

main().catch(console.error);
