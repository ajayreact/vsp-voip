-- Phase 2A Production Hardening
-- ALL CHANGES ARE ADDITIVE — no DROP, no ALTER COLUMN type changes, no data deletion.

-- CreateEnum (BillingStatus)
CREATE TYPE "BillingStatus" AS ENUM ('ACTIVE', 'GRACE', 'SUSPENDED');

-- AlterTable Tenant: grace period fields (nullable / defaulted)
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "billingStatus" "BillingStatus" NOT NULL DEFAULT 'ACTIVE';
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "billingGraceUntil" TIMESTAMP(3);
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "paymentFailedAt" TIMESTAMP(3);

-- CreateTable ProcessedStripeEvent
CREATE TABLE IF NOT EXISTS "ProcessedStripeEvent" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "orderId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProcessedStripeEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable FulfillmentLock
CREATE TABLE IF NOT EXISTS "FulfillmentLock" (
    "orderId" TEXT NOT NULL,
    "lockedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lockedBy" TEXT,
    CONSTRAINT "FulfillmentLock_pkey" PRIMARY KEY ("orderId")
);

-- CreateIndex (additive)
CREATE INDEX IF NOT EXISTS "Tenant_stripeCustomerId_idx" ON "Tenant"("stripeCustomerId");
CREATE INDEX IF NOT EXISTS "Tenant_stripeSubscriptionId_idx" ON "Tenant"("stripeSubscriptionId");
CREATE INDEX IF NOT EXISTS "User_tenantId_role_idx" ON "User"("tenantId", "role");
CREATE INDEX IF NOT EXISTS "CallLog_tenantId_status_createdAt_idx" ON "CallLog"("tenantId", "status", "createdAt");
CREATE INDEX IF NOT EXISTS "NumberOrder_tenantId_status_idx" ON "NumberOrder"("tenantId", "status");
CREATE INDEX IF NOT EXISTS "ProcessedStripeEvent_createdAt_idx" ON "ProcessedStripeEvent"("createdAt");
