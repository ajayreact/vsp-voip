-- Phase 2.5: distinguish mobile vs desk provisioning tokens (hashed; never store QR payloads).
ALTER TABLE "ExtensionProvisioningToken" ADD COLUMN IF NOT EXISTS "purpose" TEXT NOT NULL DEFAULT 'mobile';

CREATE INDEX IF NOT EXISTS "ExtensionProvisioningToken_tenantId_purpose_idx"
  ON "ExtensionProvisioningToken"("tenantId", "purpose");
