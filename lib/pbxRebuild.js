const { ensureEmployeeTelephonyForExtension } = require('./employeeTelephony');

/**
 * Experimental PBX-rebuild provisioning guarantee (fully reversible).
 *
 * Purpose: after each tenant provisioning operation (create extension, assign
 * employee, assign DID, provision desk phone, generate SIP credentials) make sure
 * the employee's Telnyx telephony credential exists — treating a post-PBX-Reset
 * tenant exactly like a brand-new tenant.
 *
 * Guarantees:
 *   - Does NOT duplicate provisioning logic. It only orchestrates the EXISTING
 *     idempotent `ensureEmployeeTelephonyForExtension` (which itself reuses an
 *     existing valid credential and only creates one when missing/invalid), so it
 *     never produces duplicate Telnyx credentials.
 *   - Never throws. Provisioning failure is logged as a warning and swallowed so
 *     the caller's primary operation (create/assign/etc.) is unaffected.
 *   - Touches NO routing, desk router, webhook, Call Control, SIP routing, dial,
 *     or worker logic. Provisioning only.
 *
 * Emits [PBX REBUILD] logs: Employee Provisioned / Extension Provisioned /
 * Credential Verified / DID Verified / Provision Complete.
 */
async function ensureExtensionTelephonyProvisioned(prisma, extension, { stage = 'provision' } = {}) {
  if (!extension?.id) return;

  const label = stage ? `[PBX REBUILD] (${stage})` : '[PBX REBUILD]';

  try {
    console.log(`${label} Extension Provisioned`, {
      tenantId: extension.tenantId ?? null,
      extensionId: extension.id,
      extensionNumber: extension.extensionNumber ?? null,
      hasUser: Boolean(extension.userId),
    });

    if (!extension.userId) {
      console.log(`${label} Provision Complete`, {
        extensionId: extension.id,
        note: 'no employee assigned; credential provisioned on assignment',
      });
      return;
    }

    const before = await prisma.user.findUnique({
      where: { id: extension.userId },
      select: { telnyxCredentialId: true },
    });
    const hadCredential = Boolean(before?.telnyxCredentialId);

    // Existing idempotent provisioning. If the credential already exists, this is
    // a no-op reuse; if missing, it creates exactly one.
    await ensureEmployeeTelephonyForExtension(prisma, extension);

    const after = await prisma.user.findUnique({
      where: { id: extension.userId },
      select: { telnyxCredentialId: true, telnyxSipUsername: true },
    });

    console.log(`${label} Employee Provisioned`, {
      userId: extension.userId,
      action: hadCredential ? 'existing' : (after?.telnyxCredentialId ? 'created' : 'unresolved'),
    });

    if (after?.telnyxCredentialId && after?.telnyxSipUsername) {
      console.log(`${label} Credential Verified`, {
        userId: extension.userId,
        telnyxSipUsername: after.telnyxSipUsername,
      });
    } else {
      console.warn(`${label} Credential MISSING after provisioning`, { userId: extension.userId });
    }

    const did = await prisma.phoneNumber.findFirst({
      where: { extensionId: extension.id },
      select: { number: true, assignedUserId: true },
    });
    console.log(`${label} DID Verified`, {
      number: did?.number ?? null,
      assignedToEmployee: did ? did.assignedUserId === extension.userId : null,
      note: did ? undefined : 'no DID linked (optional for internal extension calls)',
    });

    console.log(`${label} Provision Complete`, {
      extensionId: extension.id,
      userId: extension.userId,
    });
  } catch (error) {
    console.warn(`${label} provisioning failed (continuing): ${error.message}`);
  }
}

module.exports = { ensureExtensionTelephonyProvisioned };
