-- Payment Gateway Management (additive)

-- CreateEnum
CREATE TYPE "PaymentReviewStatus" AS ENUM ('NONE', 'PENDING', 'APPROVED', 'REJECTED');
CREATE TYPE "GatewayMode" AS ENUM ('test', 'live');

-- AlterEnum OrderStatus
ALTER TYPE "OrderStatus" ADD VALUE IF NOT EXISTS 'PENDING_PAYMENT';

-- AlterEnum PaymentMethod
ALTER TYPE "PaymentMethod" ADD VALUE IF NOT EXISTS 'RAZORPAY';

-- AlterTable NumberOrder
ALTER TABLE "NumberOrder" ADD COLUMN IF NOT EXISTS "paymentProofUrl" TEXT;
ALTER TABLE "NumberOrder" ADD COLUMN IF NOT EXISTS "paymentProofUploadedAt" TIMESTAMP(3);
ALTER TABLE "NumberOrder" ADD COLUMN IF NOT EXISTS "paymentReviewStatus" "PaymentReviewStatus" NOT NULL DEFAULT 'NONE';

-- CreateTable PaymentGatewaySettings
CREATE TABLE IF NOT EXISTS "PaymentGatewaySettings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "bankTransferEnabled" BOOLEAN NOT NULL DEFAULT true,
    "stripeEnabled" BOOLEAN NOT NULL DEFAULT false,
    "razorpayEnabled" BOOLEAN NOT NULL DEFAULT false,
    "stripeMode" "GatewayMode" NOT NULL DEFAULT 'test',
    "razorpayMode" "GatewayMode" NOT NULL DEFAULT 'test',
    "displayOrder" JSONB NOT NULL DEFAULT '["bank","stripe","razorpay"]',
    "bankAccountName" TEXT,
    "bankName" TEXT,
    "bankAccountNumber" TEXT,
    "bankIfscSwift" TEXT,
    "bankBranch" TEXT,
    "bankPaymentInstructions" TEXT,
    "razorpayKeyIdEnc" TEXT,
    "razorpayKeySecretEnc" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PaymentGatewaySettings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "NumberOrder_paymentReviewStatus_idx" ON "NumberOrder"("paymentReviewStatus");

-- Seed default row; copy bank details from PlatformSettings if present
INSERT INTO "PaymentGatewaySettings" ("id", "bankTransferEnabled", "stripeEnabled", "razorpayEnabled", "updatedAt")
VALUES ('default', true, false, false, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;

UPDATE "PaymentGatewaySettings" pg
SET
  "bankAccountName" = COALESCE(pg."bankAccountName", ps."bankAccountName"),
  "bankName" = COALESCE(pg."bankName", ps."bankName"),
  "bankAccountNumber" = COALESCE(pg."bankAccountNumber", ps."bankAccountNumber"),
  "bankIfscSwift" = COALESCE(pg."bankIfscSwift", ps."bankRoutingNumber", ps."bankSwiftCode"),
  "bankPaymentInstructions" = COALESCE(pg."bankPaymentInstructions", ps."bankPaymentInstructions"),
  "updatedAt" = CURRENT_TIMESTAMP
FROM "PlatformSettings" ps
WHERE pg."id" = 'default' AND ps."id" = 'platform';
