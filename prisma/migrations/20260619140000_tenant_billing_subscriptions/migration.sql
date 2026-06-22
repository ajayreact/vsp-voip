-- AlterTable Tenant billing rates
ALTER TABLE "Tenant" ADD COLUMN "platformFeeSetup" DECIMAL(10,2) NOT NULL DEFAULT 0;
ALTER TABLE "Tenant" ADD COLUMN "platformFeeMonthly" DECIMAL(10,2) NOT NULL DEFAULT 8;
ALTER TABLE "Tenant" ADD COLUMN "platformFeeFirstMonth" DECIMAL(10,2);
ALTER TABLE "Tenant" ADD COLUMN "stripeSubscriptionId" TEXT;

-- AlterTable PhoneNumber subscription tracking
ALTER TABLE "PhoneNumber" ADD COLUMN "stripeSubscriptionItemId" TEXT;
ALTER TABLE "PhoneNumber" ADD COLUMN "carrierMonthly" DECIMAL(10,2);
ALTER TABLE "PhoneNumber" ADD COLUMN "platformMonthly" DECIMAL(10,2);
ALTER TABLE "PhoneNumber" ADD COLUMN "tenantMonthlyTotal" DECIMAL(10,2);

-- AlterTable NumberOrder subscription id
ALTER TABLE "NumberOrder" ADD COLUMN "stripeSubscriptionId" TEXT;
