-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN "stripeCustomerId" TEXT;

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('PENDING', 'PAID', 'FULFILLED', 'PARTIAL', 'FAILED');

-- CreateTable
CREATE TABLE "NumberOrder" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'PENDING',
    "stripeSessionId" TEXT,
    "connectionId" TEXT,
    "phoneNumbers" JSONB NOT NULL,
    "carrierUpfront" DECIMAL(10,2) NOT NULL,
    "carrierMonthly" DECIMAL(10,2) NOT NULL,
    "platformFee" DECIMAL(10,2) NOT NULL,
    "totalCharged" DECIMAL(10,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "fulfillmentNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NumberOrder_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "NumberOrder_stripeSessionId_key" ON "NumberOrder"("stripeSessionId");

-- CreateIndex
CREATE INDEX "NumberOrder_tenantId_idx" ON "NumberOrder"("tenantId");

-- AddForeignKey
ALTER TABLE "NumberOrder" ADD CONSTRAINT "NumberOrder_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
