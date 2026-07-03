-- V3 Portal Phase 6: Softphone profiles, preferences, presence (UX layer — no runtime)

CREATE TABLE "V3SoftphoneProfile" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "preferredCallerId" TEXT,
    "preferredDevice" TEXT,
    "defaultAudioDevice" TEXT,
    "ringDevice" TEXT,
    "theme" TEXT NOT NULL DEFAULT 'system',
    "language" TEXT NOT NULL DEFAULT 'en',
    "timezone" TEXT,
    "callRecordingPreference" TEXT NOT NULL DEFAULT 'inherit',
    "autoAnswer" BOOLEAN NOT NULL DEFAULT false,
    "dnd" BOOLEAN NOT NULL DEFAULT false,
    "busy" BOOLEAN NOT NULL DEFAULT false,
    "away" BOOLEAN NOT NULL DEFAULT false,
    "presenceVisibility" TEXT NOT NULL DEFAULT 'everyone',
    "favoriteContactIds" JSONB NOT NULL DEFAULT '[]',
    "speedDial" JSONB NOT NULL DEFAULT '[]',
    "recentContacts" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "V3SoftphoneProfile_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "V3UserPreference" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "preferences" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "V3UserPreference_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "V3DevicePreference" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "deviceType" TEXT NOT NULL,
    "deviceAlias" TEXT,
    "lastActiveAt" TIMESTAMP(3),
    "preferred" BOOLEAN NOT NULL DEFAULT false,
    "notificationPreference" TEXT NOT NULL DEFAULT 'all',
    "ringPreference" TEXT NOT NULL DEFAULT 'default',
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "V3DevicePreference_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "V3PresenceConfig" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'available',
    "message" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "V3PresenceConfig_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "V3SoftphoneProfile_tenantId_userId_key" ON "V3SoftphoneProfile"("tenantId", "userId");
CREATE INDEX "V3SoftphoneProfile_tenantId_idx" ON "V3SoftphoneProfile"("tenantId");

CREATE UNIQUE INDEX "V3UserPreference_tenantId_userId_key" ON "V3UserPreference"("tenantId", "userId");
CREATE INDEX "V3UserPreference_tenantId_idx" ON "V3UserPreference"("tenantId");

CREATE UNIQUE INDEX "V3DevicePreference_tenantId_userId_deviceType_deviceAlias_key" ON "V3DevicePreference"("tenantId", "userId", "deviceType", "deviceAlias");
CREATE INDEX "V3DevicePreference_tenantId_userId_idx" ON "V3DevicePreference"("tenantId", "userId");

CREATE UNIQUE INDEX "V3PresenceConfig_tenantId_userId_key" ON "V3PresenceConfig"("tenantId", "userId");
CREATE INDEX "V3PresenceConfig_tenantId_status_idx" ON "V3PresenceConfig"("tenantId", "status");

ALTER TABLE "V3SoftphoneProfile" ADD CONSTRAINT "V3SoftphoneProfile_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "V3UserPreference" ADD CONSTRAINT "V3UserPreference_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "V3DevicePreference" ADD CONSTRAINT "V3DevicePreference_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "V3PresenceConfig" ADD CONSTRAINT "V3PresenceConfig_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
