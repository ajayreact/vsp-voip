-- Allow Super Admin DID pool (unassigned numbers) and assignment history.

ALTER TABLE "PhoneNumber" ALTER COLUMN "tenantId" DROP NOT NULL;

CREATE TABLE "DidAssignmentHistory" (
    "id" TEXT NOT NULL,
    "phoneNumberId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "tenantId" TEXT,
    "previousTenantId" TEXT,
    "action" TEXT NOT NULL,
    "assignedByUserId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DidAssignmentHistory_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "DidAssignmentHistory_phoneNumberId_createdAt_idx" ON "DidAssignmentHistory"("phoneNumberId", "createdAt");
CREATE INDEX "DidAssignmentHistory_number_createdAt_idx" ON "DidAssignmentHistory"("number", "createdAt");
CREATE INDEX "DidAssignmentHistory_tenantId_createdAt_idx" ON "DidAssignmentHistory"("tenantId", "createdAt");

ALTER TABLE "DidAssignmentHistory" ADD CONSTRAINT "DidAssignmentHistory_phoneNumberId_fkey" FOREIGN KEY ("phoneNumberId") REFERENCES "PhoneNumber"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DidAssignmentHistory" ADD CONSTRAINT "DidAssignmentHistory_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
