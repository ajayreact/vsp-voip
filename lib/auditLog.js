const { randomUUID } = require('crypto');

async function writeAuditLog(prisma, req, { action, entityType, entityId, details }) {
  try {
    await prisma.adminAuditLog.create({
      data: {
        id: randomUUID(),
        userId: req.user?.sub || null,
        userEmail: req.user?.email || null,
        action,
        entityType,
        entityId: entityId || null,
        details: details || {},
      },
    });
  } catch (error) {
    console.warn('⚠️ Audit log write failed:', error.message);
  }
}

async function writeSystemAuditLog(prisma, { action, entityType, entityId, details }) {
  try {
    await prisma.adminAuditLog.create({
      data: {
        id: randomUUID(),
        userId: null,
        userEmail: 'system',
        action,
        entityType,
        entityId: entityId || null,
        details: details || {},
      },
    });
  } catch (error) {
    console.warn('⚠️ System audit log write failed:', error.message);
  }
}

module.exports = { writeAuditLog, writeSystemAuditLog };
