-- Extension QR provisioning tokens (15-minute expiry)
CREATE TABLE "ExtensionProvisioningToken" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "extensionId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExtensionProvisioningToken_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ExtensionProvisioningToken_tokenHash_key" ON "ExtensionProvisioningToken"("tokenHash");
CREATE INDEX "ExtensionProvisioningToken_extensionId_expiresAt_idx" ON "ExtensionProvisioningToken"("extensionId", "expiresAt");
CREATE INDEX "ExtensionProvisioningToken_tenantId_idx" ON "ExtensionProvisioningToken"("tenantId");

ALTER TABLE "ExtensionProvisioningToken" ADD CONSTRAINT "ExtensionProvisioningToken_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ExtensionProvisioningToken" ADD CONSTRAINT "ExtensionProvisioningToken_extensionId_fkey" FOREIGN KEY ("extensionId") REFERENCES "Extension"("id") ON DELETE CASCADE ON UPDATE CASCADE;
