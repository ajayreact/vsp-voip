-- Phase 5.2 AI Enterprise Intelligence — AI summary storage only

CREATE TABLE IF NOT EXISTS "AiSummary" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "transcript" TEXT,
    "result" JSONB,
    "provider" TEXT,
    "model" TEXT,
    "confidence" DOUBLE PRECISION,
    "messageCount" INTEGER,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "generatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiSummary_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "AiSummary_tenantId_entityType_entityId_key"
    ON "AiSummary"("tenantId", "entityType", "entityId");

CREATE INDEX IF NOT EXISTS "AiSummary_tenantId_entityType_status_idx"
    ON "AiSummary"("tenantId", "entityType", "status");

CREATE INDEX IF NOT EXISTS "AiSummary_entityType_entityId_idx"
    ON "AiSummary"("entityType", "entityId");

ALTER TABLE "AiSummary"
    ADD CONSTRAINT "AiSummary_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
