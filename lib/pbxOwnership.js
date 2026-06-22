const { ensureExtensionTelnyxCredential } = require('./extensionSip');
const {
  loadExtensionPhoneNumber,
  setExtensionPrimaryDid,
} = require('./extensionOwnership');
const { resolveExtensionRingTargets, resolveExtensionForPhoneRecord, resolveDirectUserRingTargets } = require('./inboundRouting');

async function syncTenantPhoneExtensionLinks(prisma, tenantId) {
  const extensions = await prisma.extension.findMany({
    where: { tenantId, userId: { not: null } },
    select: { id: true, userId: true, primaryPhoneNumberId: true, extensionNumber: true },
  });

  let linked = 0;
  for (const extension of extensions) {
    const current = await loadExtensionPhoneNumber(prisma, extension.id);

    if (current) {
      await prisma.phoneNumber.update({
        where: { id: current.id },
        data: {
          assignedUserId: extension.userId,
          routingType: current.routingType === 'tenant_default' ? 'direct_user' : current.routingType,
        },
      });
      if (extension.primaryPhoneNumberId !== current.id) {
        await prisma.extension.update({
          where: { id: extension.id },
          data: { primaryPhoneNumberId: current.id },
        });
      }
      linked += 1;
    } else {
      const candidate = await prisma.phoneNumber.findFirst({
        where: { tenantId, assignedUserId: extension.userId, extensionId: null },
        orderBy: { createdAt: 'asc' },
      });
      if (candidate) {
        await setExtensionPrimaryDid(prisma, tenantId, extension.id, candidate.id, {});
        linked += 1;
      }
    }

    const extRow = await prisma.extension.findUnique({ where: { id: extension.id } });
    if (extRow) {
      await ensureExtensionTelnyxCredential(prisma, extRow);
    }
  }

  return { linked, extensions: extensions.length };
}

