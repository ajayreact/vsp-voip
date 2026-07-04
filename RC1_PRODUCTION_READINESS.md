# Tenant Portal V3 — RC1 Production Readiness

**Version:** v3.0.0-rc1  
**Date:** 2026-07-03  
**Branch:** `release/v3.0.0-rc1` @ `82aa5bf`

---

## Feature Summary

Tenant Portal V3 is a tenant-scoped administration layer covering provisioning, inventory, desk phones, call flow design, PBX configuration, softphone UX, operations dashboards, billing/backup, and optional runtime telephony sync. RC1 includes Migration Wizard and Test Lab for cutover validation.

**In scope for RC1:** Configuration, health, migration, backup, staging validation.  
**Out of scope for RC1 GA:** Live V3 telephony path (runtime sync disabled by default).

---

## Architecture

```
Next.js /v3/*  →  v3-api.ts  →  /api/v3 (routes/v3.js)
                                      ↓
                               lib/v3/* services
                                      ↓
                               PostgreSQL (22 V3 models)
                                      ↓ (optional)
                               lib/v3/runtime/* → telephony-v3-worker
```

Legacy Call Control (`lib/inboundCallControl.js`, `lib/telnyxCallControl.js`) and WebRTC softphone V2 remain the production telephony path.

See `docs/v3/Architecture.md`.

---

## Runtime Sync

| Setting | RC1 default |
|---------|-------------|
| `V3_RUNTIME_SYNC_ENABLED` | `false` |
| `V3_RUNTIME_SYNC_TENANT_ALLOWLIST` | empty |

10 runtime adapters cover extensions, numbers, ring groups, queues, call flows, business hours, holidays, voicemail, devices. Jobs enqueue via `runtimeEnqueue.js`; worker processes separately.

**RC1 verdict:** Shipped but **not production-enabled**. Canary tenant validation required before enablement.

---

## Migration Wizard

Super-admin workflow at `/v3/migration-wizard`:

1. Discovery → 2. Validate → 3. Preview → 4. Run → 5. (post-validation in service) → 6. Rollback

Auto-rollback on execute failure. Complements tenant-scoped `/v3/migration` (Phase 10).

---

## Rollback Strategy

| Level | Action | Downtime |
|-------|--------|----------|
| 1 | Disable `V3_PORTAL_ENABLED` + rebuild web | Minutes |
| 2 | Disable runtime sync | Minutes |
| 3 | Migration Wizard / migration rollback | Low |
| 4 | Backup restore | Medium |
| 5 | Git deploy rollback to `v3.0.0-rc1` | Medium |

See `docs/v3/Rollback.md`.

---

## Backup Strategy

- Tenant snapshots via `/api/v3/backup/*`
- Export/import JSON bundles
- `TENANT_MISMATCH` enforced on import/restore (RC1 audit)
- Schema: forward-only Prisma migrations — no automated schema downgrade

See `docs/v3/BackupRestore.md`.

---

## Feature Flags

| Flag | Production RC1 |
|------|----------------|
| `V3_PORTAL_ENABLED` | `true` when rolling out portal |
| `NEXT_PUBLIC_V3_PORTAL` | `true` at web build |
| `V3_RUNTIME_SYNC_ENABLED` | **`false`** |
| `V3_TEST_LAB_ENABLED` | **`false`** |
| `V3_TEST_LAB_ALLOW_PRODUCTION` | **`false`** |
| `TELEPHONY_V3_*` | **`false`** (unchanged) |

---

## Deployment Steps

1. Checkout `release/v3.0.0-rc1`
2. `npm run migrate:deploy` (or via `deploy/deploy-api.sh`)
3. Set portal flags in `.env`
4. `bash deploy/deploy-api.sh`
5. `NEXT_PUBLIC_V3_PORTAL=true bash deploy/deploy-web.sh`
6. Verify `/ready`, `/v3/dashboard`
7. Run Test Lab on staging tenant (super-admin)
8. Migration Wizard cutover per tenant
9. Enable runtime sync per-tenant only after validation

Staging shortcut: `bash deploy/staging-v3-portal.sh`

---

## Production Checklist

- [ ] Migrations applied (11 V3 migrations present)
- [ ] API + web commit SHA match (`/ready` → `build.gitCommit`)
- [ ] `V3_PORTAL_ENABLED=true`
- [ ] Web built with `NEXT_PUBLIC_V3_PORTAL=true`
- [ ] `V3_RUNTIME_SYNC_ENABLED=false` until canary signed off
- [ ] Test Lab disabled in production
- [ ] Backup taken before tenant migration
- [ ] Super-admin accounts restricted
- [ ] JWT / Telnyx / Redis / DB env verified unchanged
- [ ] Browser hard refresh / incognito verification

---

## Known Limitations

1. Runtime sync not validated on production canary tenant
2. Live telephony on V3 path requires worker + executor flags (separate stack)
3. Call flow builder is configuration-only until runtime sync enabled
4. Migration Wizard `post-validate` is service-internal (no dedicated HTTP route)
5. Legacy ESLint: 66 issues (0 in V3 paths)
6. Full test suite: 2 API auth failures (environmental)
7. Git tag `v3.0.0-rc1` may point to stale commit until retagged
8. Uncommitted test fix in `tests/v3/softphoneHealthService.test.ts`

---

## Deferred Items

- Runtime sync production canary
- Manual V3 telephony staging matrix
- Legacy ESLint cleanup (27 `set-state-in-effect` errors)
- Separate repo `vsp-phone-tenant-portal-v3`
- Phase 4+ telephony features (CRM, AI, etc.)

---

## Risk Assessment

| Risk | Severity | Mitigation |
|------|----------|------------|
| Runtime sync enables live routing unexpectedly | High | Default off + allowlist |
| Migration partial failure | Medium | Auto-rollback + backup |
| Tenant data cross-contamination | High | JWT scoping + TENANT_MISMATCH guard |
| Tag/deploy mismatch | Medium | Retag + verify `/ready` SHA |
| Legacy telephony regression | High | Protected files untouched; legacy path unchanged |

---

## GO / NO-GO Matrix

| Area | Verdict | Notes |
|------|---------|-------|
| Portal UI/API (Phases 1–8) | **GO** | 130/130 V3 tests pass |
| Test Lab (staging) | **GO** | Super-admin only |
| Migration Wizard | **GO** | Staging validation first |
| Runtime Sync (production) | **NO-GO** | Canary not complete |
| V3 telephony live calls | **NO-GO** | Legacy path remains production |
| RC1 tag/release hygiene | **CONDITIONAL** | Retag + clean working tree |
| **Overall RC1 Portal** | **CONDITIONAL GO** | Config portal yes; telephony bridge no |

---

## Related Documents

- `CHANGELOG_RC1.md`
- `V3_RC1_EXECUTIVE_SUMMARY.md`
- `docs/v3/` — operational guides
- `docs/vsp/deployment/18-v3-production-operations-runbook.md`
