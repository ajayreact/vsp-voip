import 'dotenv/config';
import { PrismaClient } from './generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { hashPassword } from './lib/auth.js';

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});
const prisma = new PrismaClient({ adapter });

const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL || 'admin@asuitech.com';
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD || 'Admin@123';
const SUPER_EMAIL = process.env.SEED_SUPER_EMAIL || 'superadmin@vsp-voip.com';
const SUPER_PASSWORD = process.env.SEED_SUPER_PASSWORD || 'Super@123';

async function main() {
  console.log('🌱 Seeding VSP-VOIP database...');

  const tenant = await prisma.tenant.upsert({
    where: { id: '00000000-0000-4000-8000-000000000001' },
    update: {
      name: 'Asuitech Solutions Inc',
      platformFeeSetup: 0,
      platformFeeMonthly: 8,
      platformFeeFirstMonth: 8,
    },
    create: {
      id: '00000000-0000-4000-8000-000000000001',
      name: 'Asuitech Solutions Inc',
      platformFeeSetup: 0,
      platformFeeMonthly: 8,
      platformFeeFirstMonth: 8,
    },
  });

  const passwordHash = await hashPassword(ADMIN_PASSWORD);
  const adminUser = await prisma.user.upsert({
    where: { email: ADMIN_EMAIL },
    update: { passwordHash, name: 'Asuitech Admin', tenantId: tenant.id, role: 'TENANT_ADMIN' },
    create: {
      email: ADMIN_EMAIL,
      passwordHash,
      name: 'Asuitech Admin',
      role: 'TENANT_ADMIN',
      tenantId: tenant.id,
    },
  });

  await prisma.greeting.upsert({
    where: { tenantId: tenant.id },
    update: {
      message: 'Welcome to {company}. Please hold while we connect you.',
      playGreetingBeforeConnect: false,
      ringGroupEnabled: true,
      ringGroupName: 'Mobile agents',
      ringGroupMembers: [
        { type: 'app', userId: adminUser.id, label: 'Asuitech Admin' },
      ],
      ringStrategy: 'simultaneous',
      ringTimeout: 30,
      ivrEnabled: false,
      forwardEnabled: false,
    },
    create: {
      tenantId: tenant.id,
      message: 'Welcome to {company}. Please hold while we connect you.',
      playGreetingBeforeConnect: false,
      ringGroupEnabled: true,
      ringGroupName: 'Mobile agents',
      ringGroupMembers: [
        { type: 'app', userId: adminUser.id, label: 'Asuitech Admin' },
      ],
      ringStrategy: 'simultaneous',
      ringTimeout: 30,
      ivrEnabled: false,
      forwardEnabled: false,
    },
  });

  const superHash = await hashPassword(SUPER_PASSWORD);
  await prisma.user.upsert({
    where: { email: SUPER_EMAIL },
    update: { passwordHash: superHash, name: 'VSP Super Admin', role: 'SUPER_ADMIN', tenantId: null },
    create: {
      email: SUPER_EMAIL,
      passwordHash: superHash,
      name: 'VSP Super Admin',
      role: 'SUPER_ADMIN',
      tenantId: null,
    },
  });

  await prisma.platformSettings.upsert({
    where: { id: 'platform' },
    update: {},
    create: {
      id: 'platform',
      defaultFeeSetup: Number(process.env.BILLING_MARKUP_UPFRONT || 0),
      defaultFeeMonthly: Number(process.env.BILLING_MARKUP_MONTHLY || 8),
    },
  });

  await prisma.phoneNumber.updateMany({
    where: { number: '+13099880196' },
    data: { tenantId: tenant.id },
  });

  console.log('\n✅ Database seeded successfully!');
  console.log('--------------------------------------------------');
  console.log(`🏢 Tenant: ${tenant.name}`);
  console.log(`🆔 Tenant ID: ${tenant.id}`);
  console.log(`👤 Tenant admin: ${ADMIN_EMAIL} / ${ADMIN_PASSWORD}`);
  console.log(`🛡️  Super admin: ${SUPER_EMAIL} / ${SUPER_PASSWORD}`);
  console.log('--------------------------------------------------\n');
}

main()
  .catch((e) => {
    console.error('❌ Seeding error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
