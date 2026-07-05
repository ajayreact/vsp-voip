/**
 * V3 ExtensionService.
 *
 * Reuses lib/extensions.js helpers instead of reimplementing extension logic:
 *   - autoCreateForEmployee → delegates to the existing `createExtension`, which
 *     auto-allocates the next number (`suggestNextExtensionNumber`), creates the
 *     default security/forwarding/voicemail rows (`createExtensionDefaults`), and
 *     provisions the employee's Telnyx credential idempotently. This guarantees a
 *     newly created employee immediately has a fully-formed, provisioned extension.
 *   - updateEditable → delegates to the existing `updateExtension` for the small
 *     set of tenant-editable fields (number / display name / device permissions).
 */

const { createExtension, updateExtension } = require('../extensions');

async function autoCreateForEmployee(prisma, tenantId, user, actor = {}) {
  if (!user?.id) {
    throw Object.assign(new Error('A saved employee is required to create an extension'), { status: 400 });
  }
  return createExtension(
    prisma,
    tenantId,
    {
      displayName: user.name || user.email || 'Employee',
      email: user.email || null,
      userId: user.id,
    },
    actor,
  );
}

async function updateEditable(prisma, tenantId, extensionId, patch = {}) {
  const body = {};
  if (patch.extensionNumber !== undefined) body.extensionNumber = patch.extensionNumber;
  if (patch.displayName !== undefined) body.displayName = patch.displayName;
  if (patch.department !== undefined) body.department = patch.department;
  if (patch.webrtcEnabled !== undefined) body.webrtcEnabled = patch.webrtcEnabled;
  if (patch.sipEnabled !== undefined) body.sipEnabled = patch.sipEnabled;
  if (patch.multiDeviceEnabled !== undefined) body.multiDeviceEnabled = patch.multiDeviceEnabled;
  if (patch.deviceRingStrategy !== undefined) body.deviceRingStrategy = patch.deviceRingStrategy;
  return updateExtension(prisma, tenantId, extensionId, body);
}

module.exports = { autoCreateForEmployee, updateEditable };
