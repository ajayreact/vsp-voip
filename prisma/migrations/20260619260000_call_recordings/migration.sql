-- AlterTable
ALTER TABLE "Greeting" ADD COLUMN     "callRecordingEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "callRecordingNotice" TEXT,
ADD COLUMN     "playCallRecordingNotice" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "CallRecording" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "callSid" TEXT,
    "recordingSid" TEXT,
    "from" TEXT NOT NULL,
    "to" TEXT NOT NULL,
    "recordingUrl" TEXT NOT NULL,
    "durationSeconds" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CallRecording_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CallRecording_recordingSid_key" ON "CallRecording"("recordingSid");

-- CreateIndex
CREATE INDEX "CallRecording_tenantId_createdAt_idx" ON "CallRecording"("tenantId", "createdAt");

-- AddForeignKey
ALTER TABLE "CallRecording" ADD CONSTRAINT "CallRecording_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
