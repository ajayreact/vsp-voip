-- AlterTable
ALTER TABLE "Greeting" ADD COLUMN "afterHoursMessage" TEXT;
ALTER TABLE "Greeting" ADD COLUMN "businessHoursEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Greeting" ADD COLUMN "businessHours" JSONB;
ALTER TABLE "Greeting" ADD COLUMN "ivrEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Greeting" ADD COLUMN "ivrPrompt" TEXT;
ALTER TABLE "Greeting" ADD COLUMN "ivrOptions" JSONB;
