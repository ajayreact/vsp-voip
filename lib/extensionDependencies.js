/**
 * Collect routing dependencies that block extension deletion.
 */
async function collectExtensionDeletionBlockers(prisma, tenantId, extension) {
  if (!extension?.id) return [];

  const blockers = [];
  const extId = extension.id;
  const extNumber = String(extension.extensionNumber || '');

  const primaryPhone = extension.primaryPhoneNumberId
    ? await prisma.phoneNumber.findFirst({
      where: { id: extension.primaryPhoneNumberId, tenantId, isActive: true },
      select: { id: true, number: true, label: true },
    })
    : null;

  const [
    ringGroupMembers,
    ringGroupsAsQueue,
    assignedNumbers,
    greeting,
    forwarders,
  ] = await Promise.all([
    prisma.ringGroupMember.findMany({
      where: {
        extensionId: extId,
        isActive: true,
        ringGroup: { tenantId, isActive: true },
      },
      include: { ringGroup: { select: { id: true, name: true, extensionNumber: true } } },
    }),
    extNumber
      ? prisma.ringGroup.findMany({
        where: { tenantId, isActive: true, extensionNumber: extNumber },
        select: { id: true, name: true, extensionNumber: true },
      })
      : Promise.resolve([]),
    prisma.phoneNumber.findMany({
      where: { tenantId, extensionId: extId, isActive: true },
      select: { id: true, number: true, label: true, routingType: true },
    }),
    prisma.greeting.findUnique({ where: { tenantId }, select: { ivrOptions: true } }),
    prisma.extensionForwarding.findMany({
      where: {
        extension: { tenantId, status: 'ACTIVE', id: { not: extId } },
        OR: [
          { alwaysEnabled: true, alwaysDestinationType: 'EXTENSION', alwaysDestination: { in: [extId, extNumber] } },
          { busyEnabled: true, busyDestinationType: 'EXTENSION', busyDestination: { in: [extId, extNumber] } },
          { noAnswerEnabled: true, noAnswerDestinationType: 'EXTENSION', noAnswerDestination: { in: [extId, extNumber] } },
          { scheduleEnabled: true, scheduleDestinationType: 'EXTENSION', scheduleDestination: { in: [extId, extNumber] } },
        ],
      },
      include: { extension: { select: { id: true, extensionNumber: true, displayName: true } } },
    }),
  ]);

  for (const member of ringGroupMembers) {
    blockers.push({
      type: 'ring_group',
      id: member.ringGroup.id,
      label: member.ringGroup.name,
      detail: `Member of ring group "${member.ringGroup.name}"`,
    });
  }

  for (const group of ringGroupsAsQueue) {
    blockers.push({
      type: 'queue',
      id: group.id,
      label: group.name,
      detail: `Ring group "${group.name}" uses extension ${extNumber} as its queue number`,
    });
  }

  for (const phone of assignedNumbers) {
    blockers.push({
      type: 'did_routing',
      id: phone.id,
      label: phone.number,
      detail: `DID ${phone.number} routes to this extension (${phone.routingType || 'direct'})`,
    });
  }

  if (primaryPhone) {
    blockers.push({
      type: 'primary_did',
      id: primaryPhone.id,
      label: primaryPhone.number,
      detail: `Primary DID ${primaryPhone.number} is assigned to this extension`,
    });
  }

  if (greeting?.ivrOptions) {
    const options = Array.isArray(greeting.ivrOptions) ? greeting.ivrOptions : [];
    const extensionPhones = new Set([
      ...assignedNumbers.map((row) => row.number),
      ...(primaryPhone ? [primaryPhone.number] : []),
    ]);
    for (const option of options) {
      const forwardTo = String(option.forwardTo || option.forwardNumber || '').trim();
      if (!forwardTo) continue;
      if (extensionPhones.has(forwardTo) || forwardTo === extNumber) {
        blockers.push({
          type: 'ivr',
          id: String(option.digit || ''),
          label: option.label || `IVR option ${option.digit}`,
          detail: `IVR option "${option.label || option.digit}" routes to this extension`,
        });
      }
    }
  }

  for (const rule of forwarders) {
    blockers.push({
      type: 'voicemail_forward',
      id: rule.extension.id,
      label: `${rule.extension.extensionNumber} — ${rule.extension.displayName}`,
      detail: `Extension ${rule.extension.extensionNumber} forwards to this extension`,
    });
  }

  const seen = new Set();
  return blockers.filter((item) => {
    const key = `${item.type}:${item.id}:${item.detail}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

module.exports = {
  collectExtensionDeletionBlockers,
};
