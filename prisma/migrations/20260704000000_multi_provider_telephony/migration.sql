-- VSP Phone V3 — Multi-Provider Telephony Architecture (Phase 4)
--
-- Purely additive migration: introduces a per-tenant telephony provider
-- mapping (Provider/TenantProvider), provider-scoped credentials, and
-- provider-neutral external resource IDs for phone numbers and SIP
-- endpoints. No existing column, table, or constraint is dropped, renamed,
-- or altered in a breaking way. All pre-existing telnyx*-prefixed columns
-- on User/Extension/PhoneNumber/PlatformSettings/SmsMessage/Message are
-- untouched and remain the source of truth for legacy production traffic.

-- CreateEnum
CREATE TYPE "ProviderCredentialScope" AS ENUM ('VOICE', 'MESSAGING', 'SIP');

-- AlterTable (additive column only)
ALTER TABLE "PlatformSettings" ADD COLUMN "defaultProviderId" TEXT;

-- CreateTable
CREATE TABLE "Provider" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "capabilities" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Provider_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TenantProvider" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT true,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "config" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TenantProvider_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProviderCredential" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "providerId" TEXT NOT NULL,
    "scope" "ProviderCredentialScope" NOT NULL,
    "externalAccountId" TEXT,
    "secretEnc" TEXT,
    "authTokenEnc" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProviderCredential_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProviderNumber" (
    "id" TEXT NOT NULL,
    "phoneNumberId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "externalNumberId" TEXT,
    "externalConnectionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProviderNumber_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProviderEndpoint" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "extensionId" TEXT,
    "providerId" TEXT NOT NULL,
    "externalCredentialId" TEXT,
    "sipUsername" TEXT,
    "sipPasswordEnc" TEXT,
    "sipServer" TEXT,
    "transport" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProviderEndpoint_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Provider_key_key" ON "Provider"("key");
CREATE INDEX "Provider_isActive_idx" ON "Provider"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "TenantProvider_tenantId_providerId_key" ON "TenantProvider"("tenantId", "providerId");
CREATE INDEX "TenantProvider_tenantId_isPrimary_idx" ON "TenantProvider"("tenantId", "isPrimary");

-- CreateIndex
CREATE INDEX "ProviderCredential_tenantId_idx" ON "ProviderCredential"("tenantId");
CREATE INDEX "ProviderCredential_providerId_scope_idx" ON "ProviderCredential"("providerId", "scope");

-- CreateIndex
CREATE UNIQUE INDEX "ProviderNumber_phoneNumberId_key" ON "ProviderNumber"("phoneNumberId");
CREATE INDEX "ProviderNumber_providerId_idx" ON "ProviderNumber"("providerId");

-- CreateIndex
CREATE INDEX "ProviderEndpoint_userId_idx" ON "ProviderEndpoint"("userId");
CREATE INDEX "ProviderEndpoint_extensionId_idx" ON "ProviderEndpoint"("extensionId");
CREATE INDEX "ProviderEndpoint_providerId_idx" ON "ProviderEndpoint"("providerId");

-- AddForeignKey
ALTER TABLE "TenantProvider" ADD CONSTRAINT "TenantProvider_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TenantProvider" ADD CONSTRAINT "TenantProvider_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "Provider"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderCredential" ADD CONSTRAINT "ProviderCredential_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProviderCredential" ADD CONSTRAINT "ProviderCredential_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "Provider"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderNumber" ADD CONSTRAINT "ProviderNumber_phoneNumberId_fkey" FOREIGN KEY ("phoneNumberId") REFERENCES "PhoneNumber"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProviderNumber" ADD CONSTRAINT "ProviderNumber_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "Provider"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderEndpoint" ADD CONSTRAINT "ProviderEndpoint_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProviderEndpoint" ADD CONSTRAINT "ProviderEndpoint_extensionId_fkey" FOREIGN KEY ("extensionId") REFERENCES "Extension"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProviderEndpoint" ADD CONSTRAINT "ProviderEndpoint_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "Provider"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Seed: register the Telnyx provider row so ProviderResolver has a default
-- to fall back to. TenantProvider backfill (one row per existing tenant) is
-- handled by scripts/seed-provider-tables.js, run post-deploy, so that the
-- backfill logic can be re-run safely/idempotently outside of migration DDL.
INSERT INTO "Provider" ("id", "key", "displayName", "isActive", "capabilities", "createdAt", "updatedAt")
VALUES (
    'telnyx',
    'telnyx',
    'Telnyx',
    true,
    '{"voice": true, "sip": true, "numbers": true, "recording": true, "ivr": true, "queue": true, "ringGroups": true, "conference": true, "messaging": true}',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
)
ON CONFLICT ("key") DO NOTHING;
