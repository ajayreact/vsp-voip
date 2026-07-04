-- V3 Portal: Call Flow Builder engine (design/simulate only — no live routing)

CREATE TYPE "V3CallFlowStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

CREATE TABLE "V3CallFlow" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "did" TEXT,
    "status" "V3CallFlowStatus" NOT NULL DEFAULT 'DRAFT',
    "definition" JSONB NOT NULL DEFAULT '{"version":1,"nodes":[],"edges":[]}',
    "version" INTEGER NOT NULL DEFAULT 1,
    "removedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "V3CallFlow_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "V3CallFlow_tenantId_status_idx" ON "V3CallFlow"("tenantId", "status");
CREATE INDEX "V3CallFlow_tenantId_did_idx" ON "V3CallFlow"("tenantId", "did");

ALTER TABLE "V3CallFlow" ADD CONSTRAINT "V3CallFlow_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
