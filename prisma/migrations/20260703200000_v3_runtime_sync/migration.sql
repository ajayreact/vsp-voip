-- CreateEnum
CREATE TYPE "V3RuntimeSyncJobStatus" AS ENUM ('PENDING', 'RUNNING', 'SUCCESS', 'FAILED', 'RETRYING', 'DEAD_LETTER');

-- CreateTable
CREATE TABLE "V3RuntimeSyncJob" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "action" TEXT NOT NULL DEFAULT 'sync',
    "status" "V3RuntimeSyncJobStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 5,
    "lastError" TEXT,
    "payload" JSONB,
    "result" JSONB,
    "idempotencyKey" TEXT NOT NULL,
    "scheduledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "V3RuntimeSyncJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "V3RuntimeLink" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "v3EntityType" TEXT NOT NULL,
    "v3EntityId" TEXT NOT NULL,
    "runtimeEntityType" TEXT NOT NULL,
    "runtimeEntityId" TEXT NOT NULL,
    "metadata" JSONB,
    "lastSyncedAt" TIMESTAMP(3),
    "syncHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "V3RuntimeLink_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "V3RuntimeSyncJob_idempotencyKey_key" ON "V3RuntimeSyncJob"("idempotencyKey");

-- CreateIndex
CREATE INDEX "V3RuntimeSyncJob_tenantId_status_scheduledAt_idx" ON "V3RuntimeSyncJob"("tenantId", "status", "scheduledAt");

-- CreateIndex
CREATE INDEX "V3RuntimeSyncJob_tenantId_entityType_entityId_idx" ON "V3RuntimeSyncJob"("tenantId", "entityType", "entityId");

-- CreateIndex
CREATE UNIQUE INDEX "V3RuntimeLink_tenantId_v3EntityType_v3EntityId_key" ON "V3RuntimeLink"("tenantId", "v3EntityType", "v3EntityId");

-- CreateIndex
CREATE INDEX "V3RuntimeLink_tenantId_runtimeEntityType_runtimeEntityId_idx" ON "V3RuntimeLink"("tenantId", "runtimeEntityType", "runtimeEntityId");

-- AddForeignKey
ALTER TABLE "V3RuntimeSyncJob" ADD CONSTRAINT "V3RuntimeSyncJob_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "V3RuntimeLink" ADD CONSTRAINT "V3RuntimeLink_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
