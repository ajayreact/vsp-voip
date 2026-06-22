-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('STRIPE', 'MANUAL_BANK');

-- AlterEnum
ALTER TYPE "OrderStatus" ADD VALUE 'CANCELLED';

-- AlterTable
ALTER TABLE "NumberOrder" ADD COLUMN "paymentMethod" "PaymentMethod" NOT NULL DEFAULT 'STRIPE';
ALTER TABLE "NumberOrder" ADD COLUMN "invoiceNumber" TEXT;
ALTER TABLE "NumberOrder" ADD COLUMN "invoiceSentAt" TIMESTAMP(3);
ALTER TABLE "NumberOrder" ADD COLUMN "invoiceEmailTo" TEXT;
ALTER TABLE "NumberOrder" ADD COLUMN "adminNotes" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "NumberOrder_invoiceNumber_key" ON "NumberOrder"("invoiceNumber");
CREATE INDEX "NumberOrder_status_idx" ON "NumberOrder"("status");

-- AlterTable
ALTER TABLE "PlatformSettings" ADD COLUMN "bankName" TEXT;
ALTER TABLE "PlatformSettings" ADD COLUMN "bankAccountName" TEXT;
ALTER TABLE "PlatformSettings" ADD COLUMN "bankAccountNumber" TEXT;
ALTER TABLE "PlatformSettings" ADD COLUMN "bankRoutingNumber" TEXT;
ALTER TABLE "PlatformSettings" ADD COLUMN "bankSwiftCode" TEXT;
ALTER TABLE "PlatformSettings" ADD COLUMN "bankPaymentInstructions" TEXT;
ALTER TABLE "PlatformSettings" ADD COLUMN "invoiceContactEmail" TEXT;
