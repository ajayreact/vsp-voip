-- VSP Phone V3 Phase 1.5 — infrastructure hardening (additive only)

-- Outbox PROCESSING state + claim lease columns
ALTER TYPE "V3OutboxStatus" ADD VALUE IF NOT EXISTS 'PROCESSING';

ALTER TABLE "V3CommandOutbox"
  ADD COLUMN IF NOT EXISTS "claimOwner" TEXT,
  ADD COLUMN IF NOT EXISTS "claimedUntil" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "V3CommandOutbox_status_claimedUntil_idx"
  ON "V3CommandOutbox"("status", "claimedUntil");

CREATE INDEX IF NOT EXISTS "V3CommandOutbox_claimOwner_idx"
  ON "V3CommandOutbox"("claimOwner");

-- Numeric invariants
ALTER TABLE "V3CallSession"
  ADD CONSTRAINT "V3CallSession_version_nonneg_chk" CHECK ("version" >= 0);

ALTER TABLE "V3CallLeg"
  ADD CONSTRAINT "V3CallLeg_version_nonneg_chk" CHECK ("version" >= 0);

ALTER TABLE "V3CommandOutbox"
  ADD CONSTRAINT "V3CommandOutbox_attempts_nonneg_chk" CHECK ("attempts" >= 0),
  ADD CONSTRAINT "V3CommandOutbox_maxAttempts_pos_chk" CHECK ("maxAttempts" > 0),
  ADD CONSTRAINT "V3CommandOutbox_attempts_lte_max_chk" CHECK ("attempts" <= "maxAttempts");

-- Dedup ledger retention index (purge by processedAt)
CREATE INDEX IF NOT EXISTS "ProcessedTelnyxEvent_processedAt_purge_idx"
  ON "ProcessedTelnyxEvent"("processedAt");
