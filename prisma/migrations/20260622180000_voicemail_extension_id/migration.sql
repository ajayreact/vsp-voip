-- AlterTable
ALTER TABLE "Voicemail" ADD COLUMN "extensionId" TEXT;

-- CreateIndex
CREATE INDEX "Voicemail_extensionId_createdAt_idx" ON "Voicemail"("extensionId", "createdAt");

-- AddForeignKey
ALTER TABLE "Voicemail" ADD CONSTRAINT "Voicemail_extensionId_fkey" FOREIGN KEY ("extensionId") REFERENCES "Extension"("id") ON DELETE SET NULL ON UPDATE CASCADE;
