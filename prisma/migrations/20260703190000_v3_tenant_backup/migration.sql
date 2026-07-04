-- V3 Portal Phase 8: Tenant backup snapshots (configuration only)

CREATE TABLE "V3TenantBackup" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "label" TEXT,
    "backupType" TEXT NOT NULL DEFAULT 'full',
    "status" TEXT NOT NULL DEFAULT 'completed',
    "payload" JSONB NOT NULL,
    "itemCounts" JSONB NOT NULL DEFAULT '{}',
    "sizeBytes" INTEGER NOT NULL DEFAULT 0,
    "createdByUserId" TEXT,
    "removedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "V3TenantBackup_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "V3TenantBackup_tenantId_createdAt_idx" ON "V3TenantBackup"("tenantId", "createdAt");
CREATE INDEX "V3TenantBackup_tenantId_removedAt_idx" ON "V3TenantBackup"("tenantId", "removedAt");

ALTER TABLE "V3TenantBackup" ADD CONSTRAINT "V3TenantBackup_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
