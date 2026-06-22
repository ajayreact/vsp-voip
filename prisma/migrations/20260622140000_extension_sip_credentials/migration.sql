-- Extension-level SIP credentials (username = extension number, password generated on create)
ALTER TABLE "Extension" ADD COLUMN IF NOT EXISTS "sipUsername" TEXT;
ALTER TABLE "Extension" ADD COLUMN IF NOT EXISTS "sipPassword" TEXT;

-- Backfill username from extension number; passwords are generated lazily by the API
UPDATE "Extension"
SET "sipUsername" = "extensionNumber"
WHERE "sipUsername" IS NULL;
