import 'dotenv/config';

const API = process.env.API_URL || 'http://localhost:3000';
const EMAIL = process.env.SEED_ADMIN_EMAIL || 'admin@asuitech.com';
const PASSWORD = process.env.SEED_ADMIN_PASSWORD || 'Admin@123';

async function main() {
  const { PrismaClient } = await import('../generated/prisma/client.js');
  const { PrismaPg } = await import('@prisma/adapter-pg');

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  });

  try {
    const [userCount, extCount, phoneCount] = await Promise.all([
      prisma.user.count(),
      prisma.extension.count(),
      prisma.phoneNumber.count(),
    ]);

    console.log('=== DATABASE COUNTS ===');
    console.log(JSON.stringify({ users: userCount, extensions: extCount, phoneNumbers: phoneCount }, null, 2));

    const phones = await prisma.phoneNumber.findMany({
      select: {
        id: true,
        number: true,
        tenantId: true,
        extensionId: true,
        assignedUserId: true,
      },
      orderBy: { number: 'asc' },
    });

    const extensions = await prisma.extension.findMany({
      select: { id: true, extensionNumber: true, primaryPhoneNumberId: true, userId: true, tenantId: true },
    });

    const primaryByPhoneId = new Map(
      extensions.filter((e) => e.primaryPhoneNumberId).map((e) => [e.primaryPhoneNumberId!, e.id]),
    );

    console.log('\n=== PHONE NUMBERS (with primaryPhoneNumberId from Extension) ===');
    for (const p of phones) {
      console.log(
        JSON.stringify({
          number: p.number,
          id: p.id,
          extensionId: p.extensionId,
          primaryPhoneNumberId: primaryByPhoneId.get(p.id) ? p.id : null,
          primaryForExtensionId: primaryByPhoneId.get(p.id) || null,
          assignedUserId: p.assignedUserId,
        }),
      );
    }

    // Login
    let loginStatus = 0;
    let loginBody: unknown = null;
    let token = '';
    try {
      const loginRes = await fetch(`${API}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
      });
      loginStatus = loginRes.status;
      loginBody = await loginRes.json();
      token = (loginBody as { accessToken?: string })?.accessToken || '';
    } catch (err) {
      console.log('\n=== LOGIN FAILED ===', err instanceof Error ? err.message : err);
      return;
    }

    console.log('\n=== POST /api/auth/login ===');
    console.log('HTTP status:', loginStatus);
    console.log('accessToken present:', Boolean(token));

    if (!token) {
      console.log('Login body:', JSON.stringify(loginBody, null, 2));
      return;
    }

    const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

    const usersRes = await fetch(`${API}/api/tenant/users`, { headers });
    const usersJson = await usersRes.json();
    console.log('\n=== GET /api/tenant/users ===');
    console.log('HTTP status:', usersRes.status);
    console.log('Response JSON:', JSON.stringify(usersJson, null, 2));
    const apiUsers = Array.isArray((usersJson as { users?: unknown }).users)
      ? (usersJson as { users: unknown[] }).users
      : [];
    console.log('total users returned (API):', apiUsers.length);

    // Exact frontend logic from extension-form-panel.tsx create mode
    const extensionId: string | null = null; // create mode
    const frontendUsersAfterFilter = [...apiUsers]
      .sort((a: { assignedExtension?: { id: string } | null; name: string }, b: { assignedExtension?: { id: string } | null; name: string }) => {
        const aAssigned = Boolean(a.assignedExtension) && a.assignedExtension?.id !== extensionId;
        const bAssigned = Boolean(b.assignedExtension) && b.assignedExtension?.id !== extensionId;
        if (aAssigned !== bAssigned) return aAssigned ? 1 : -1;
        return a.name.localeCompare(b.name);
      })
      .map((user: { id: string; assignedExtension?: { id: string } | null; name: string }) => {
        const taken = Boolean(user.assignedExtension) && user.assignedExtension?.id !== extensionId;
        return { id: user.id, name: user.name, disabled: taken, assignedExtension: user.assignedExtension };
      });

    console.log('total users after frontend sort/map (create mode):', frontendUsersAfterFilter.length);
    console.log('selectable (not disabled):', frontendUsersAfterFilter.filter((u) => !u.disabled).length);
    console.log('frontend filter logic: disabled when assignedExtension exists AND assignedExtension.id !== extensionId (null on create)');
    console.log('users in dropdown:', JSON.stringify(frontendUsersAfterFilter, null, 2));

    // Check if team.users path would fail
    const teamUsersPath = (usersJson as { users?: unknown[] }).users || [];
    console.log('\nFrontend setUsers(team.users || []): length =', teamUsersPath.length);

    const didsRes = await fetch(`${API}/api/tenant/extensions/available-dids`, { headers });
    const didsJson = await didsRes.json();
    console.log('\n=== GET /api/tenant/extensions/available-dids ===');
    console.log('HTTP status:', didsRes.status);
    console.log('Response JSON:', JSON.stringify(didsJson, null, 2));
    const apiAvailable = Array.isArray((didsJson as { available?: unknown }).available)
      ? (didsJson as { available: unknown[] }).available
      : [];
    console.log('total numbers returned (API available):', apiAvailable.length);

    const frontendDids = (didsJson as { available?: unknown[] }).available || [];
    console.log('Frontend setDidOptions(dids.available || []): length =', frontendDids.length);
    console.log('frontend filter on DIDs (create): none — all API available rows rendered as options');

    // Run backend filter locally for comparison
    const { listAvailablePhoneNumbersForExtension } = await import('../lib/extensionOwnership.js');
    const localAvailable = await listAvailablePhoneNumbersForExtension(prisma, (loginBody as { user?: { tenantId?: string } }).user?.tenantId || extensions[0]?.tenantId || '');
    console.log('\n=== listAvailablePhoneNumbersForExtension (direct DB call) ===');
    console.log('count:', localAvailable.length);
    console.log('numbers:', localAvailable.map((r) => r.number));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
