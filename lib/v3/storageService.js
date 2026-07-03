/**
 * V3 Storage Service — read-only usage estimates from existing DB records.
 */

const ESTIMATED_RECORDING_MB_PER_MIN = 0.75;
const ESTIMATED_VOICEMAIL_MB = 0.5;

async function getStorageUsage(prisma, tenantId) {
  const [recordings, voicemails, v3VoicemailBoxes, backups] = await Promise.all([
    prisma.callRecording.findMany({
      where: { tenantId },
      select: { durationSeconds: true },
    }),
    prisma.voicemail.count({ where: { tenantId } }),
    prisma.v3VoicemailBox.count({ where: { tenantId, removedAt: null } }),
    prisma.v3TenantBackup.aggregate({
      where: { tenantId, removedAt: null },
      _sum: { sizeBytes: true },
      _count: true,
    }),
  ]);

  const recordingMinutes = recordings.reduce((sum, r) => sum + (r.durationSeconds || 0), 0) / 60;
  const recordingMb = Math.round(recordingMinutes * ESTIMATED_RECORDING_MB_PER_MIN * 100) / 100;
  const voicemailMb = Math.round(voicemails * ESTIMATED_VOICEMAIL_MB * 100) / 100;
  const backupBytes = backups._sum.sizeBytes || 0;

  return {
    recordings: {
      count: recordings.length,
      estimatedMb: recordingMb,
    },
    voicemails: {
      count: voicemails,
      estimatedMb: voicemailMb,
    },
    v3VoicemailBoxes,
    backups: {
      count: backups._count,
      bytes: backupBytes,
      estimatedMb: Math.round((backupBytes / (1024 * 1024)) * 100) / 100,
    },
    totalEstimatedMb: Math.round((recordingMb + voicemailMb + backupBytes / (1024 * 1024)) * 100) / 100,
  };
}

async function getSmsUsage(prisma, tenantId) {
  const [total, last30] = await Promise.all([
    prisma.smsMessage.count({ where: { tenantId } }),
    prisma.smsMessage.count({
      where: {
        tenantId,
        createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
      },
    }),
  ]);
  return { total, last30Days: last30 };
}

async function getApiUsageEstimate(prisma, tenantId) {
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const users = await prisma.user.findMany({ where: { tenantId }, select: { id: true } });
  const userIds = users.map((u) => u.id);
  let auditCount = 0;
  if (userIds.length) {
    auditCount = await prisma.adminAuditLog.count({
      where: {
        action: { startsWith: 'v3.' },
        createdAt: { gte: since },
        userId: { in: userIds },
      },
    });
  }
  return { v3AuditEventsLast30Days: auditCount, estimatedApiCalls: auditCount * 3 };
}

module.exports = {
  getStorageUsage,
  getSmsUsage,
  getApiUsageEstimate,
};
