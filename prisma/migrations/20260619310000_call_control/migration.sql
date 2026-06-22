-- AlterTable
ALTER TABLE "User" ADD COLUMN "telnyxCredentialId" TEXT;
ALTER TABLE "User" ADD COLUMN "telnyxSipUsername" TEXT;
ALTER TABLE "User" ADD COLUMN "softphoneOnlineAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "User_tenantId_softphoneOnlineAt_idx" ON "User"("tenantId", "softphoneOnlineAt");

-- AlterTable
ALTER TABLE "PlatformSettings" ADD COLUMN "telnyxCallControlApplicationId" TEXT;
