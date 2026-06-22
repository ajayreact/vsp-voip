-- Phase 2B Revenue Protection (additive)

CREATE TYPE "ReceivableStatus" AS ENUM ('PENDING', 'PAID', 'WRITTEN_OFF', 'CANCELLED');
CREATE TYPE "IntegrityAlertType" AS ENUM (
  'NUMBER_WITHOUT_PAID_ORDER',
  'TELNYX_NOT_IN_DB',
  'DB_NOT_IN_TELNYX',
  'INVOICE_WITHOUT_FULFILLMENT',
  'FULFILLMENT_WITHOUT_INVOICE',
  'UNPAID_FULFILLMENT'
);

ALTER TABLE "NumberOrder" ADD COLUMN IF NOT EXISTS "billTenantAutomatically" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "PhoneNumber" ADD COLUMN IF NOT EXISTS "orderId" TEXT;
ALTER TABLE "PhoneNumber" ADD COLUMN IF NOT EXISTS "source" TEXT;
ALTER TABLE "PhoneNumber" ADD COLUMN IF NOT EXISTS "telnyxUpfrontCost" DECIMAL(10,2);
ALTER TABLE "PhoneNumber" ADD COLUMN IF NOT EXISTS "telnyxMonthlyCost" DECIMAL(10,2);
ALTER TABLE "PhoneNumber" ADD COLUMN IF NOT EXISTS "platformSetupFee" DECIMAL(10,2);
ALTER TABLE "PhoneNumber" ADD COLUMN IF NOT EXISTS "platformFirstMonthFee" DECIMAL(10,2);
ALTER TABLE "PhoneNumber" ADD COLUMN IF NOT EXISTS "platformMonthlyFee" DECIMAL(10,2);
ALTER TABLE "PhoneNumber" ADD COLUMN IF NOT EXISTS "customerPriceTotal" DECIMAL(10,2);
ALTER TABLE "PhoneNumber" ADD COLUMN IF NOT EXISTS "customerPriceMonthly" DECIMAL(10,2);
ALTER TABLE "PhoneNumber" ADD COLUMN IF NOT EXISTS "grossProfitUpfront" DECIMAL(10,2);
ALTER TABLE "PhoneNumber" ADD COLUMN IF NOT EXISTS "grossProfitMonthly" DECIMAL(10,2);

CREATE INDEX IF NOT EXISTS "PhoneNumber_orderId_idx" ON "PhoneNumber"("orderId");

ALTER TABLE "PhoneNumber" DROP CONSTRAINT IF EXISTS "PhoneNumber_orderId_fkey";
ALTER TABLE "PhoneNumber" ADD CONSTRAINT "PhoneNumber_orderId_fkey"
  FOREIGN KEY ("orderId") REFERENCES "NumberOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "TenantReceivable" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "orderId" TEXT,
    "invoiceNumber" TEXT,
    "amount" DECIMAL(10,2) NOT NULL,
    "status" "ReceivableStatus" NOT NULL DEFAULT 'PENDING',
    "dueAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TenantReceivable_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "TenantReceivable_orderId_key" ON "TenantReceivable"("orderId");
CREATE INDEX IF NOT EXISTS "TenantReceivable_tenantId_idx" ON "TenantReceivable"("tenantId");
CREATE INDEX IF NOT EXISTS "TenantReceivable_status_idx" ON "TenantReceivable"("status");

ALTER TABLE "TenantReceivable" DROP CONSTRAINT IF EXISTS "TenantReceivable_tenantId_fkey";
ALTER TABLE "TenantReceivable" ADD CONSTRAINT "TenantReceivable_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TenantReceivable" DROP CONSTRAINT IF EXISTS "TenantReceivable_orderId_fkey";
ALTER TABLE "TenantReceivable" ADD CONSTRAINT "TenantReceivable_orderId_fkey"
  FOREIGN KEY ("orderId") REFERENCES "NumberOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "BillingIntegrityAlert" (
    "id" TEXT NOT NULL,
    "type" "IntegrityAlertType" NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'warning',
    "message" TEXT NOT NULL,
    "details" JSONB,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BillingIntegrityAlert_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "BillingIntegrityAlert_type_resolvedAt_idx" ON "BillingIntegrityAlert"("type", "resolvedAt");
CREATE INDEX IF NOT EXISTS "BillingIntegrityAlert_createdAt_idx" ON "BillingIntegrityAlert"("createdAt");
