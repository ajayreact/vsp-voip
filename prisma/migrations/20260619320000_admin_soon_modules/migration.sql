-- CreateEnum
CREATE TYPE "PortRequestStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'FAILED');

-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN "maxUsers" INTEGER,
ADD COLUMN "maxPhoneNumbers" INTEGER,
ADD COLUMN "maxConcurrentCalls" INTEGER;

-- AlterTable
ALTER TABLE "PlatformSettings" ADD COLUMN "defaultMaxUsers" INTEGER NOT NULL DEFAULT 25,
ADD COLUMN "defaultMaxPhoneNumbers" INTEGER NOT NULL DEFAULT 20,
ADD COLUMN "defaultMaxConcurrentCalls" INTEGER NOT NULL DEFAULT 5,
ADD COLUMN "lcrPrimaryConnectionId" TEXT,
ADD COLUMN "lcrFallbackConnectionId" TEXT,
ADD COLUMN "lcrNotes" TEXT;

-- CreateTable
CREATE TABLE "PortRequest" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "phoneNumbers" JSONB NOT NULL,
    "currentCarrier" TEXT,
    "billingTelephoneNumber" TEXT,
    "status" "PortRequestStatus" NOT NULL DEFAULT 'SUBMITTED',
    "adminNotes" TEXT,
    "requestedByEmail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PortRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PortRequest_tenantId_idx" ON "PortRequest"("tenantId");

-- CreateIndex
CREATE INDEX "PortRequest_status_idx" ON "PortRequest"("status");

-- AddForeignKey
ALTER TABLE "PortRequest" ADD CONSTRAINT "PortRequest_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
