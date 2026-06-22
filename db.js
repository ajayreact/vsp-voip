require('dotenv').config();

const { PrismaPg } = require('@prisma/adapter-pg');

let prisma;

async function getPrisma() {
  if (!prisma) {
    const { PrismaClient } = await import('./generated/prisma/client.ts');
    const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
    prisma = new PrismaClient({ adapter });
  }
  return prisma;
}

module.exports = { getPrisma };