async function resolveOwnershipChain(prisma, tenantId, phoneNumberOrId) {
  const phone = await prisma.phoneNumber.findFirst({
    where: {
      tenantId,
      OR: [
        { id: String(phoneNumberOrId) },
        { number: String(phoneNumberOrId) },
      ],
    },
    include: {
      extension: {
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              telnyxSipUsername: true,
              telnyxCredentialId: true,
              sipRegistered: true,
              devices: { orderBy: { lastSeenAt: 'desc' }, take: 5 },
            },
          },
          devices: { orderBy: { lastRegistrationAt: 'desc' } },
        },
      },
      assignedUser: { select: { id: true, name: true, email: true, telnyxSipUsername: true } },
    },
  });

  if (!phone) {
    return { ok: false, error: 'Phone number not found', phone: null };
  }

  let extension = phone.extension;
  if (!extension && phone.assignedUserId) {
    extension = await prisma.extension.findFirst({
      where: { tenantId, userId: phone.assignedUserId, status: 'ACTIVE' },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            telnyxSipUsername: true,
            telnyxCredentialId: true,
            devices: { orderBy: { lastSeenAt: 'desc' }, take: 5 },
          },
        },
        devices: { orderBy: { lastRegistrationAt: 'desc' } },
      },
    });
  }

  const employee = extension?.user || phone.assignedUser;
  const linkedPhone = extension ? await loadExtensionPhoneNumber(prisma, extension.id) : null;
  const primary = linkedPhone || (extension?.primaryPhoneNumberId === phone.id ? phone : null);

  const ringExtension = extension || await resolveExtensionForPhoneRecord(prisma, tenantId, phone);
  const ringResolution = ringExtension
    ? await resolveExtensionRingTargets(prisma, ringExtension, null)
    : await resolveDirectUserRingTargets(prisma, phone, null);
  const hasRingTarget = Boolean(ringResolution?.targets?.length);
  const onlineDevices = (extension?.devices || []).filter((d) => d.status === 'ONLINE');
  const hasDeskCredentials = Boolean(
    extension?.telnyxCredentialId && extension?.telnyxSipUsername,
  );
  const hasAppCredentials = Boolean(employee?.telnyxSipUsername);
  const hasSipCredentials = hasDeskCredentials || hasAppCredentials;

  const issues = [];
  if (!phone.isActive) issues.push('Phone number is suspended');
  if (!extension) issues.push('No extension linked');
  if (extension && !extension.userId) issues.push('Extension has no employee');
  if (!employee) issues.push('No employee assigned');
  if (extension && !hasSipCredentials) {
    issues.push('Extension has no SIP credentials');
  }
  if (!hasRingTarget && hasSipCredentials && employee) {
    issues.push('Ring target resolution returned empty (credential may be stale)');
  }
  if (phone.routingType === 'tenant_default' && !phone.extensionId) {
    issues.push('Routing is tenant_default — assign to extension for direct routing');
  }
  if (extension && linkedPhone && linkedPhone.id !== phone.id) {
    issues.push('Extension is linked to a different DID');
  }
  if (linkedPhone && linkedPhone.extensionId !== extension?.id) {
    issues.push('DID extension link mismatch');
  }

  const canReceiveInbound = phone.isActive !== false
    && Boolean(extension)
    && Boolean(employee)
    && hasSipCredentials
    && (hasRingTarget || onlineDevices.length > 0);

  return {
    ok: issues.length === 0,
    issues,
    canReceiveInbound,
    phone: {
      id: phone.id,
      number: phone.number,
      routingType: phone.routingType,
      extensionId: phone.extensionId,
      assignedUserId: phone.assignedUserId,
      isActive: phone.isActive !== false,
    },
    extension: extension
      ? {
        id: extension.id,
        extensionNumber: extension.extensionNumber,
        displayName: extension.displayName,
        status: extension.status,
        primaryPhoneNumberId: extension.primaryPhoneNumberId,
        primaryDid: primary?.number || phone.number || null,
        sipUsername: extension.telnyxSipUsername || extension.sipUsername || extension.extensionNumber,
        hasSipCredentials: hasDeskCredentials,
        deskRegistered: Boolean(extension.sipRegistered),
      }
      : null,
    employee: employee
      ? {
        id: employee.id,
        name: employee.name,
        email: employee.email,
        sipUsername: extension?.telnyxSipUsername || extension?.sipUsername || employee.telnyxSipUsername || null,
        hasCredential: hasDeskCredentials || Boolean(employee.telnyxCredentialId),
        deskRegistered: Boolean(extension?.sipRegistered),
        mobileDevices: employee.devices?.length || 0,
        sipRegistered: Boolean(employee.sipRegistered),
      }
      : null,
    devices: (extension?.devices || []).map((d) => ({
      type: d.deviceType,
      name: d.deviceName,
      status: d.status,
      lastSeen: d.lastRegistrationAt?.toISOString?.() || null,
    })),
    registeredDevices: onlineDevices.map((d) => ({
      type: d.deviceType,
      name: d.deviceName,
      status: d.status,
    })),
    inbound: {
      canRingEmployee: hasRingTarget,
      canReceiveInbound,
      targetCount: ringResolution?.targets?.length || 0,
      chain: phone.number,
      resolvesTo: employee?.name || null,
    },
  };
}

async function validateTenantNumbersChain(prisma, tenantId) {
  const numbers = await prisma.phoneNumber.findMany({
    where: { tenantId },
    orderBy: { number: 'asc' },
  });

  const results = [];
  for (const row of numbers) {
    results.push(await resolveOwnershipChain(prisma, tenantId, row.id));
  }

  return {
    total: numbers.length,
    passing: results.filter((r) => r.ok).length,
    failing: results.filter((r) => !r.ok).length,
    results,
  };
}

module.exports = {
  syncTenantPhoneExtensionLinks,
  resolveOwnershipChain,
  validateTenantNumbersChain,
};
