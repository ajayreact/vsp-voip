async function assertTenantActive(prisma, tenantId) {
  if (!tenantId) return null;

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { id: true, name: true, isActive: true, billingStatus: true, billingGraceUntil: true },
  });

  if (!tenant) {
    const error = new Error('Organization not found');
    error.status = 404;
    throw error;
  }

  if (!tenant.isActive) {
    const error = new Error('This organization is suspended. Contact VSP-VOIP support.');
    error.status = 403;
    throw error;
  }

  return tenant;
}

function isTenantOperational(tenant) {
  if (!tenant) return false;
  if (tenant.isActive === false) return false;
  if (tenant.billingStatus === 'SUSPENDED') return false;
  if (tenant.billingStatus === 'GRACE' && tenant.billingGraceUntil) {
    return new Date(tenant.billingGraceUntil) > new Date();
  }
  return true;
}

async function assertTenantOperational(prisma, tenantId) {
  const tenant = await assertTenantActive(prisma, tenantId);
  if (!isTenantOperational(tenant)) {
    const error = new Error('This organization is suspended. Contact VSP-VOIP support.');
    error.status = 403;
    throw error;
  }
  return tenant;
}

module.exports = { assertTenantActive, assertTenantOperational, isTenantOperational };
