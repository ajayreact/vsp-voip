# RC1 Production Rollout Plan

**Release:** v3.0.0-rc1  
**Strategy:** Phased enablement — portal first, runtime sync deferred

---

## Rollout Phases

### Phase A — Portal Only (All Environments)

Enable portal UI/API without runtime sync or telephony changes.

```bash
V3_PORTAL_ENABLED=true
NEXT_PUBLIC_V3_PORTAL=true
V3_RUNTIME_SYNC_ENABLED=false
V3_TEST_LAB_ENABLED=false
```

**Scope:** Configuration, health, billing, backup — no live routing changes.

---

## Phase 1 — Portal Only

**Duration:** 1 week soak  
**Tenants:** All (read-only config access) or pilot group

| # | Action | ✓ |
|---|--------|---|
| 1 | Deploy RC1 per `01_DEPLOYMENT_CHECKLIST.md` | ☐ |
| 2 | Enable portal flags | ☐ |
| 3 | Verify `/v3/dashboard` for pilot admins | ☐ |
| 4 | Monitor API error rates | ☐ |
| 5 | UAT sign-off (`02_UAT_CHECKLIST.md`) | ☐ |

**Success criteria:** No P1 portal incidents; dashboard stable; health center accurate.

---

## Phase 2 — One Tenant (Migration Pilot)

**Duration:** 3–5 days  
**Tenants:** 1 selected pilot

| # | Action | ✓ |
|---|--------|---|
| 1 | Run full migration playbook on pilot | ☐ |
| 2 | Test Lab pass on pilot tenant | ☐ |
| 3 | Tenant admin training complete | ☐ |
| 4 | Support channel monitored | ☐ |
| 5 | Backup verified restorable | ☐ |

**Success criteria:** Migration complete; health green; tenant admin satisfied.

---

## Phase 3 — Five Tenants

**Duration:** 1 week  
**Tenants:** 5 (include pilot)

| # | Action | ✓ |
|---|--------|---|
| 1 | Migrate tenants 2–5 sequentially (not parallel) | ☐ |
| 2 | 24h soak between each migration | ☐ |
| 3 | Test Lab on each post-migration | ☐ |
| 4 | Track migration run IDs | ☐ |
| 5 | Weekly ops review | ☐ |

**Success criteria:** 5/5 migrations successful; zero rollbacks.

---

## Phase 4 — Ten Tenants

**Duration:** 1–2 weeks  
**Tenants:** 10 total

| # | Action | ✓ |
|---|--------|---|
| 1 | Batch migrations (max 2 per day) | ☐ |
| 2 | Automated health monitoring | ☐ |
| 3 | Support ticket triage daily | ☐ |
| 4 | Optional: enable runtime sync canary on 1 tenant | ☐ |

**Success criteria:** 10/10 stable; error budget not exceeded.

---

## Phase 5 — All Tenants

**Duration:** 2–4 weeks  
**Tenants:** Remaining

| # | Action | ✓ |
|---|--------|---|
| 1 | Migration schedule published to support | ☐ |
| 2 | Batch size: 3–5 tenants/day max | ☐ |
| 3 | Rollback team on standby | ☐ |
| 4 | Post-deploy validation on each batch | ☐ |
| 5 | GA tag `v3.0.0` after full rollout + soak | ☐ |

**Success criteria:** All tenants migrated; portal default for admins.

---

## Runtime Sync Rollout (Separate Track)

Runtime sync is **NOT** part of initial portal rollout. Follow `03_RUNTIME_SYNC_CANARY.md` only after:

- [ ] Portal rollout stable for 2+ weeks
- [ ] Telephony smoke test plan approved
- [ ] Worker validated on staging
- [ ] Executive sign-off

---

## Rollback Criteria

**Immediate rollback (any phase)** if:

| Trigger | Action |
|---------|--------|
| P1 — portal unavailable for >15 min | Disable portal flags (`07_ROLLBACK_PLAYBOOK.md`) |
| P1 — data corruption / wrong tenant data | Disable portal + restore backup |
| P2 — migration failure affecting live calls | Migration wizard rollback + disable portal |
| P2 — error rate >5% on `/api/v3/*` sustained 30 min | Disable portal |
| Runtime sync causes call failures | Disable sync immediately |

**Phase pause (non-emergency)** if:

- 2 migration failures in one batch
- UAT regression on new deploy
- Unresolved P2 support tickets >24h

---

## Communication Plan

| Audience | When | Channel |
|----------|------|---------|
| Internal ops | Before each phase | Slack/email |
| Tenant admins | 48h before their migration | Email |
| Support team | Before Phase 1 | Training doc |
| End users | After portal enabled | In-app notice (optional) |

---

## Metrics to Track

| Metric | Target |
|--------|--------|
| `/api/v3/*` 5xx rate | < 0.1% |
| Migration success rate | > 99% |
| Dashboard load time | < 3s |
| Rollback events | 0 per phase |
| Support tickets (V3) | Trending down after week 2 |

---

## Related

- `01_DEPLOYMENT_CHECKLIST.md`
- `05_TENANT_MIGRATION_PLAYBOOK.md`
- `07_ROLLBACK_PLAYBOOK.md`
- `RC1_PRODUCTION_READINESS.md`
