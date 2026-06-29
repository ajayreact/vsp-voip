-- Phase 5.1.1 AI Foundation Hardening — AI tables only

ALTER TABLE "TenantAiSettings" ADD COLUMN IF NOT EXISTS "allowedProvider" TEXT;
ALTER TABLE "TenantAiSettings" ADD COLUMN IF NOT EXISTS "allowedModel" TEXT;
ALTER TABLE "TenantAiSettings" ADD COLUMN IF NOT EXISTS "dailyBudgetCents" INTEGER;
ALTER TABLE "TenantAiSettings" ADD COLUMN IF NOT EXISTS "maxTokens" INTEGER;
ALTER TABLE "TenantAiSettings" ADD COLUMN IF NOT EXISTS "temperature" DOUBLE PRECISION;
ALTER TABLE "TenantAiSettings" ADD COLUMN IF NOT EXISTS "streamingEnabled" BOOLEAN NOT NULL DEFAULT true;

UPDATE "TenantAiSettings"
SET "allowedProvider" = COALESCE("allowedProvider", "provider"),
    "allowedModel" = COALESCE("allowedModel", "defaultModel")
WHERE "allowedProvider" IS NULL OR "allowedModel" IS NULL;

ALTER TABLE "AiUsageLog" ADD COLUMN IF NOT EXISTS "module" TEXT;
ALTER TABLE "AiUsageLog" ADD COLUMN IF NOT EXISTS "streamUsed" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "AiUsageLog" ADD COLUMN IF NOT EXISTS "retryCount" INTEGER NOT NULL DEFAULT 0;
