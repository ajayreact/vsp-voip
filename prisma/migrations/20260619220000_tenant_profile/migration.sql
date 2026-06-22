-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN "contactEmail" TEXT;
ALTER TABLE "Tenant" ADD COLUMN "timezone" TEXT NOT NULL DEFAULT 'America/New_York';
