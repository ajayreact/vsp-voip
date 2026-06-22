-- AlterTable
ALTER TABLE "Greeting" ADD COLUMN     "voicemailEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "voicemailPrompt" TEXT,
ADD COLUMN     "voicemailMaxLength" INTEGER NOT NULL DEFAULT 120,
ADD COLUMN     "afterHoursVoicemailEnabled" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "Voicemail" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "callSid" TEXT,
    "recordingSid" TEXT,
    "from" TEXT NOT NULL,
    "to" TEXT NOT NULL,
    "recordingUrl" TEXT NOT NULL,
    "durationSeconds" INTEGER,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Voicemail_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Voicemail_recordingSid_key" ON "Voicemail"("recordingSid");

-- CreateIndex
CREATE INDEX "Voicemail_tenantId_createdAt_idx" ON "Voicemail"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "Voicemail_tenantId_isRead_idx" ON "Voicemail"("tenantId", "isRead");

-- AddForeignKey
ALTER TABLE "Voicemail" ADD CONSTRAINT "Voicemail_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
