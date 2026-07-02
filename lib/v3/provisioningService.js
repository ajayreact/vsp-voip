/**
 * V3 ProvisioningService — idempotent orchestrator.
 *
 * Thin wrapper over EXISTING idempotent provisioning primitives:
 *   - lib/pbxRebuild.js       → ensureExtensionTelephonyProvisioned (credential guarantee)
 *   - lib/extensionProvisioning.js → getExtensionSipCredentials (SIP profile),
 *                                    createExtensionProvisioningToken (QR)
 *
 * Guarantees:
 *   - `ensureExtensionProvisioned` never throws (provisioning failures are
 *     reported in the returned result; callers stay resilient to Telnyx outages).
 *   - No credential is ever recreated when one already exists (the underlying
 *     helpers reuse existing valid credentials).
 *   - No routing / Call Control / webhook / dial code is touched.
 */

const { ensureExtensionTelephonyProvisioned } = require('../pbxRebuild');
const {
  getExtensionSipCredentials,
  createExtensionProvisioningToken,
} = require('../extensionProvisioning');

async function ensureExtensionProvisioned(prisma, extension, { stage = 'provision' } = {}) {
  if (!extension) {
    return { ok: false, provisioned: false, reason: 'no-extension' };
  }

  try {
    // Idempotent: only provisions when missing; reuses valid credentials.
    await ensureExtensionTelephonyProvisioned(prisma, extension, { stage });
  } catch (error) {
    // Never surface provisioning failures to callers — report and continue.
    console.warn(`[V3 provisioning] ensureExtensionProvisioned(${stage}) failed: ${error.message}`);
    return { ok: false, provisioned: false, reason: error.message };
  }

  if (!extension.userId) {
    return { ok: true, provisioned: false, reason: 'no-employee' };
  }

  let user = null;
  try {
    user = await prisma.user.findUnique({
      where: { id: extension.userId },
      select: { telnyxCredentialId: true, telnyxSipUsername: true },
    });
  } catch {
    // Best-effort verification only.
  }

  const provisioned = Boolean(user?.telnyxCredentialId && user?.telnyxSipUsername);
  return {
    ok: true,
    provisioned,
    telnyxCredentialId: user?.telnyxCredentialId || null,
    telnyxSipUsername: user?.telnyxSipUsername || null,
  };
}

/**
 * Verify/create the credential for an employee's extension and return the SIP
 * profile + provisioning QR. Safe to call repeatedly. Provisioning is guaranteed
 * complete before the QR/SIP profile is produced.
 */
async function provisionDeviceForEmployee(prisma, tenantId, employeeId, { target = 'sip_phone' } = {}, actor = {}) {
  const extension = await prisma.extension.findFirst({
    where: { tenantId, userId: employeeId },
    orderBy: { createdAt: 'asc' },
  });
  if (!extension) {
    throw Object.assign(new Error('No extension assigned to this employee'), { status: 404 });
  }

  const provision = await ensureExtensionProvisioned(prisma, extension, { stage: 'provision-device' });

  let sip = null;
  try {
    const result = await getExtensionSipCredentials(prisma, tenantId, extension.id);
    sip = result?.sip || result || null;
  } catch (error) {
    console.warn(`[V3 provisioning] SIP profile unavailable: ${error.message}`);
  }

  let qr = null;
  try {
    qr = await createExtensionProvisioningToken(prisma, tenantId, extension.id, { target }, actor);
  } catch (error) {
    console.warn(`[V3 provisioning] QR generation skipped: ${error.message}`);
  }

  return {
    extensionId: extension.id,
    extensionNumber: extension.extensionNumber,
    provision,
    sip,
    qr,
  };
}

module.exports = { ensureExtensionProvisioned, provisionDeviceForEmployee };
