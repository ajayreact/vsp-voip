-- CreateEnum
CREATE TYPE "V3TestLabRunStatus" AS ENUM ('RUNNING', 'SUCCESS', 'FAILED', 'PARTIAL', 'CLEANED_UP');

-- CreateTable
CREATE TABLE "V3TestLabRun" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "tenantName" TEXT,
    "status" "V3TestLabRunStatus" NOT NULL DEFAULT 'RUNNING',
    "employeeCount" INTEGER NOT NULL DEFAULT 20,
    "simulateNumbers" BOOLEAN NOT NULL DEFAULT true,
    "teardownOnFinish" BOOLEAN NOT NULL DEFAULT true,
    "steps" JSONB NOT NULL DEFAULT '[]',
    "summary" JSONB,
    "report" JSONB,
    "overallPass" BOOLEAN,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "V3TestLabRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "V3TestLabRun_status_createdAt_idx" ON "V3TestLabRun"("status", "createdAt");

-- CreateIndex
CREATE INDEX "V3TestLabRun_tenantId_idx" ON "V3TestLabRun"("tenantId");
