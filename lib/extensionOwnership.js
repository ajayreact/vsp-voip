const { writeExtensionAuditLog } = require('./extensionSecurity');

const { ensureEmployeeTelephonyForExtension } = require('./employeeTelephony');
const { loadCredentialConnectionId } = require('./telnyxSipProfile');
const { resetUserTelephonyCredential } = require('./softphone');



function registrationStatusForType(devices, type) {

  const ofType = (devices || []).filter((d) => d.deviceType === type);

  if (!ofType.length) {

    return { status: 'UNREGISTERED', lastSeen: null, deviceName: null };

  }

  const online = ofType.find((d) => d.status === 'ONLINE');

  const latest = ofType.reduce((best, device) => {

    if (!device.lastRegistrationAt) return best;

    const ts = new Date(device.lastRegistrationAt).getTime();

    return !best || ts > best.ts ? { ts, device } : best;

  }, null);



  const representative = online || ofType[0];

  return {

    status: online ? 'ONLINE' : representative.status || 'OFFLINE',

    lastSeen: latest?.device?.lastRegistrationAt?.toISOString?.()

      || latest?.device?.lastRegistrationAt

      || null,

    deviceName: representative.deviceName || null,

    count: ofType.length,

  };

}



function serializePhoneNumber(row, { isPrimary = false } = {}) {

  if (!row) return null;

  return {

    id: row.id,

    number: row.number,

    label: row.label || null,

    routingType: row.routingType || 'tenant_default',

    isActive: row.isActive !== false,

    isPrimary: Boolean(isPrimary),

  };

}



function resolveExtensionPhoneNumber(extension, linkedPhone) {

  if (linkedPhone) return linkedPhone;

  if (extension?.primaryPhoneNumber) return extension.primaryPhoneNumber;

  const fromUser = extension?.user?.assignedNumbers?.[0];

  return fromUser || null;

}



function resolveInboundRecipient(extension, devices, ownership) {

  const employeeName = extension.user?.name || extension.displayName || 'Unassigned';



  if (extension.status !== 'ACTIVE') {

    return {

      type: 'disabled',

      label: 'Extension disabled',

      employeeName,

    };

  }



  if (extension.doNotDisturb) {

    return {

      type: 'dnd',

      label: `${employeeName} (Do not disturb)`,

      employeeName,

    };

  }



  const onlineDevices = (devices || []).filter((d) => d.status === 'ONLINE');

  if (onlineDevices.length) {

    const deviceLabels = onlineDevices.map(

      (d) => `${d.deviceType}${d.deviceName ? ` (${d.deviceName})` : ''}`,

    );

    return {

      type: 'employee_devices',

      label: `${employeeName} — ${deviceLabels.join(', ')}`,

      employeeName,

      deviceCount: onlineDevices.length,

    };

  }



  if (ownership?.primaryDid) {

    return {

      type: 'voicemail_fallback',

      label: `${employeeName} — no devices online; calls go to voicemail on ${ownership.primaryDid.number}`,

      employeeName,

    };

  }



  return {

    type: 'unassigned',

    label: `${employeeName} — no registered devices`,

    employeeName,

  };

}



function buildOwnershipPayload(extension, devices, phoneNumber) {

  const primaryDid = serializePhoneNumber(phoneNumber, { isPrimary: true });



  const deviceRegistration = {

    mobile: registrationStatusForType(devices, 'MOBILE'),

    webrtc: registrationStatusForType(devices, 'WEBRTC'),

    sip: registrationStatusForType(devices, 'SIP'),

  };



  const lastSeen = (devices || []).reduce((latest, device) => {

    if (!device.lastRegistrationAt) return latest;

    const ts = new Date(device.lastRegistrationAt).getTime();

    return !latest || ts > latest ? ts : latest;

  }, null);



  return {

    employee: {

      userId: extension.userId || null,

      name: extension.user?.name || extension.displayName,

      email: extension.user?.email || extension.email || null,

      department: extension.department || null,

    },

    primaryDid,

    assignedDidNumber: primaryDid?.number || null,

    deviceRegistration,

    lastSeen: lastSeen ? new Date(lastSeen).toISOString() : null,

    inboundRecipient: resolveInboundRecipient(extension, devices, { primaryDid }),

  };

}



