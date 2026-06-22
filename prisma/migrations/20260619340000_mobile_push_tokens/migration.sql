-- AlterTable
ALTER TABLE "User" ADD COLUMN "pushDeviceToken" TEXT;
ALTER TABLE "User" ADD COLUMN "pushDevicePlatform" TEXT;
ALTER TABLE "User" ADD COLUMN "pushTokenUpdatedAt" TIMESTAMP(3);
