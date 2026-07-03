# RC1 Known Limitations

**Release:** v3.0.0-rc1  
**Status:** Intentionally deferred to V3.1 or later

---

## Runtime & Telephony

| Limitation | RC1 State | Planned |
|------------|-----------|---------|
| **Runtime sync disabled by default** | `V3_RUNTIME_SYNC_ENABLED=false` | Enable per-tenant after canary (V3.1) |
| **Telephony bridge canary** | Not production-validated | Complete smoke test matrix |
| **Background worker (`telephony-v3-worker`)** | Not required for portal-only RC1 | Enable with runtime sync rollout |
| **Live call routing via V3 path** | Config only until sync enabled | Post-canary GA |
| **Call flow builder → live routing** | Simulator + config; no auto-routing | Runtime sync + worker |
| **`TELEPHONY_V3_*` flags** | All `false` | Separate telephony release track |
| **Manual V3 telephony staging matrix** | Pending | Document in V3.1 |

---

## Testing & Quality

| Limitation | RC1 State | Planned |
|------------|-----------|---------|
| **Legacy ESLint** | 66 issues (0 in V3 paths) | Legacy cleanup sprint |
| **Legacy API tests** | 2 failures in `tests/api/authentication.test.ts` (env/rate limit) | CI env fix or skip guard |
| **Uncommitted test fix** | `tests/v3/softphoneHealthService.test.ts` locally modified | Commit on V3.1 branch |
| **Full `npm run qa:full`** | Not required for portal-only RC1 | Before telephony enablement |

---

## Release & Git

| Limitation | RC1 State | Planned |
|------------|-----------|---------|
| **Tag alignment** | `v3.0.0-rc1` may point to stale commit (`cd07ef4`) vs HEAD (`b724754`) | Retag before production push |
| **Separate repository** | `vsp-phone-tenant-portal-v3` not created | Optional post-GA |
| **`deploy/staging-v3-portal.sh` default branch** | Still references `backup/pre-v3-staging` | Update to `release/v3.0.0-rc1` in V3.1 |

---

## Features Deferred to V3.1+

| Feature | Notes |
|---------|-------|
| Runtime sync multi-tenant rollout | After single-tenant canary |
| Production Test Lab | Staging only in RC1 |
| Warm / attended transfer on V3 path | Telephony-v3 Phase 4+ |
| Conference on V3 path | Telephony-v3 Phase 3.7+ |
| CRM / AI integrations | Roadmap items |
| Legacy ESLint rule compliance | 27 `set-state-in-effect` in legacy web |
| Mobile V3 admin | Web only |
| iOS softphone V3 parity | Android/web first |
| Automated schema downgrade | Never planned — backup restore only |
| Migration Wizard dedicated post-validate HTTP route | Service-internal in RC1 |

---

## Operational Constraints

| Constraint | Impact |
|------------|--------|
| Prisma migrations forward-only | Rollback = restore backup, not schema revert |
| Portal disable does not delete V3 data | Data remains in DB when flag off |
| Super-admin required for marketplace purchase, migration wizard, test lab | Expected |
| Subscription PUT super-admin only | RC1 audit hardening |
| Structured logs in `employeeService.js` | `[PBX REBUILD]` audit trail — not debug |

---

## Environment / Infrastructure

| Item | RC1 Note |
|------|----------|
| Postgres/Redis public ports in docker-compose | Ops hardening deferred (see staging readiness review) |
| API container restart policy | Documented warning — not RC1 code change |
| `.env.example` V3 variables | Partial — see `docs/V3/Environment.md` |
| `/ready/v3` not in deploy-api.sh | Manual check recommended |

---

## What RC1 Does Include

- Full portal configuration (Phases 1–10)
- Migration Wizard + Test Lab
- Backup/restore with tenant isolation
- Health center and operations dashboard
- 130 V3 unit tests passing
- 0 V3 ESLint issues
- Protected telephony files unchanged

---

## Related

- `RC1_PRODUCTION_READINESS.md`
- `CHANGELOG_RC1.md`
- `09_KNOWN_LIMITATIONS.md` → `10_OPERATIONS_RUNBOOK.md`