async function loadExtensionPhoneNumber(prisma, extensionId) {

  return prisma.phoneNumber.findFirst({

    where: { extensionId },

    orderBy: [{ createdAt: 'asc' }],

  });

}



async function loadExtensionPhoneNumbers(prisma, extensionId) {

  const phone = await loadExtensionPhoneNumber(prisma, extensionId);

  return phone ? [phone] : [];

}



/** Release employee from all other extensions before reassignment (clears DID links). */
async function releaseEmployeeFromOtherExtensions(prisma, tenantId, userId, exceptExtensionId = null) {
  if (!userId) return [];

  const released = await prisma.extension.findMany({
    where: {
      tenantId,
      userId,
      status: 'ACTIVE',
      ...(exceptExtensionId ? { id: { not: exceptExtensionId } } : {}),
    },
    select: { id: true, primaryPhoneNumberId: true },
  });

  if (!released.length) return [];

  for (const ext of released) {
    const phoneIds = new Set();
    const linked = await prisma.phoneNumber.findMany({
      where: { tenantId, extensionId: ext.id },
      select: { id: true, assignedUserId: true },
    });
    for (const row of linked) phoneIds.add(row.id);
    if (ext.primaryPhoneNumberId) phoneIds.add(ext.primaryPhoneNumberId);

    for (const phoneId of phoneIds) {
      const phone = await prisma.phoneNumber.findUnique({ where: { id: phoneId } });
      if (!phone) continue;
      await prisma.phoneNumber.update({
        where: { id: phoneId },
        data: {
          extensionId: null,
          ...(phone.assignedUserId === userId ? { assignedUserId: null } : {}),
        },
      });
    }

    await prisma.extension.update({
      where: { id: ext.id },
      data: { userId: null, primaryPhoneNumberId: null },
    });
  }

  return released.map((ext) => ext.id);
}



async function assertDidNotAssignedElsewhere(prisma, tenantId, phone, targetExtensionId) {

  if (!phone.extensionId || phone.extensionId === targetExtensionId) return;



  const other = await prisma.extension.findFirst({

    where: { id: phone.extensionId, tenantId },

    select: { extensionNumber: true, displayName: true },

  });

  const label = other

    ? `extension ${other.extensionNumber} (${other.displayName})`

    : 'another extension';

  throw Object.assign(

    new Error(`This number is already assigned to ${label}`),

    { status: 400 },

  );

}



async function setExtensionPrimaryDid(prisma, tenantId, extensionId, phoneNumberId, actor = {}, options = {}) {
  const extension = await prisma.extension.findFirst({ where: { id: extensionId, tenantId } });
  if (!extension) throw Object.assign(new Error('Extension not found'), { status: 404 });

  const current = await loadExtensionPhoneNumber(prisma, extensionId);

  if (!phoneNumberId) {
    if (current) {
      await prisma.phoneNumber.update({
        where: { id: current.id },
        data: { extensionId: null },
      });
      await prisma.extension.update({
        where: { id: extensionId },
        data: { primaryPhoneNumberId: null },
      });
      await writeExtensionAuditLog(prisma, {
        tenantId,
        extensionId,
        userId: actor.userId,
        userEmail: actor.userEmail,
        category: 'ownership',
        action: 'phone_number.unassigned',
        summary: `Unassigned ${current.number} from extension ${extension.extensionNumber}`,
        changes: { phoneNumberId: current.id, number: current.number },
      });
    }
    return null;
  }

  const normalizedPhoneId = String(phoneNumberId);
  if (current?.id === normalizedPhoneId) return current;

  const phone = await prisma.phoneNumber.findFirst({
    where: { id: normalizedPhoneId, tenantId },
  });
  if (!phone) throw Object.assign(new Error('Phone number not found'), { status: 404 });

  if (phone.extensionId && phone.extensionId !== extensionId) {
    if (!options.allowMove) {
      await assertDidNotAssignedElsewhere(prisma, tenantId, phone, extensionId);
    } else {
      await prisma.extension.updateMany({
        where: { id: phone.extensionId, primaryPhoneNumberId: phone.id },
        data: { primaryPhoneNumberId: null },
      });
      await prisma.phoneNumber.update({
        where: { id: phone.id },
        data: { extensionId: null },
      });
    }
  }

  if (current && current.id !== normalizedPhoneId) {
    await prisma.phoneNumber.update({
      where: { id: current.id },
      data: { extensionId: null },
    });
  }

  const assignedUserId = extension.userId || phone.assignedUserId;

  await prisma.phoneNumber.update({

    where: { id: phone.id },

    data: {

      extensionId: extension.id,

      assignedUserId: assignedUserId || null,

      routingType: phone.routingType === 'tenant_default' ? 'direct_user' : phone.routingType,

    },

  });



  await prisma.extension.update({

    where: { id: extensionId },

    data: { primaryPhoneNumberId: phone.id },

  });



  await writeExtensionAuditLog(prisma, {

    tenantId,

    extensionId,

    userId: actor.userId,

    userEmail: actor.userEmail,

    category: 'ownership',

    action: 'phone_number.assigned',

    summary: `Assigned ${phone.number} to extension ${extension.extensionNumber}`,

    changes: {

      phoneNumberId: phone.id,

      number: phone.number,

      replacedNumber: current?.number || null,

    },

  });



  return phone;

}



