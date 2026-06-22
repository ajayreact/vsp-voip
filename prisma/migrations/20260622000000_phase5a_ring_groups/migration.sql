-- Phase 5A: Ring Groups

CREATE TYPE "RingStrategy" AS ENUM ('SIMULTANEOUS', 'SEQUENTIAL', 'ROUND_ROBIN', 'LONGEST_IDLE');

CREATE TABLE "RingGroup" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "extensionNumber" TEXT,
    "ringStrategy" "RingStrategy" NOT NULL DEFAULT 'SIMULTANEOUS',
    "ringTimeoutSeconds" INTEGER NOT NULL DEFAULT 25,
    "roundRobinPointer" INTEGER NOT NULL DEFAULT 0,
    "voicemailEnabled" BOOLEAN NOT NULL DEFAULT true,
    "voicemailGreetingUrl" TEXT,
    "callRecordingEnabled" BOOLEAN NOT NULL DEFAULT true,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "callsOffered" INTEGER NOT NULL DEFAULT 0,
    "callsAnswered" INTEGER NOT NULL DEFAULT 0,
    "callsMissed" INTEGER NOT NULL DEFAULT 0,
    "totalAnswerTimeMs" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RingGroup_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RingGroupMember" (
    "id" TEXT NOT NULL,
    "ringGroupId" TEXT NOT NULL,
    "extensionId" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "lastAnsweredAt" TIMESTAMP(3),
    "lastRungAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RingGroupMember_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "PhoneNumber" ADD COLUMN "ringGroupId" TEXT;

ALTER TABLE "Voicemail" ADD COLUMN "ringGroupId" TEXT;

ALTER TABLE "CallLog" ADD COLUMN "ringGroupId" TEXT;
ALTER TABLE "CallLog" ADD COLUMN "offeredAt" TIMESTAMP(3);
ALTER TABLE "CallLog" ADD COLUMN "answeredAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "RingGroup_tenantId_name_key" ON "RingGroup"("tenantId", "name");
CREATE UNIQUE INDEX "RingGroup_tenantId_extensionNumber_key" ON "RingGroup"("tenantId", "extensionNumber");
CREATE INDEX "RingGroup_tenantId_isActive_idx" ON "RingGroup"("tenantId", "isActive");

CREATE UNIQUE INDEX "RingGroupMember_ringGroupId_extensionId_key" ON "RingGroupMember"("ringGroupId", "extensionId");
CREATE INDEX "RingGroupMember_ringGroupId_priority_idx" ON "RingGroupMember"("ringGroupId", "priority");
CREATE INDEX "RingGroupMember_extensionId_idx" ON "RingGroupMember"("extensionId");

CREATE INDEX "PhoneNumber_ringGroupId_idx" ON "PhoneNumber"("ringGroupId");
CREATE INDEX "Voicemail_ringGroupId_createdAt_idx" ON "Voicemail"("ringGroupId", "createdAt");
CREATE INDEX "CallLog_ringGroupId_createdAt_idx" ON "CallLog"("ringGroupId", "createdAt");

ALTER TABLE "RingGroup" ADD CONSTRAINT "RingGroup_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RingGroupMember" ADD CONSTRAINT "RingGroupMember_ringGroupId_fkey" FOREIGN KEY ("ringGroupId") REFERENCES "RingGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RingGroupMember" ADD CONSTRAINT "RingGroupMember_extensionId_fkey" FOREIGN KEY ("extensionId") REFERENCES "Extension"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PhoneNumber" ADD CONSTRAINT "PhoneNumber_ringGroupId_fkey" FOREIGN KEY ("ringGroupId") REFERENCES "RingGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Voicemail" ADD CONSTRAINT "Voicemail_ringGroupId_fkey" FOREIGN KEY ("ringGroupId") REFERENCES "RingGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CallLog" ADD CONSTRAINT "CallLog_ringGroupId_fkey" FOREIGN KEY ("ringGroupId") REFERENCES "RingGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;
