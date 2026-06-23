require('dotenv').config();

async function main() {
  const { getPrisma } = require('../db');
  const prisma = await getPrisma();

  console.log('phoneNumber delegate:', typeof prisma.phoneNumber);
  console.log('findMany:', typeof prisma.phoneNumber?.findMany);

  try {
    const rows = await prisma.phoneNumber.findMany({ include: { tenant: true } });
    console.log('OK', rows.length);
  } catch (error) {
    console.error('ERROR:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();
