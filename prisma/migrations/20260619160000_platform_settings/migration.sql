-- CreateTable
CREATE TABLE "PlatformSettings" (
    "id" TEXT NOT NULL DEFAULT 'platform',
    "stripeSecretKeyEnc" TEXT,
    "stripeWebhookSecretEnc" TEXT,
    "stripePublishableKey" TEXT,
    "defaultFeeSetup" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "defaultFeeMonthly" DECIMAL(10,2) NOT NULL DEFAULT 8,
    "defaultFeeFirstMonth" DECIMAL(10,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformSettings_pkey" PRIMARY KEY ("id")
);
