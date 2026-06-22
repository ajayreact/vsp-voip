-- Phase A: Telnyx desk SIP credentials per Extension (separate from User app credentials)
ALTER TABLE "Extension" ADD COLUMN IF NOT EXISTS "telnyxCredentialId" TEXT;
ALTER TABLE "Extension" ADD COLUMN IF NOT EXISTS "telnyxSipUsername" TEXT;
ALTER TABLE "Extension" ADD COLUMN IF NOT EXISTS "telnyxSipPassword" TEXT;
ALTER TABLE "Extension" ADD COLUMN IF NOT EXISTS "sipRegistered" BOOLEAN;
ALTER TABLE "Extension" ADD COLUMN IF NOT EXISTS "sipRegistrationCheckedAt" TIMESTAMP(3);
ALTER TABLE "Extension" ADD COLUMN IF NOT EXISTS "sipRegistrationSource" TEXT;

CREATE INDEX IF NOT EXISTS "Extension_telnyxSipUsername_idx" ON "Extension"("telnyxSipUsername");
