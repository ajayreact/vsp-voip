-- AlterTable
ALTER TABLE "User" ADD COLUMN "sipRegistered" BOOLEAN,
ADD COLUMN "sipRegistrationCheckedAt" TIMESTAMP(3),
ADD COLUMN "sipRegistrationResponse" TEXT,
ADD COLUMN "sipRegistrationSource" TEXT;

-- CreateTable
CREATE TABLE "CallQualityMetric" (
    "id" TEXT NOT NULL,
    "callSessionId" TEXT,
    "callControlId" TEXT,
    "tenantId" TEXT,
    "direction" TEXT,
    "from" TEXT,
    "to" TEXT,
    "mosInbound" DECIMAL(4,2),
    "mosOutbound" DECIMAL(4,2),
    "jitterMaxVariance" DECIMAL(10,2),
    "jitterPacketCount" INTEGER,
    "packetCount" INTEGER,
    "skipPacketCount" INTEGER,
    "hangupCause" TEXT,
    "hangupSource" TEXT,
    "eventType" TEXT NOT NULL DEFAULT 'call.hangup',
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CallQualityMetric_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CallQualityMetric_tenantId_occurredAt_idx" ON "CallQualityMetric"("tenantId", "occurredAt");

-- CreateIndex
CREATE INDEX "CallQualityMetric_occurredAt_idx" ON "CallQualityMetric"("occurredAt");

-- CreateIndex
CREATE INDEX "CallQualityMetric_callSessionId_idx" ON "CallQualityMetric"("callSessionId");

-- AddForeignKey
ALTER TABLE "CallQualityMetric" ADD CONSTRAINT "CallQualityMetric_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