async function syncPhoneNumbersForExtension(prisma, tenantId, extension, { userId } = {}) {

  const targetUserId = userId !== undefined ? userId : extension.userId;

  if (!targetUserId) return null;



  const user = await prisma.user.findFirst({ where: { id: targetUserId, tenantId } });

  if (!user) return null;



  const existing = await loadExtensionPhoneNumber(prisma, extension.id);

  if (existing) {

    await prisma.phoneNumber.update({

      where: { id: existing.id },

      data: {

        assignedUserId: targetUserId,

        routingType: existing.routingType === 'tenant_default' ? 'direct_user' : existing.routingType,

      },

    });

    return existing;

  }



  const candidate = await prisma.phoneNumber.findFirst({

    where: { tenantId, assignedUserId: targetUserId, extensionId: null },

    orderBy: { createdAt: 'asc' },

  });

  if (!candidate) return null;



  return setExtensionPrimaryDid(prisma, tenantId, extension.id, candidate.id, {});

}



async function reassignExtensionEmployee(prisma, tenantId, extensionId, body, actor = {}) {

  const userId = String(body.userId || '').trim();

  if (!userId) {

    throw Object.assign(new Error('userId is required'), { status: 400 });

  }



  const extension = await prisma.extension.findFirst({

    where: { id: extensionId, tenantId },

    include: { user: true },

  });

  if (!extension) throw Object.assign(new Error('Extension not found'), { status: 404 });



  const newUser = await prisma.user.findFirst({ where: { id: userId, tenantId } });

  if (!newUser) throw Object.assign(new Error('Employee not found in this organization'), { status: 400 });



  const previousUserId = extension.userId;

  const linkedPhone = await loadExtensionPhoneNumber(prisma, extensionId);



  await prisma.$transaction(async (tx) => {
    await releaseEmployeeFromOtherExtensions(tx, tenantId, newUser.id, extensionId);

    await tx.extension.update({

      where: { id: extensionId },

      data: {

        userId: newUser.id,

        displayName: body.keepDisplayName ? extension.displayName : newUser.name,

        email: body.keepEmail ? extension.email : newUser.email,

        department: body.department !== undefined

          ? (body.department || null)

          : extension.department,

        lastActivityAt: new Date(),

      },

    });



    if (linkedPhone) {

      await tx.phoneNumber.update({

        where: { id: linkedPhone.id },

        data: {

          assignedUserId: newUser.id,

          extensionId: extension.id,

          routingType: linkedPhone.routingType === 'tenant_default' ? 'direct_user' : linkedPhone.routingType,

        },

      });

    }

  });



  const updatedExtension = await prisma.extension.findFirst({
    where: { id: extensionId, tenantId },
  });
  if (updatedExtension) {
    await syncPhoneNumbersForExtension(prisma, tenantId, updatedExtension, { userId: newUser.id });
  }



  if (body.forceLogoutPrevious !== false && previousUserId && previousUserId !== newUser.id) {

    await forceLogoutUserDevices(prisma, tenantId, previousUserId);

  }



  await writeExtensionAuditLog(prisma, {

    tenantId,

    extensionId,

    userId: actor.userId,

    userEmail: actor.userEmail,

    category: 'ownership',

    action: 'employee.reassigned',

    summary: `Extension reassigned to ${newUser.name}`,

    changes: {

      before: { userId: previousUserId, userName: extension.user?.name },

      after: { userId: newUser.id, userName: newUser.name },

      didTransferred: linkedPhone?.number || null,

    },

  });



  return { extensionId, userId: newUser.id, userName: newUser.name };

}



