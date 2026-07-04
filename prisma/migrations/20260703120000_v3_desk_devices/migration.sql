-- V3 Portal Phase 3: desk phone inventory (additive, isolated from telephony runtime)

CREATE TYPE "V3DeskDeviceStatus" AS ENUM ('CREATED', 'ASSIGNED', 'PROVISIONED', 'REGISTERED', 'REMOVED');

CREATE TABLE "V3DeskDevice" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "vendor" TEXT NOT NULL,
    "model" TEXT,
    "macAddress" TEXT,
    "serialNumber" TEXT,
    "firmwareVersion" TEXT,
    "employeeId" TEXT,
    "extensionId" TEXT,
    "notes" TEXT,
    "provisionUrl" TEXT,
    "configVersion" INTEGER NOT NULL DEFAULT 1,
    "provisionVersion" INTEGER NOT NULL DEFAULT 1,
    "status" "V3DeskDeviceStatus" NOT NULL DEFAULT 'CREATED',
    "lastProvisionedAt" TIMESTAMP(3),
    "lastSeenAt" TIMESTAMP(3),
    "lastRegistrationAt" TIMESTAMP(3),
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "removedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "V3DeskDevice_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "V3DeskDevice_tenantId_macAddress_key" ON "V3DeskDevice"("tenantId", "macAddress");
CREATE INDEX "V3DeskDevice_tenantId_status_idx" ON "V3DeskDevice"("tenantId", "status");
CREATE INDEX "V3DeskDevice_tenantId_extensionId_idx" ON "V3DeskDevice"("tenantId", "extensionId");
CREATE INDEX "V3DeskDevice_tenantId_employeeId_idx" ON "V3DeskDevice"("tenantId", "employeeId");

ALTER TABLE "V3DeskDevice" ADD CONSTRAINT "V3DeskDevice_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
