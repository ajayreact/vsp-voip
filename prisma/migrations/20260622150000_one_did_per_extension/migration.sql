-- One DID per extension: dedupe then enforce uniqueness on PhoneNumber.extensionId

WITH ranked AS (
  SELECT
    pn.id,
    ROW_NUMBER() OVER (
      PARTITION BY pn."extensionId"
      ORDER BY
        CASE WHEN e."primaryPhoneNumberId" = pn.id THEN 0 ELSE 1 END,
        pn."createdAt" ASC
    ) AS rn
  FROM "PhoneNumber" pn
  INNER JOIN "Extension" e ON e.id = pn."extensionId"
  WHERE pn."extensionId" IS NOT NULL
)
UPDATE "PhoneNumber"
SET "extensionId" = NULL
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

-- Align primaryPhoneNumberId with the remaining linked DID
UPDATE "Extension" e
SET "primaryPhoneNumberId" = pn.id
FROM "PhoneNumber" pn
WHERE pn."extensionId" = e.id
  AND (e."primaryPhoneNumberId" IS NULL OR e."primaryPhoneNumberId" <> pn.id);

UPDATE "Extension"
SET "primaryPhoneNumberId" = NULL
WHERE "primaryPhoneNumberId" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM "PhoneNumber" pn
    WHERE pn.id = "Extension"."primaryPhoneNumberId"
      AND pn."extensionId" = "Extension".id
  );

CREATE UNIQUE INDEX IF NOT EXISTS "PhoneNumber_extensionId_key"
  ON "PhoneNumber"("extensionId");
