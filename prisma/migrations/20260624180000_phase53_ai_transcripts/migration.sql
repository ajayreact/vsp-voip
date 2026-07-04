-- Phase 5.3 Speech-to-Text Foundation — AI transcript storage only

CREATE TABLE IF NOT EXISTS "AiTranscript" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "transcript" TEXT,
    "confidence" DOUBLE PRECISION,
    "detectedLanguage" TEXT,
    "provider" TEXT,
    "model" TEXT,
    "durationSeconds" INTEGER,
    "processingTimeMs" INTEGER,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiTranscript_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "AiTranscript_tenantId_entityType_entityId_key"
    ON "AiTranscript"("tenantId", "entityType", "entityId");

CREATE INDEX IF NOT EXISTS "AiTranscript_tenantId_entityType_status_idx"
    ON "AiTranscript"("tenantId", "entityType", "status");

CREATE INDEX IF NOT EXISTS "AiTranscript_entityType_entityId_idx"
    ON "AiTranscript"("entityType", "entityId");

ALTER TABLE "AiTranscript"
    ADD CONSTRAINT "AiTranscript_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