async function forceLogoutUserDevices(prisma, tenantId, userId) {

  const user = await prisma.user.findFirst({ where: { id: userId, tenantId } });

  if (!user) return { loggedOut: false };



  await prisma.userDevice.deleteMany({ where: { userId } });

  await prisma.user.update({

    where: { id: userId },

    data: {

      softphoneOnlineAt: null,

      sipRegistered: false,

      sipRegistrationCheckedAt: new Date(),

      sipRegistrationResponse: 'admin force logout',

      sipRegistrationSource: null,

      pushDeviceToken: null,

      pushDevicePlatform: null,

      pushTokenUpdatedAt: null,

    },

  });



  return { loggedOut: true, userId };

}



async function forceLogoutExtensionDevices(prisma, tenantId, extensionId, actor = {}) {

  const extension = await prisma.extension.findFirst({ where: { id: extensionId, tenantId } });

  if (!extension) throw Object.assign(new Error('Extension not found'), { status: 404 });

  if (!extension.userId) {

    throw Object.assign(new Error('Extension has no assigned employee'), { status: 400 });

  }



  const result = await forceLogoutUserDevices(prisma, tenantId, extension.userId);



  await writeExtensionAuditLog(prisma, {

    tenantId,

    extensionId,

    userId: actor.userId,

    userEmail: actor.userEmail,

    category: 'ownership',

    action: 'devices.force_logout',

    summary: 'All employee devices logged out',

  });



  return result;

}



async function resetExtensionSipCredentials(prisma, tenantId, extensionId, actor = {}) {
  const extension = await prisma.extension.findFirst({
    where: { id: extensionId, tenantId },
    include: { user: true },
  });

  if (!extension) throw Object.assign(new Error('Extension not found'), { status: 404 });
  if (!extension.userId) {
    throw Object.assign(new Error('Assign an employee before resetting SIP credentials'), { status: 400 });
  }

  const connectionId = await loadCredentialConnectionId(prisma);
  if (!connectionId) {
    throw Object.assign(new Error('Credential connection is not configured'), { status: 503 });
  }

  const previousCredentialId = extension.user?.telnyxCredentialId || null;

  let telephony;
  try {
    telephony = await resetUserTelephonyCredential({
      prisma,
      userId: extension.userId,
      tenantId,
      connectionId,
    });
  } catch (error) {
    throw Object.assign(
      new Error(error.message || 'Failed to reset employee SIP credentials'),
      { status: error.status || 502 },
    );
  }

  await ensureEmployeeTelephonyForExtension(prisma, extension);

  const refreshedUser = await prisma.user.findUnique({ where: { id: extension.userId } });

  await writeExtensionAuditLog(prisma, {
    tenantId,
    extensionId,
    userId: actor.userId,
    userEmail: actor.userEmail,
    category: 'ownership',
    action: 'sip.credentials_reset',
    summary: `Employee SIP credentials reset for extension ${extension.extensionNumber}`,
    changes: {
      previousCredentialId,
      newCredentialId: telephony?.credentialId || refreshedUser?.telnyxCredentialId || null,
      telnyxSipUsername: refreshedUser?.telnyxSipUsername || null,
    },
  });

  return {
    reset: true,
    sipUsername: refreshedUser?.telnyxSipUsername || null,
    sipPassword: refreshedUser?.telnyxSipPassword || null,
    previousCredentialId,
    newCredential: telephony?.credentialId || refreshedUser?.telnyxCredentialId
      ? {
        credentialId: telephony?.credentialId || refreshedUser?.telnyxCredentialId,
        sipUsername: refreshedUser?.telnyxSipUsername,
        sipPassword: refreshedUser?.telnyxSipPassword || null,
      }
      : null,
  };
}

