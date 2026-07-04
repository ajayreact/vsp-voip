-- CreateEnum
CREATE TYPE "V3MigrationRunStatus" AS ENUM ('PREVIEW', 'VALIDATED', 'RUNNING', 'SUCCESS', 'FAILED', 'ROLLED_BACK');

-- CreateTable
CREATE TABLE "V3MigrationRun" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "runType" TEXT NOT NULL DEFAULT 'migrate',
    "status" "V3MigrationRunStatus" NOT NULL DEFAULT 'PREVIEW',
    "dryRun" BOOLEAN NOT NULL DEFAULT true,
    "targetTenantIds" JSONB NOT NULL DEFAULT '[]',
    "preview" JSONB,
    "validation" JSONB,
    "result" JSONB,
    "report" JSONB,
    "backupId" TEXT,
    "rollbackBackupId" TEXT,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "V3MigrationRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "V3MigrationRun_tenantId_status_createdAt_idx" ON "V3MigrationRun"("tenantId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "V3MigrationRun_tenantId_runType_idx" ON "V3MigrationRun"("tenantId", "runType");

-- AddForeignKey
ALTER TABLE "V3MigrationRun" ADD CONSTRAINT "V3MigrationRun_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
