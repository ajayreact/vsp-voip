-- CreateEnum
CREATE TYPE "ExtensionDeviceRingStrategy" AS ENUM (
  'SIMULTANEOUS',
  'DESK_FIRST',
  'MOBILE_FIRST',
  'DESK_ONLY',
  'MOBILE_ONLY'
);

-- AlterTable
ALTER TABLE "Extension"
  ADD COLUMN "deviceRingStrategy" "ExtensionDeviceRingStrategy" NOT NULL DEFAULT 'SIMULTANEOUS';

-- Preserve pilot DESK_FIRST behavior for extensions that used TEMP_DESK_FIRST_OVERRIDES
UPDATE "Extension"
SET "deviceRingStrategy" = 'DESK_FIRST'
WHERE "id" = 'dda183d4-7cd0-43dc-b395-a0622061dc76';

UPDATE "Extension"
SET "deviceRingStrategy" = 'DESK_FIRST'
WHERE "tenantId" = '8bbcdbdf-6377-44a0-bd84-ac6a34d5de96'
  AND "extensionNumber" = '101';