async function listAvailablePhoneNumbersForExtension(prisma, tenantId, { forExtensionId } = {}) {
  const extensions = await prisma.extension.findMany({
    where: { tenantId },
    select: { id: true, primaryPhoneNumberId: true },
  });

  const blockedNumberIds = new Set();
  const otherExtensionIds = [];

  for (const ext of extensions) {
    if (ext.primaryPhoneNumberId && ext.id !== forExtensionId) {
      blockedNumberIds.add(ext.primaryPhoneNumberId);
    }
    if (ext.id !== forExtensionId) {
      otherExtensionIds.push(ext.id);
    }
  }

  if (otherExtensionIds.length) {
    const linkedElsewhere = await prisma.phoneNumber.findMany({
      where: {
        tenantId,
        extensionId: { in: otherExtensionIds },
      },
      select: { id: true },
    });
    for (const row of linkedElsewhere) {
      blockedNumberIds.add(row.id);
    }
  }

  return prisma.phoneNumber.findMany({
    where: {
      tenantId,
      id: { notIn: [...blockedNumberIds] },
      OR: forExtensionId
        ? [{ extensionId: null }, { extensionId: forExtensionId }]
        : [{ extensionId: null }],
    },
    orderBy: [{ number: 'asc' }],
  });
}



async function listExtensionPhoneNumbersContext(prisma, tenantId, extensionId) {

  const extension = await prisma.extension.findFirst({

    where: { id: extensionId, tenantId },

    include: {

      primaryPhoneNumber: true,

      user: {

        select: {

          assignedNumbers: {

            take: 1,

            select: { id: true, number: true, label: true, routingType: true, isActive: true },

          },

        },

      },

    },

  });

  if (!extension) throw Object.assign(new Error('Extension not found'), { status: 404 });



  const linked = await loadExtensionPhoneNumber(prisma, extensionId);

  const primary = resolveExtensionPhoneNumber(extension, linked);

  const available = await listAvailablePhoneNumbersForExtension(prisma, tenantId, {
    forExtensionId: extensionId,
  });



  return {

    primaryDid: serializePhoneNumber(primary, { isPrimary: true }),

    available: available.map((row) => serializePhoneNumber(row)),

    primaryPhoneNumberId: primary?.id || extension.primaryPhoneNumberId || null,

  };

}



async function assignPhoneNumberToExtension(prisma, tenantId, extensionId, phoneNumberId, options = {}, actor = {}) {
  return setExtensionPrimaryDid(prisma, tenantId, extensionId, phoneNumberId, actor, options);
}



async function unassignPhoneNumberFromExtension(prisma, tenantId, extensionId, phoneNumberId, actor = {}) {

  const linked = await loadExtensionPhoneNumber(prisma, extensionId);

  if (!linked || linked.id !== String(phoneNumberId)) {

    throw Object.assign(new Error('Phone number is not assigned to this extension'), { status: 400 });

  }

  return setExtensionPrimaryDid(prisma, tenantId, extensionId, null, actor);

}



async function setPrimaryPhoneNumber(prisma, tenantId, extensionId, phoneNumberId, actor = {}) {

  return setExtensionPrimaryDid(prisma, tenantId, extensionId, phoneNumberId, actor);

}



module.exports = {

  buildOwnershipPayload,

  loadExtensionPhoneNumber,

  loadExtensionPhoneNumbers,

  resolveExtensionPhoneNumber,

  listExtensionPhoneNumbersContext,

  syncPhoneNumbersForExtension,

  releaseEmployeeFromOtherExtensions,

  reassignExtensionEmployee,

  forceLogoutExtensionDevices,

  forceLogoutUserDevices,

  resetExtensionSipCredentials,

  assignPhoneNumberToExtension,

  unassignPhoneNumberFromExtension,

  setExtensionPrimaryDid,

  setPrimaryPhoneNumber,

  listAvailablePhoneNumbersForExtension,

  registrationStatusForType,

  resolveInboundRecipient,

  serializePhoneNumber,

  assertDidNotAssignedElsewhere,

};


