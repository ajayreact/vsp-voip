-- Manual rollback for migration 20260704000000_multi_provider_telephony.
--
-- Prisma does not generate down-migrations automatically; this file is a
-- hand-written, optional companion for the rare case where the new
-- multi-provider tables need to be fully removed from the database (e.g.
-- abandoning the initiative entirely, not just rolling back a bad deploy).
--
-- IMPORTANT — read before running:
--   1. In almost all rollback scenarios you do NOT need this script. Because
--      the migration is purely additive and no legacy code path reads these
--      tables, checking out a previous git commit and redeploying the API
--      (see docs/vsp/deployment/08-rollback.md) is sufficient on its own —
--      the old code simply never queries Provider/TenantProvider/etc. The
--      tables being present-but-unused is harmless.
--   2. Only run this script if you specifically want to DROP the new
--      provider tables/column (e.g. re-running this migration from scratch,
--      or a confirmed decision to abandon multi-provider support). It is
--      destructive: any Provider/TenantProvider/ProviderCredential/
--      ProviderNumber/ProviderEndpoint rows (including Twilio credentials,
--      if any were ever entered) will be permanently deleted.
--   3. Take a database backup first:
--        docker compose exec postgres pg_dump -U vsp vsp_voip > backup-$(date +%Y%m%d-%H%M).sql
--   4. After running this script, also delete the migration's row from
--      `_prisma_migrations` if you want `prisma migrate status` to stop
--      reporting it as applied:
--        DELETE FROM "_prisma_migrations" WHERE migration_name = '20260704000000_multi_provider_telephony';
--
-- Usage:
--   docker compose exec -T postgres psql -U vsp -d vsp_voip < prisma/migrations/20260704000000_multi_provider_telephony/rollback.sql

BEGIN;

ALTER TABLE "PlatformSettings" DROP COLUMN IF EXISTS "defaultProviderId";

DROP TABLE IF EXISTS "ProviderEndpoint";
DROP TABLE IF EXISTS "ProviderNumber";
DROP TABLE IF EXISTS "ProviderCredential";
DROP TABLE IF EXISTS "TenantProvider";
DROP TABLE IF EXISTS "Provider";

DROP TYPE IF EXISTS "ProviderCredentialScope";

COMMIT;
