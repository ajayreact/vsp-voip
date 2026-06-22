-- AlterTable
ALTER TABLE "Greeting" ADD COLUMN     "forwardEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "forwardNumber" TEXT,
ADD COLUMN     "playGreetingBeforeConnect" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "ringGroupEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "ringGroupName" TEXT,
ADD COLUMN     "ringGroupMembers" JSONB,
ADD COLUMN     "ringStrategy" TEXT NOT NULL DEFAULT 'simultaneous',
ADD COLUMN     "ringTimeout" INTEGER NOT NULL DEFAULT 25,
ADD COLUMN     "noAnswerMessage" TEXT;
