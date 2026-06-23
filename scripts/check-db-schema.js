require('dotenv').config();

async function main() {
  const { getPrisma } = require('../db');
  const prisma = await getPrisma();

  const migrations = await prisma.$queryRaw`
    SELECT migration_name, finished_at
    FROM "_prisma_migrations"
    ORDER BY finished_at DESC
    LIMIT 5
  `;

  const phoneColumns = await prisma.$queryRaw`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'PhoneNumber'
    ORDER BY ordinal_position
  `;

  console.log('Recent migrations:', migrations);
  console.log('PhoneNumber columns:', phoneColumns.length);
  console.log(phoneColumns.map((c) => c.column_name).join(', '));

  try {
    const count = await prisma.phoneNumber.count();
    console.log('phoneNumber.count:', count);
    const rows = await prisma.phoneNumber.findMany({ include: { tenant: true }, take: 1 });
    console.log('findMany+tenant sample:', rows[0]?.number, rows[0]?.tenant?.name);
  } catch (error) {
    console.error('Query failed:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();
