-- V3 Portal Phase 5: PBX configuration objects (design-time only, no live routing)

CREATE TABLE "V3RingGroup" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "extensionNumber" TEXT,
    "strategy" TEXT NOT NULL DEFAULT 'SIMULTANEOUS',
    "memberExtensionIds" JSONB NOT NULL DEFAULT '[]',
    "ringTimeoutSeconds" INTEGER NOT NULL DEFAULT 25,
    "overflowDestination" JSONB,
    "musicOnHold" JSONB,
    "failoverDestination" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "removedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "V3RingGroup_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "V3Queue" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "queueNumber" TEXT,
    "strategy" TEXT NOT NULL DEFAULT 'ROUND_ROBIN',
    "agentExtensionIds" JSONB NOT NULL DEFAULT '[]',
    "wrapUpTimeSeconds" INTEGER NOT NULL DEFAULT 0,
    "maxWaiting" INTEGER NOT NULL DEFAULT 50,
    "queueTimeoutSeconds" INTEGER NOT NULL DEFAULT 120,
    "overflowDestination" JSONB,
    "musicOnHold" JSONB,
    "stats" JSONB NOT NULL DEFAULT '{"callsOffered":0,"callsAnswered":0,"callsAbandoned":0,"avgWaitSeconds":0}',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "removedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "V3Queue_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "V3BusinessHoursSchedule" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'America/New_York',
    "weekdays" JSONB NOT NULL DEFAULT '{}',
    "weekends" JSONB NOT NULL DEFAULT '{}',
    "lunchBreak" JSONB,
    "closedHours" JSONB,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "removedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "V3BusinessHoursSchedule_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "V3Holiday" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "recurring" BOOLEAN NOT NULL DEFAULT false,
    "oneTime" BOOLEAN NOT NULL DEFAULT true,
    "overrideDestination" JSONB,
    "removedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "V3Holiday_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "V3VoicemailBox" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "mailboxNumber" TEXT NOT NULL,
    "extensionId" TEXT,
    "greeting" JSONB,
    "emailDelivery" JSONB,
    "pin" TEXT,
    "storageLimitMb" INTEGER NOT NULL DEFAULT 100,
    "notification" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "removedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "V3VoicemailBox_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "V3RingGroup_tenantId_name_key" ON "V3RingGroup"("tenantId", "name");
CREATE INDEX "V3RingGroup_tenantId_removedAt_idx" ON "V3RingGroup"("tenantId", "removedAt");

CREATE UNIQUE INDEX "V3Queue_tenantId_name_key" ON "V3Queue"("tenantId", "name");
CREATE INDEX "V3Queue_tenantId_removedAt_idx" ON "V3Queue"("tenantId", "removedAt");

CREATE UNIQUE INDEX "V3BusinessHoursSchedule_tenantId_name_key" ON "V3BusinessHoursSchedule"("tenantId", "name");
CREATE INDEX "V3BusinessHoursSchedule_tenantId_removedAt_idx" ON "V3BusinessHoursSchedule"("tenantId", "removedAt");

CREATE INDEX "V3Holiday_tenantId_removedAt_idx" ON "V3Holiday"("tenantId", "removedAt");
CREATE INDEX "V3Holiday_tenantId_date_idx" ON "V3Holiday"("tenantId", "date");

CREATE UNIQUE INDEX "V3VoicemailBox_tenantId_mailboxNumber_key" ON "V3VoicemailBox"("tenantId", "mailboxNumber");
CREATE INDEX "V3VoicemailBox_tenantId_removedAt_idx" ON "V3VoicemailBox"("tenantId", "removedAt");

ALTER TABLE "V3RingGroup" ADD CONSTRAINT "V3RingGroup_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "V3Queue" ADD CONSTRAINT "V3Queue_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "V3BusinessHoursSchedule" ADD CONSTRAINT "V3BusinessHoursSchedule_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "V3Holiday" ADD CONSTRAINT "V3Holiday_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "V3VoicemailBox" ADD CONSTRAINT "V3VoicemailBox_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
