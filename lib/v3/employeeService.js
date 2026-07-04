/**
 * V3 EmployeeService.
 *
 * One-call employee onboarding: quota + tenant-active checks, then a single Prisma
 * transaction for User + Extension + defaults + telephony provisioning + audit.
 * If any transactional step throws, the entire DB write rolls back — no orphan
 * User or Extension records.
 *
 * Health snapshot is read-only and runs after the transaction commits.
 */

const { hashPassword } = require('../auth');
const { assertTenantActive } = require('../tenantGuard');
const { assertCanAddUser, shouldBypassQuotaForUser } = require('../quotaService');
const extensionService = require('./extensionService');
const provisioningService = require('./provisioningService');
const healthCheckService = require('./healthCheckService');
const auditService = require('./auditService');
const { enqueueRuntimeSync } = require('./runtime/runtimeEnqueue');

async function createEmployee(prisma, tenantId, input = {}, { req = null, actor = {} } = {}) {
  const email = String(input.email || '').trim().toLowerCase();
  const name = String(input.name || '').trim();
  const password = String(input.password || '');

  if (!name || !email || !password) {
    throw Object.assign(new Error('name, email and password are required'), { status: 400 });
  }
  if (password.length < 6) {
    throw Object.assign(new Error('Password must be at least 6 characters'), { status: 400 });
  }

  await assertTenantActive(prisma, tenantId);
  await assertCanAddUser(prisma, tenantId, { bypass: shouldBypassQuotaForUser(actor) });

  const passwordHash = await hashPassword(password);

  const { user, extension, provision } = await prisma.$transaction(async (tx) => {
    let createdUser;
    try {
      createdUser = await tx.user.create({
        data: {
          email,
          name,
          passwordHash,
          role: 'TENANT_USER',
          tenantId,
        },
      });
    } catch (error) {
      if (error.code === 'P2002') {
        throw Object.assign(new Error('A user with this email already exists'), { status: 409 });
      }
      throw error;
    }

    console.log('[PBX REBUILD] (v3.employee-create) Employee Provisioned', {
      tenantId, userId: createdUser.id, email,
    });

    const createdExtension = await extensionService.autoCreateForEmployee(
      tx, tenantId, createdUser, actor,
    );

    const extRow = await tx.extension.findUnique({ where: { id: createdExtension.id } });
    const provisionResult = await provisioningService.ensureExtensionProvisioned(
      tx, extRow, { stage: 'v3.employee-create' },
    );

    console.log('[PBX REBUILD] (v3.employee-create) Provision Complete', {
      extensionId: createdExtension.id,
      extensionNumber: createdExtension.extensionNumber,
      provisioned: provisionResult.provisioned,
    });

    await auditService.logTransactional(tx, req, {
      action: 'v3.employee.created',
      entityType: 'User',
      entityId: createdUser.id,
      newValue: {
        email,
        name,
        extensionId: createdExtension.id,
        extensionNumber: createdExtension.extensionNumber,
        provisioned: provisionResult.provisioned,
      },
    });

    return {
      user: createdUser,
      extension: createdExtension,
      provision: provisionResult,
    };
  });

  const health = await healthCheckService.employeeHealth(prisma, tenantId, user.id);

  await enqueueRuntimeSync(prisma, tenantId, 'extension', extension.id, 'sync', { req });

  return {
    employee: { id: user.id, email: user.email, name: user.name, role: user.role },
    extension,
    provision,
    health: health.employees?.[0] || null,
  };
}

module.exports = { createEmployee };
