async function removeEmptyDuplicateTenants(prisma) {
  const tenants = await prisma.tenant.findMany({
    include: {
      _count: {
        select: {
          users: true,
          phoneNumbers: true,
          numberOrders: true,
        },
      },
    },
  });

  const emptyIds = tenants
    .filter(
      (t) =>
        t._count.users === 0 &&
        t._count.phoneNumbers === 0 &&
        t._count.numberOrders === 0,
    )
    .map((t) => t.id);

  if (!emptyIds.length) {
    return { removed: 0, message: 'No empty tenant records to remove.' };
  }

  await prisma.callLog.deleteMany({ where: { tenantId: { in: emptyIds } } });
  await prisma.voicemail.deleteMany({ where: { tenantId: { in: emptyIds } } });
  await prisma.callRecording.deleteMany({ where: { tenantId: { in: emptyIds } } });
  await prisma.smsMessage.deleteMany({ where: { tenantId: { in: emptyIds } } });
  await prisma.tenant.deleteMany({ where: { id: { in: emptyIds } } });

  return {
    removed: emptyIds.length,
    message: `Removed ${emptyIds.length} empty duplicate tenant record(s).`,
  };
}

module.exports = { removeEmptyDuplicateTenants };
