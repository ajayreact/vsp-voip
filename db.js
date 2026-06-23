require('dotenv').config();

const { createRequire } = require('module');
const localRequire = createRequire(__filename);
const { PrismaPg } = require('@prisma/adapter-pg');

let prisma;
let prismaClientClass;

function resolvePrismaClientExport(mod) {
  const PrismaClient = mod?.PrismaClient ?? mod?.default?.PrismaClient;
  if (typeof PrismaClient !== 'function') {
    throw new Error(
      'PrismaClient export is not a constructor. Run `npx prisma generate` and start the API with `tsx server.js`.',
    );
  }
  return PrismaClient;
}

async function loadPrismaClientClass() {
  if (prismaClientClass) {
    return prismaClientClass;
  }

  const clientSpecifiers = [
    './generated/prisma/client.ts',
    './generated/prisma/client.js',
  ];

  for (const specifier of clientSpecifiers) {
    try {
      prismaClientClass = resolvePrismaClientExport(localRequire(specifier));
      return prismaClientClass;
    } catch {
      // try next specifier or dynamic import
    }
  }

  let lastError;
  for (const specifier of clientSpecifiers) {
    try {
      const mod = await import(specifier);
      prismaClientClass = resolvePrismaClientExport(mod);
      return prismaClientClass;
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError ?? new Error('Failed to load generated Prisma client.');
}

async function getPrisma() {
  if (!prisma) {
    const PrismaClient = await loadPrismaClientClass();
    const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
    prisma = new PrismaClient({ adapter });
  }
  return prisma;
}

module.exports = { getPrisma, loadPrismaClientClass };
