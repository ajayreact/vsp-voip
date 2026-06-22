-- AlterTable
ALTER TABLE "CallRecording" ADD COLUMN "direction" TEXT NOT NULL DEFAULT 'inbound';

-- AlterTable
ALTER TABLE "PlatformSettings" ADD COLUMN "telnyxCredentialConnectionId" TEXT;
