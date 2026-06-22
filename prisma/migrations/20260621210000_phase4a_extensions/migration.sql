-- Phase 4A: Extension Management System

CREATE TYPE "ExtensionStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'SUSPENDED');
CREATE TYPE "ExtensionDeviceType" AS ENUM ('WEBRTC', 'MOBILE', 'SIP');
CREATE TYPE "ExtensionDeviceStatus" AS ENUM ('ONLINE', 'OFFLINE', 'EXPIRED');
CREATE TYPE "ForwardDestinationType" AS ENUM ('EXTENSION', 'RING_GROUP', 'EXTERNAL_NUMBER');

CREATE TABLE "Extension" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "extensionNumber" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "email" TEXT,
    "status" "ExtensionStatus" NOT NULL DEFAULT 'ACTIVE',
    "department" TEXT,
    "userId" TEXT,
    "lastActivityAt" TIMESTAMP(3),
    "voicemailEnabled" BOOLEAN NOT NULL DEFAULT true,
    "callRecordingEnabled" BOOLEAN NOT NULL DEFAULT true,
    "doNotDisturb" BOOLEAN NOT NULL DEFAULT false,
    "callScreeningEnabled" BOOLEAN NOT NULL DEFAULT false,
    "intercomEnabled" BOOLEAN NOT NULL DEFAULT false,
    "webrtcEnabled" BOOLEAN NOT NULL DEFAULT true,
    "sipEnabled" BOOLEAN NOT NULL DEFAULT false,
    "multiDeviceEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Extension_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ExtensionForwarding" (
    "id" TEXT NOT NULL,
    "extensionId" TEXT NOT NULL,
    "alwaysEnabled" BOOLEAN NOT NULL DEFAULT false,
    "alwaysDestinationType" "ForwardDestinationType",
    "alwaysDestination" TEXT,
    "busyEnabled" BOOLEAN NOT NULL DEFAULT false,
    "busyDestinationType" "ForwardDestinationType",
    "busyDestination" TEXT,
    "noAnswerEnabled" BOOLEAN NOT NULL DEFAULT false,
    "noAnswerDestinationType" "ForwardDestinationType",
    "noAnswerDestination" TEXT,
    "scheduleEnabled" BOOLEAN NOT NULL DEFAULT false,
    "scheduleRules" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExtensionForwarding_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ExtensionDevice" (
    "id" TEXT NOT NULL,
    "extensionId" TEXT NOT NULL,
    "deviceType" "ExtensionDeviceType" NOT NULL,
    "deviceName" TEXT,
    "platform" TEXT,
    "userDeviceId" TEXT,
    "status" "ExtensionDeviceStatus" NOT NULL DEFAULT 'OFFLINE',
    "lastRegistrationAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExtensionDevice_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ExtensionSecurity" (
    "id" TEXT NOT NULL,
    "extensionId" TEXT NOT NULL,
    "whitelist" JSONB NOT NULL DEFAULT '[]',
    "blacklist" JSONB NOT NULL DEFAULT '[]',
    "blockAnonymous" BOOLEAN NOT NULL DEFAULT false,
    "internationalEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExtensionSecurity_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ExtensionVoicemailSettings" (
    "id" TEXT NOT NULL,
    "extensionId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "greetingUrl" TEXT,
    "emailNotifications" BOOLEAN NOT NULL DEFAULT false,
    "notificationEmail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExtensionVoicemailSettings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Extension_tenantId_extensionNumber_key" ON "Extension"("tenantId", "extensionNumber");
CREATE INDEX "Extension_tenantId_status_idx" ON "Extension"("tenantId", "status");
CREATE INDEX "Extension_tenantId_department_idx" ON "Extension"("tenantId", "department");
CREATE INDEX "Extension_userId_idx" ON "Extension"("userId");

CREATE UNIQUE INDEX "ExtensionForwarding_extensionId_key" ON "ExtensionForwarding"("extensionId");

CREATE INDEX "ExtensionDevice_extensionId_deviceType_idx" ON "ExtensionDevice"("extensionId", "deviceType");
CREATE INDEX "ExtensionDevice_extensionId_status_idx" ON "ExtensionDevice"("extensionId", "status");

CREATE UNIQUE INDEX "ExtensionSecurity_extensionId_key" ON "ExtensionSecurity"("extensionId");
CREATE UNIQUE INDEX "ExtensionVoicemailSettings_extensionId_key" ON "ExtensionVoicemailSettings"("extensionId");

ALTER TABLE "Extension" ADD CONSTRAINT "Extension_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Extension" ADD CONSTRAINT "Extension_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ExtensionForwarding" ADD CONSTRAINT "ExtensionForwarding_extensionId_fkey" FOREIGN KEY ("extensionId") REFERENCES "Extension"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ExtensionDevice" ADD CONSTRAINT "ExtensionDevice_extensionId_fkey" FOREIGN KEY ("extensionId") REFERENCES "Extension"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ExtensionSecurity" ADD CONSTRAINT "ExtensionSecurity_extensionId_fkey" FOREIGN KEY ("extensionId") REFERENCES "Extension"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ExtensionVoicemailSettings" ADD CONSTRAINT "ExtensionVoicemailSettings_extensionId_fkey" FOREIGN KEY ("extensionId") REFERENCES "Extension"("id") ON DELETE CASCADE ON UPDATE CASCADE;
