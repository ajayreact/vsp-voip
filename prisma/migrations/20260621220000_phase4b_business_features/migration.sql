-- Phase 4B: Business phone features (DND schedule, forwarding schedule destination)

CREATE TYPE "DndInboundAction" AS ENUM ('VOICEMAIL', 'FORWARD');

ALTER TABLE "Extension" ADD COLUMN "dndReason" TEXT;
ALTER TABLE "Extension" ADD COLUMN "dndSchedule" JSONB;
ALTER TABLE "Extension" ADD COLUMN "dndScheduledEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Extension" ADD COLUMN "dndInboundAction" "DndInboundAction" NOT NULL DEFAULT 'VOICEMAIL';

ALTER TABLE "ExtensionForwarding" ADD COLUMN "scheduleDestinationType" "ForwardDestinationType";
ALTER TABLE "ExtensionForwarding" ADD COLUMN "scheduleDestination" TEXT;
