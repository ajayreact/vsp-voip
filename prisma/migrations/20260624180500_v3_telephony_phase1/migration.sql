-- VSP Phone V3 Phase 1 — telephony infrastructure tables (additive only)

-- CreateEnum
CREATE TYPE "V3SessionState" AS ENUM ('NEW', 'ORIGIN_PARKED', 'ROUTING', 'RINGING', 'BRIDGING', 'ACTIVE', 'HELD', 'TRANSFER_PENDING', 'ENDING', 'ENDED', 'FAILED');
CREATE TYPE "V3LegState" AS ENUM ('NEW', 'DIALING', 'RINGING', 'ANSWERED', 'BRIDGED', 'HELD', 'ENDED', 'FAILED');
CREATE TYPE "V3LegRole" AS ENUM ('ORIGIN', 'TARGET', 'CONSULT', 'PSTN', 'RING_TARGET');
CREATE TYPE "V3SessionOrigin" AS ENUM ('DESK', 'MOBILE', 'PSTN_INBOUND', 'PSTN_OUTBOUND', 'API', 'SYSTEM');
CREATE TYPE "V3SessionDirection" AS ENUM ('INBOUND', 'OUTBOUND', 'INTERNAL');
CREATE TYPE "V3OutboxStatus" AS ENUM ('PENDING', 'SENT', 'ACKED', 'FAILED', 'DEAD');
CREATE TYPE "V3CommandType" AS ENUM ('DIAL', 'ANSWER', 'BRIDGE', 'HANGUP', 'SPEAK', 'PLAY', 'RECORD_START', 'RECORD_STOP');

-- CreateTable
CREATE TABLE "ProcessedTelnyxEvent" (
    "id" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "callControlId" TEXT,
    "callSessionId" TEXT,
    "tenantId" TEXT,
    "source" TEXT,
    "workerId" TEXT,
    "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProcessedTelnyxEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "V3CallSession" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "state" "V3SessionState" NOT NULL DEFAULT 'NEW',
    "origin" "V3SessionOrigin",
    "direction" "V3SessionDirection",
    "telnyxCallSessionId" TEXT,
    "primaryCallControlId" TEXT,
    "callerExtensionId" TEXT,
    "callerUserId" TEXT,
    "calleeExtensionId" TEXT,
    "didPhoneNumberId" TEXT,
    "ringGroupId" TEXT,
    "routeSnapshot" JSONB,
    "failureCode" TEXT,
    "correlationId" TEXT,
    "engineVersion" INTEGER NOT NULL DEFAULT 1,
    "version" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "answeredAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),

    CONSTRAINT "V3CallSession_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "V3CallLeg" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "callControlId" TEXT NOT NULL,
    "role" "V3LegRole" NOT NULL,
    "state" "V3LegState" NOT NULL DEFAULT 'NEW',
    "connectionId" TEXT,
    "direction" TEXT,
    "fromAddress" TEXT,
    "toAddress" TEXT,
    "targetExtensionId" TEXT,
    "targetUserId" TEXT,
    "answeredAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "hangupCause" TEXT,
    "version" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "V3CallLeg_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "V3SessionTransition" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "fromState" "V3SessionState" NOT NULL,
    "toState" "V3SessionState" NOT NULL,
    "triggerEvent" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "actorType" TEXT,
    "actorId" TEXT,
    "metadata" JSONB,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "V3SessionTransition_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "V3LegTransition" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "legId" TEXT NOT NULL,
    "fromState" "V3LegState" NOT NULL,
    "toState" "V3LegState" NOT NULL,
    "triggerEvent" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "metadata" JSONB,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "V3LegTransition_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "V3CommandOutbox" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "legId" TEXT,
    "commandType" "V3CommandType" NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "V3OutboxStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 5,
    "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastError" TEXT,
    "telnyxRequestId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "sentAt" TIMESTAMP(3),
    "ackedAt" TIMESTAMP(3),

    CONSTRAINT "V3CommandOutbox_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "V3FeatureFlag" (
    "tenantId" TEXT NOT NULL,
    "engineEnabled" BOOLEAN NOT NULL DEFAULT false,
    "deskEnabled" BOOLEAN NOT NULL DEFAULT false,
    "mobileEnabled" BOOLEAN NOT NULL DEFAULT false,
    "pstnEnabled" BOOLEAN NOT NULL DEFAULT false,
    "transferEnabled" BOOLEAN NOT NULL DEFAULT false,
    "recordingEnabled" BOOLEAN NOT NULL DEFAULT false,
    "voicemailEnabled" BOOLEAN NOT NULL DEFAULT false,
    "observeOnly" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedByUserId" TEXT,

    CONSTRAINT "V3FeatureFlag_pkey" PRIMARY KEY ("tenantId")
);

