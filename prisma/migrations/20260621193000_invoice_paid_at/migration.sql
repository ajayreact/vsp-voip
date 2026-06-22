-- Invoice paid tracking for bank transfer orders
ALTER TABLE "NumberOrder" ADD COLUMN IF NOT EXISTS "invoicePaidAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "NumberOrder_invoicePaidAt_idx" ON "NumberOrder"("invoicePaidAt");
