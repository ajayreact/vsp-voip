-- Phase 4C: Enterprise extension security

CREATE TYPE "RecordingPolicy" AS ENUM ('ALWAYS', 'INBOUND_ONLY', 'OUTBOUND_ONLY', 'ON_DEMAND', 'DISABLED');
CREATE TYPE "AfterHoursAction" AS ENUM ('BLOCK', 'ALLOW', 'VOICEMAIL_ONLY');

ALTER TABLE "ExtensionSecurity" ADD COLUMN "allowInternalExtensions" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "ExtensionSecurity" ADD COLUMN "spamPatternBlockEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "ExtensionSecurity" ADD COLUMN "outboundCallerId" TEXT;
ALTER TABLE "ExtensionSecurity" ADD COLUMN "hideCallerId" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "ExtensionSecurity" ADD COLUMN "callerIdName" TEXT;
ALTER TABLE "ExtensionSecurity" ADD COLUMN "callingPermissions" JSONB NOT NULL DEFAULT '{"local":true,"national":true,"international":true,"premium":false,"emergency":true}';
ALTER TABLE "ExtensionSecurity" ADD COLUMN "timeRestrictionsEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "ExtensionSecurity" ADD COLUMN "businessHours" JSONB;
ALTER TABLE "ExtensionSecurity" ADD COLUMN "afterHoursAction" "AfterHoursAction" NOT NULL DEFAULT 'BLOCK';
ALTER TABLE "ExtensionSecurity" ADD COLUMN "holidaySchedule" JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "ExtensionSecurity" ADD COLUMN "recordingPolicy" "RecordingPolicy" NOT NULL DEFAULT 'INBOUND_ONLY';

ALTER TABLE "ExtensionSecurity" ALTER COLUMN "whitelist" SET DEFAULT '{}';
ALTER TABLE "ExtensionSecurity" ALTER COLUMN "blacklist" SET DEFAULT '{}';

UPDATE "ExtensionSecurity" SET "whitelist" = '{}' WHERE "whitelist" = '[]'::jsonb;
UPDATE "ExtensionSecurity" SET "blacklist" = '{}' WHERE "blacklist" = '[]'::jsonb;

CREATE TABLE "ExtensionAuditLog" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "extensionId" TEXT NOT NULL,
    "userId" TEXT,
    "userEmail" TEXT,
    "category" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "summary" TEXT,
    "changes" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExtensionAuditLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ExtensionAuditLog_tenantId_createdAt_idx" ON "ExtensionAuditLog"("tenantId", "createdAt");
CREATE INDEX "ExtensionAuditLog_extensionId_category_createdAt_idx" ON "ExtensionAuditLog"("extensionId", "category", "createdAt");

ALTER TABLE "ExtensionAuditLog" ADD CONSTRAINT "ExtensionAuditLog_extensionId_fkey" FOREIGN KEY ("extensionId") REFERENCES "Extension"("id") ON DELETE CASCADE ON UPDATE CASCADE;
