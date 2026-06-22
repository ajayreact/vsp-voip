-- Phase 3A Razorpay integration

ALTER TABLE "NumberOrder" ADD COLUMN IF NOT EXISTS "razorpayOrderId" TEXT;
ALTER TABLE "NumberOrder" ADD COLUMN IF NOT EXISTS "razorpayPaymentId" TEXT;
ALTER TABLE "NumberOrder" ADD COLUMN IF NOT EXISTS "paymentFailureReason" TEXT;
ALTER TABLE "NumberOrder" ADD COLUMN IF NOT EXISTS "refundId" TEXT;
ALTER TABLE "NumberOrder" ADD COLUMN IF NOT EXISTS "refundedAt" TIMESTAMP(3);
ALTER TABLE "NumberOrder" ADD COLUMN IF NOT EXISTS "refundAmount" DECIMAL(10,2);

CREATE UNIQUE INDEX IF NOT EXISTS "NumberOrder_razorpayOrderId_key" ON "NumberOrder"("razorpayOrderId");
CREATE INDEX IF NOT EXISTS "NumberOrder_razorpayPaymentId_idx" ON "NumberOrder"("razorpayPaymentId");
CREATE INDEX IF NOT EXISTS "NumberOrder_paymentMethod_status_idx" ON "NumberOrder"("paymentMethod", "status");

ALTER TABLE "PaymentGatewaySettings" ADD COLUMN IF NOT EXISTS "razorpayWebhookSecretEnc" TEXT;

CREATE TABLE IF NOT EXISTS "ProcessedRazorpayEvent" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "orderId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProcessedRazorpayEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ProcessedRazorpayEvent_createdAt_idx" ON "ProcessedRazorpayEvent"("createdAt");

CREATE TABLE IF NOT EXISTS "PaymentRefund" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "paymentMethod" "PaymentMethod" NOT NULL,
    "gatewayPaymentId" TEXT,
    "gatewayRefundId" TEXT,
    "amount" DECIMAL(10,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "status" TEXT NOT NULL DEFAULT 'processed',
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PaymentRefund_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "PaymentRefund_orderId_idx" ON "PaymentRefund"("orderId");
CREATE INDEX IF NOT EXISTS "PaymentRefund_tenantId_idx" ON "PaymentRefund"("tenantId");
CREATE INDEX IF NOT EXISTS "PaymentRefund_paymentMethod_idx" ON "PaymentRefund"("paymentMethod");

ALTER TABLE "PaymentRefund" DROP CONSTRAINT IF EXISTS "PaymentRefund_orderId_fkey";
ALTER TABLE "PaymentRefund" ADD CONSTRAINT "PaymentRefund_orderId_fkey"
  FOREIGN KEY ("orderId") REFERENCES "NumberOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PaymentRefund" DROP CONSTRAINT IF EXISTS "PaymentRefund_tenantId_fkey";
ALTER TABLE "PaymentRefund" ADD CONSTRAINT "PaymentRefund_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
