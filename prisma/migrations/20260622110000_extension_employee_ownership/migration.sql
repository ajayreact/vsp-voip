-- Employee ownership model: PhoneNumber -> Extension -> User

ALTER TABLE "PhoneNumber" ADD COLUMN "extensionId" TEXT;
ALTER TABLE "Extension" ADD COLUMN "primaryPhoneNumberId" TEXT;

CREATE INDEX "PhoneNumber_extensionId_idx" ON "PhoneNumber"("extensionId");
CREATE UNIQUE INDEX "Extension_primaryPhoneNumberId_key" ON "Extension"("primaryPhoneNumberId");

ALTER TABLE "PhoneNumber" ADD CONSTRAINT "PhoneNumber_extensionId_fkey"
  FOREIGN KEY ("extensionId") REFERENCES "Extension"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Extension" ADD CONSTRAINT "Extension_primaryPhoneNumberId_fkey"
  FOREIGN KEY ("primaryPhoneNumberId") REFERENCES "PhoneNumber"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Link existing numbers assigned to extension users
UPDATE "PhoneNumber" pn
SET "extensionId" = e.id
FROM "Extension" e
WHERE e."userId" = pn."assignedUserId"
  AND e."tenantId" = pn."tenantId"
  AND pn."assignedUserId" IS NOT NULL
  AND pn."extensionId" IS NULL;

-- Set primary DID per extension (oldest assigned number)
UPDATE "Extension" e
SET "primaryPhoneNumberId" = sub."phoneId"
FROM (
  SELECT DISTINCT ON (pn."extensionId")
    pn."extensionId",
    pn.id AS "phoneId"
  FROM "PhoneNumber" pn
  WHERE pn."extensionId" IS NOT NULL
  ORDER BY pn."extensionId", pn."createdAt" ASC
) sub
WHERE e.id = sub."extensionId"
  AND e."primaryPhoneNumberId" IS NULL;
