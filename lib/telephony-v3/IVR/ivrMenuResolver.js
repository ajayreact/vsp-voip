const { DESTINATION_TYPE } = require('./ivrConstants');

/**
 * Default root menu when none provided.
 */
function defaultMenuTree() {
  return {
    root: {
      id: 'root',
      greeting: {
        text: 'Welcome. Press 1 for sales, 2 for support, 0 for operator, star to repeat.',
      },
      timeoutSec: 5,
      retryCount: 3,
      invalidPrompt: { text: 'Invalid option. Please try again.' },
      timeoutPrompt: { text: 'We did not receive your input.' },
      digits: {
        '1': { destination: DESTINATION_TYPE.EXTENSION, extensionId: 'ext-sales', label: 'sales' },
        '2': { destination: DESTINATION_TYPE.QUEUE, queueId: 'queue-support', label: 'support' },
        '0': { destination: DESTINATION_TYPE.OPERATOR, extensionId: 'ext-operator', label: 'operator' },
        '*': { destination: DESTINATION_TYPE.REPEAT, label: 'repeat' },
      },
    },
  };
}

/**
 * @param {object|null|undefined} greeting
 * @param {Record<string, unknown>|null|undefined} menuTreeOverride
 */
function resolveMenuTree(greeting, menuTreeOverride) {
  if (menuTreeOverride && typeof menuTreeOverride === 'object') {
    return menuTreeOverride;
  }
  if (greeting?.ivrOptions && typeof greeting.ivrOptions === 'object') {
    const opts = greeting.ivrOptions;
    if (opts.menus) return opts.menus;
    if (opts.root) return { root: opts.root, ...(opts.submenus || {}) };
  }
  return defaultMenuTree();
}

/**
 * @param {Record<string, unknown>} menuTree
 * @param {string} menuId
 */
function resolveMenuNode(menuTree, menuId) {
  const node = menuTree[menuId];
  if (!node) return null;
  return {
    ...node,
    id: menuId,
    timeoutSec: node.timeoutSec ?? node.timeout ?? 5,
    retryCount: node.retryCount ?? 3,
    digits: node.digits || node.digitMap || {},
  };
}

/**
 * @param {Record<string, unknown>} menuNode
 * @param {string} digit
 */
function resolveDigitDestination(menuNode, digit) {
  const entry = menuNode?.digits?.[digit];
  if (!entry) return null;
  return {
    destination: entry.destination || entry.type || entry.action,
    ...entry,
  };
}

/**
 * @param {Record<string, unknown>} destination
 * @param {string} tenantId
 */
async function resolveDestinationTarget(destination, tenantId) {
  const { getPrisma } = require('../internal/prisma');
  const prisma = await getPrisma();
  const type = String(destination.destination || destination.type || '').toUpperCase();

  switch (type) {
    case DESTINATION_TYPE.EXTENSION: {
      if (!destination.extensionId) return { type, target: null };
      const ext = await prisma.extension.findFirst({
        where: { id: destination.extensionId, tenantId },
        select: { id: true, telnyxSipUsername: true, displayName: true },
      });
      return {
        type,
        extensionId: ext?.id,
        dialTo: ext?.telnyxSipUsername ? `sip:${ext.telnyxSipUsername}@sip.telnyx.com` : null,
      };
    }
    case DESTINATION_TYPE.QUEUE:
      return { type, queueId: destination.queueId, ringGroupId: destination.ringGroupId };
    case DESTINATION_TYPE.RING_GROUP: {
      if (!destination.ringGroupId) return { type, target: null };
      const members = await prisma.ringGroupMember.findMany({
        where: {
          ringGroupId: destination.ringGroupId,
          isActive: true,
          ringGroup: { tenantId },
        },
        include: { extension: { select: { telnyxSipUsername: true } } },
      });
      return {
        type,
        ringGroupId: destination.ringGroupId,
        dialTargets: members
          .map((m) => (m.extension?.telnyxSipUsername
            ? `sip:${m.extension.telnyxSipUsername}@sip.telnyx.com`
            : null))
          .filter(Boolean),
      };
    }
    case DESTINATION_TYPE.VOICEMAIL:
      return { type, extensionId: destination.extensionId, mailboxId: destination.mailboxId };
    case DESTINATION_TYPE.CONFERENCE:
      return { type, conferenceId: destination.conferenceId };
    case DESTINATION_TYPE.OPERATOR:
      return { type, extensionId: destination.extensionId || destination.operatorExtensionId };
    case DESTINATION_TYPE.SUBMENU:
      return { type, menuId: destination.menuId || destination.submenuId };
    case DESTINATION_TYPE.REPEAT:
      return { type: DESTINATION_TYPE.REPEAT };
    case DESTINATION_TYPE.DISCONNECT:
      return { type: DESTINATION_TYPE.DISCONNECT };
    default:
      return { type, raw: destination };
  }
}

module.exports = {
  defaultMenuTree,
  resolveMenuTree,
  resolveMenuNode,
  resolveDigitDestination,
  resolveDestinationTarget,
};
