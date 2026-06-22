-- Tenant dashboard gap features: per-number routing, richer call logs, greeting audio URLs

ALTER TABLE "PhoneNumber" ADD COLUMN IF NOT EXISTS "assignedUserId" TEXT;
ALTER TABLE "PhoneNumber" ADD COLUMN IF NOT EXISTS "label" TEXT;
ALTER TABLE "PhoneNumber" ADD COLUMN IF NOT EXISTS "routingType" TEXT NOT NULL DEFAULT 'tenant_default';
ALTER TABLE "PhoneNumber" ADD COLUMN IF NOT EXISTS "forwardDestination" TEXT;
ALTER TABLE "PhoneNumber" ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "CallLog" ADD COLUMN IF NOT EXISTS "callType" TEXT;
ALTER TABLE "CallLog" ADD COLUMN IF NOT EXISTS "durationSeconds" INTEGER;
ALTER TABLE "CallLog" ADD COLUMN IF NOT EXISTS "endedAt" TIMESTAMP(3);

ALTER TABLE "Greeting" ADD COLUMN IF NOT EXISTS "greetingAudioUrl" TEXT;
ALTER TABLE "Greeting" ADD COLUMN IF NOT EXISTS "ivrPromptAudioUrl" TEXT;

CREATE INDEX IF NOT EXISTS "PhoneNumber_tenantId_idx" ON "PhoneNumber"("tenantId");
CREATE INDEX IF NOT EXISTS "PhoneNumber_assignedUserId_idx" ON "PhoneNumber"("assignedUserId");
CREATE INDEX IF NOT EXISTS "CallLog_tenantId_createdAt_idx" ON "CallLog"("tenantId", "createdAt");

DO $$ BEGIN
  ALTER TABLE "PhoneNumber" ADD CONSTRAINT "PhoneNumber_assignedUserId_fkey"
    FOREIGN KEY ("assignedUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
