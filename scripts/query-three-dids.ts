import 'dotenv/config';

async function main() {
  const { getPrisma } = await import('../db.js');
  const prisma = await getPrisma();
  const nums = ['+19563961388', '+17748123836', '+13099880196'];
  for (const n of nums) {
    const p = await prisma.phoneNumber.findFirst({
      where: { number: n },
      include: {
        extension: { select: { extensionNumber: true, primaryPhoneNumberId: true, userId: true, displayName: true } },
        assignedUser: { select: { name: true, email: true } },
      },
    });
    console.log(JSON.stringify({
      number: n,
      routingType: p?.routingType,
      extensionId: p?.extensionId,
      assignedUserId: p?.assignedUserId,
      label: p?.label,
      isActive: p?.isActive,
      ext: p?.extension,
      assignedUser: p?.assignedUser,
    }, null, 2));
  }
  await prisma.$disconnect();
}

main();