-- CreateIndex
CREATE INDEX "ProcessedTelnyxEvent_processedAt_idx" ON "ProcessedTelnyxEvent"("processedAt");
CREATE INDEX "ProcessedTelnyxEvent_callControlId_idx" ON "ProcessedTelnyxEvent"("callControlId");
CREATE INDEX "ProcessedTelnyxEvent_tenantId_processedAt_idx" ON "ProcessedTelnyxEvent"("tenantId", "processedAt");

CREATE INDEX "V3CallSession_tenantId_state_idx" ON "V3CallSession"("tenantId", "state");
CREATE INDEX "V3CallSession_tenantId_createdAt_idx" ON "V3CallSession"("tenantId", "createdAt");
CREATE INDEX "V3CallSession_telnyxCallSessionId_idx" ON "V3CallSession"("telnyxCallSessionId");
CREATE INDEX "V3CallSession_primaryCallControlId_idx" ON "V3CallSession"("primaryCallControlId");
CREATE INDEX "V3CallSession_correlationId_idx" ON "V3CallSession"("correlationId");

CREATE UNIQUE INDEX "V3CallLeg_callControlId_key" ON "V3CallLeg"("callControlId");
CREATE INDEX "V3CallLeg_sessionId_idx" ON "V3CallLeg"("sessionId");
CREATE INDEX "V3CallLeg_sessionId_role_idx" ON "V3CallLeg"("sessionId", "role");
CREATE INDEX "V3CallLeg_targetExtensionId_state_idx" ON "V3CallLeg"("targetExtensionId", "state");

CREATE UNIQUE INDEX "V3SessionTransition_eventId_sessionId_key" ON "V3SessionTransition"("eventId", "sessionId");
CREATE INDEX "V3SessionTransition_sessionId_occurredAt_idx" ON "V3SessionTransition"("sessionId", "occurredAt");
CREATE INDEX "V3SessionTransition_occurredAt_idx" ON "V3SessionTransition"("occurredAt");

CREATE UNIQUE INDEX "V3LegTransition_eventId_legId_key" ON "V3LegTransition"("eventId", "legId");
CREATE INDEX "V3LegTransition_legId_occurredAt_idx" ON "V3LegTransition"("legId", "occurredAt");
CREATE INDEX "V3LegTransition_sessionId_occurredAt_idx" ON "V3LegTransition"("sessionId", "occurredAt");

CREATE UNIQUE INDEX "V3CommandOutbox_idempotencyKey_key" ON "V3CommandOutbox"("idempotencyKey");
CREATE INDEX "V3CommandOutbox_status_nextAttemptAt_idx" ON "V3CommandOutbox"("status", "nextAttemptAt");
CREATE INDEX "V3CommandOutbox_sessionId_idx" ON "V3CommandOutbox"("sessionId");

CREATE INDEX "V3FeatureFlag_engineEnabled_idx" ON "V3FeatureFlag"("engineEnabled");

-- Partial unique index for telnyxCallSessionId when present
CREATE UNIQUE INDEX "V3CallSession_telnyxCallSessionId_unique_idx"
  ON "V3CallSession"("telnyxCallSessionId")
  WHERE "telnyxCallSessionId" IS NOT NULL;

-- AddForeignKey
ALTER TABLE "V3CallLeg" ADD CONSTRAINT "V3CallLeg_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "V3CallSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "V3SessionTransition" ADD CONSTRAINT "V3SessionTransition_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "V3CallSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "V3LegTransition" ADD CONSTRAINT "V3LegTransition_legId_fkey" FOREIGN KEY ("legId") REFERENCES "V3CallLeg"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "V3LegTransition" ADD CONSTRAINT "V3LegTransition_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "V3CallSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "V3CommandOutbox" ADD CONSTRAINT "V3CommandOutbox_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "V3CallSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "V3CommandOutbox" ADD CONSTRAINT "V3CommandOutbox_legId_fkey" FOREIGN KEY ("legId") REFERENCES "V3CallLeg"("id") ON DELETE SET NULL ON UPDATE CASCADE;
