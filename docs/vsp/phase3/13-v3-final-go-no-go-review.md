# VSP Phone V3 — Final Go / No-Go Review

**Date:** 2026-07-01  
**Scope:** Complete V3 platform through Phase 3.9.5 (frozen architecture)  
**Mode:** Read-only final review — no code, architecture, or implementation changes  
**Audits synthesized:** Production readiness (3.1), security (3.2), telephony (3.4), multi-tenant (3.5), performance (11), test coverage (12), deployment (16–17), B1/B2/B3 remediation

---

## 1. Executive Summary

VSP Phone V3 is **architecturally complete and production-viable for a controlled canary rollout** at moderate scale (≤500 concurrent calls). The engine delivers a durable, horizontally scalable telephony stack: PostgreSQL-backed sessions and outbox, Redis Streams ingress, per-session locking, dual FSM, tenant-scoped feature flags, and sidecar modules for Hold/Transfer, Recording, Voicemail, Conference, Queue, and IVR.

**Production blockers B1–B3 are resolved:**

| Blocker | Status |
|---------|--------|
| B1 — Prisma migration ordering | **Resolved** — `validate:migrations` in CI |
| B2 — V3 worker as first-class Docker service | **Resolved** — `telephony-v3-worker`, deploy script, healthcheck |
| B3 — Real PG + Redis integration tests | **Resolved** — `v3-integration` CI job (20 scenarios) |

**Convergence across audits:**

| Dimension | Verdict |
|-----------|---------|
| Architecture completeness | **Strong** — Phases 1–3.9.5 delivered per frozen design |
| Unit test confidence | **Strong** — 398 tests, ~20s |
| Real infrastructure confidence | **Moderate** — B3 in CI; unit suite mock-heavy |
| Performance at launch scale | **Acceptable** — ≤500 calls with ≥2–3 workers |
| Platform operations | **Gaps remain** — DB backup automation, full staging matrix |

**Final decision:** **GO** for **controlled production rollout** (canary tenants, feature-flag staged enablement). **Not GO** for enterprise-scale GA (1,000+ concurrent calls) or full legacy replacement without additional validation.

V3 runs **in parallel** with legacy Call Control via a dedicated webhook URL (`POST /webhook/v3/call-control`) and per-tenant flags — rollout does not require disabling `lib/inboundCallControl.js`.

---

## 2. Overall Production Score: **77 / 100**

| Pillar | Weight | Score | Contribution |
|--------|--------|-------|--------------|
| Architecture | 15% | 88 | 13.2 |
| Reliability | 15% | 78 | 11.7 |
| Security (V3 engine) | 10% | 80 | 8.0 |
| Performance | 15% | 74 | 11.1 |
| Test confidence | 20% | 73 | 14.6 |
| Operational readiness | 15% | 70 | 10.5 |
| Maintainability | 10% | 82 | 8.2 |
| **Total** | 100% | | **77.3 → 77** |

---

## 3. Architecture Score: **88 / 100**

### Strengths

- **Clear separation:** API gateway (enqueue only) vs worker (consume, FSM, outbox, executor).
- **Durable command path:** FSM persist + outbox co-commit; executor with lease, retry, dead-letter.
- **Horizontal scaling primitives:** Redis consumer groups, `FOR UPDATE SKIP LOCKED`, per-session Redis locks.
- **Frozen FSM:** Session + leg state machines; sidecars use `routeSnapshot` without new FSM states.
- **Feature-flag layering:** Global env gates + per-tenant `V3TenantFeatureFlags` (engine, desk, mobile, pstn, hold, transfer, recording, voicemail, conference, queue, ivr).
- **Rollback levers:** Env flags (`TELEPHONY_V3_*`), tenant `engineEnabled=false`, `TELEPHONY_V3_OUTBOX_PAUSED`, legacy path unchanged.

### Gaps (non-blocking for canary)

- Session/leg Redis cache written but not read on CallManager hot path (PG every event).
- Domain event bus in-process only (acceptable for single-worker event routing).
- PolicyEngine observe-only (enforcement deferred).
- `routeSnapshot` JSON grows with sidecar state (no size cap).

---

## 4. Reliability Score: **78 / 100**

### Strengths

- **Webhook dedup:** `ProcessedTelnyxEvent` + `isDurableDuplicate` before enqueue; mark-after-enqueue (Phase 3.9.5).
- **Optimistic locking:** Session/leg version with retry in CallManager.
- **Bootstrap lock:** Serializes concurrent `call.initiated` for same `callControlId`.
- **Outbox:** PENDING → PROCESSING → SENT/FAILED/DEAD; lease reclaim; idempotency keys.
- **Stream recovery:** Stale PEL reclaim, poison → DLQ, graceful worker shutdown.
- **B3 validated:** Multi-worker SKIP LOCKED, crash recovery, Redis/DB reconnect.

### Risks

| ID | Risk | Severity |
|----|------|----------|
| TC-001 | Enqueue ok + `markWebhookProcessed` fails → orphan stream entry | Medium |
| TC-007 | Full `runIngressWorkerLoop` not integration-tested | Medium |
| TC-008 | Executor lease renewal failure → double execution | Medium |
| TC-009 | Multi-worker same-session ordering under burst | Medium |
| TC-010 | `pollExpiredTimers` untested at scale | Medium |
| TC-006 | `replayDlqMessages` ops path untested | Low–Medium |

---

## 5. Security Score: **80 / 100** (V3 engine)

### V3-specific strengths

- Telnyx webhook signature verification (shared middleware).
- Tenant isolation: bootstrap resolves tenant from DID; all session queries scoped by `tenantId`.
- Fail-closed Redis when `TELEPHONY_V3_REDIS_REQUIRED=true`.
- No direct Telnyx calls from routers/sidecars — executor only.
- Durable dedup prevents replay amplification.

### Inherited platform findings (not V3 code defects)

| Finding | Severity | V3 impact |
|---------|----------|-----------|
| SEC-001 — 7-day JWT, no access revocation | High | Portal/API auth; not call path |
| SEC-004 — Provisioning redeem race | Medium | Mobile onboarding |
| SEC-008 — SUPER_ADMIN cross-tenant | Medium | Admin ops |
| Docker Postgres/Redis public exposure | Critical (ops) | Infrastructure config |

V3 does **not** introduce new tenant isolation regressions beyond audited multi-tenant pass (Phase 3.5).

---

## 6. Performance Score: **74 / 100**

Source: [11-v3-platform-performance-audit.md](./11-v3-platform-performance-audit.md)

| Scale | Verdict |
|-------|---------|
| ≤500 concurrent calls, ≥3 workers | **PASS** |
| 1,000+ on default 1-worker | **FAIL** |
| 5,000 without scale-out + backlog | **FAIL** |

Primary bottlenecks: synchronous webhook path (PG+Redis before HTTP 200), PG read amplification (cache bypass), sequential ingress batch processing, single outbox tick mutex per worker.

---

## 7. Test Confidence Score: **73 / 100**

Source: [12-v3-test-coverage-audit.md](./12-v3-test-coverage-audit.md)

| Suite | Count | CI |
|-------|-------|-----|
| Unit + mocked integration | 398 pass | **Not in CI api job** |
| Real PG+Redis (B3) | 20 pass | **Yes** — `v3-integration` job |
| Mocked E2E matrix (3.4.5) | ~26 | Included in unit suite |

**Gap:** `npm run test:v3` should be added to CI before treating V3 releases as fully gated.

---

## 8. Operational Readiness Score: **70 / 100**

### Ready

- Docker Compose: `api` + `telephony-v3-worker` + postgres + redis.
- Deploy scripts: `deploy-api.sh`, `deploy-v3-worker.sh`.
- Health: `GET /ready/v3` (workers, queue lag, DLQ, outbox dead).
- Metrics: `GET /metrics/v3` (Prometheus text).
- Rollback documented: env flags, git checkout, worker redeploy.
- Migration validation: `validate:migrations` in CI.

### Not ready / verify manually

| Item | Status |
|------|--------|
| Automated daily DB backup + restore drill | **Not in codebase** (Critical platform gap) |
| Phase 3.7 manual staging matrix for **V3 path** | **Pending** |
| `test:v3` in CI pipeline | **Missing** |
| Load test to 2× expected peak | **Not executed** |
| Telnyx Mission Control: V3 webhook URL for canary DIDs | **Ops task** |
| `LOG_LEVEL=warn` on workers | **Ops task** |

---

## 9. Remaining Risks

### High (mitigate before broad rollout)

| Risk | Mitigation |
|------|------------|
| Canary tenant receives events on **both** legacy and V3 URLs | Configure V3-only DIDs/apps in Mission Control; never dual-subscribe |
| No automated DB backups | Manual pre-deploy backup; implement backup cron (platform 3.6) |
| Unit suite not in CI | Run `npm run test:v3` in merge gate; add CI step |
| Scale beyond 500 calls without workers | Deploy ≥2–3 worker replicas; monitor `/ready/v3` |

### Medium (monitor post-launch)

| Risk | Mitigation |
|------|------------|
| TC-001 gateway orphan path | Alert on ingress without matching ProcessedTelnyxEvent; backlog TB-2 |
| Sub-manager gaps (participant, agent) | Monitor conference/queue metrics; backlog TB-6/TB-7 |
| Health probe cost (`/ready/v3` 5× COUNT) | Probe interval ≥30s; cache backlog OB-10 |
| Transition table growth | Retention job backlog OB-11 |

### Low (deferred)

- Tracing (`OTEL_ENABLED=false` default).
- PolicyEngine enforcement mode.
- Performance backlog OB-1–OB-12.

---

## 10. Production Rollout Recommendation

### Recommended approach: **Four-phase canary**

V3 must **not** replace legacy for all tenants on day one. Use dedicated Telnyx Call Control application or DID routing to `POST /webhook/v3/call-control` for canary tenants only.

| Phase | Audience | Flags | Duration |
|-------|----------|-------|----------|
| **P0 — Infra** | None (shadow) | All V3 env `true`; **no tenant `engineEnabled`** | 24–48h |
| **P1 — Internal** | 1 internal tenant | `engineEnabled` + `pstnEnabled` only | 3–5 days |
| **P2 — Pilot** | 2–5 pilot tenants | + desk/mobile as needed | 2 weeks |
| **P3 — Expand** | Gradual % rollout | Enable sidecars per tenant need | Ongoing |

**Do not enable** conference, queue, or IVR for pilot until P1 PSTN/desk/mobile stable.

---

## 11. Go / No-Go Decision

### **GO** — Controlled V3 Production Rollout

**Conditions (all required before P1):**

1. ✅ B1 migration validation passes (`npm run validate:migrations`).
2. ✅ B2 worker deployed as dedicated service with heartbeat healthy.
3. ✅ B3 `v3-integration` CI job green on release commit.
4. ☐ Pre-deploy `pg_dump` backup taken and restore verified (manual until automated).
5. ☐ `npm run test:v3` passes locally on release commit (398/398).
6. ☐ Telnyx canary app points **only** to `/webhook/v3/call-control` (not legacy URL).
7. ☐ `REDIS_REQUIRED=true`, Postgres/Redis not public.
8. ☐ ≥2 `telephony-v3-worker` replicas in production.
9. ☐ `/ready/v3` monitored; alert on 503.
10. ☐ Rollback runbook rehearsed (disable flags → redeploy previous SHA).

### **NO-GO** for

- Full legacy replacement for all tenants.
- GA at 1,000+ concurrent calls without load test and worker scale-out.
- Enabling all sidecars simultaneously on first tenant.
- Production deploy if B3 CI job failing.

### Intentionally deferred (NOT blockers)

Phase 4: CRM, AI, Analytics, Presence, BLF, Hot Desking.

---

## Appendix A — Platform Component Review

| Component | Status | Notes |
|-----------|--------|-------|
| Architecture | ✅ Complete | Frozen 3.9.5 |
| Database | ✅ Ready | Migrations ordered; indexes adequate |
| Redis | ✅ Ready | Streams, locks, heartbeats, timers |
| Workers | ✅ Ready | B2 dedicated service |
| Webhook Gateway | ✅ Ready | Dedup, normalize, enqueue |
| CallManager | ✅ Ready | Bootstrap lock, FSM, co-commit |
| FSM | ✅ Ready | Session + leg, audited |
| Session / Leg mgmt | ✅ Ready | Optimistic locking |
| Routing (Desk/Mobile/PSTN) | ✅ Ready | Unit + E2E matrix |
| Policy Engine | ⚠️ Observe only | By design |
| Executor | ✅ Ready | Retry, DLQ, adapter |
| Outbox | ✅ Ready | SKIP LOCKED, leases |
| Sidecars (all 7) | ✅ Ready | Manager-level tested |
| Replay | ⚠️ Partial | Dedup yes; DLQ replay untested |
| Timers | ⚠️ Partial | Schedule/cancel yes; poll sweep thin |
| Feature Flags | ✅ Ready | Global + tenant |
| Observability | ✅ Ready | Logs, metrics, optional OTEL |
| Health Checks | ✅ Ready | `/ready/v3` |
| Deployment | ✅ Ready | Docker, scripts, docs |
| CI/CD | ⚠️ Partial | B3 yes; unit suite gap |
| Testing | ⚠️ Conditional | 76/100 coverage score |
| Performance | ⚠️ Conditional | 74/100; ≤500 OK |
| Security | ✅ Acceptable | V3 80/100; platform gaps inherited |
| Rollback | ✅ Ready | Flags + git + worker redeploy |
| Disaster recovery | ⚠️ Partial | Manual backup; no automated restore drill |

---

## Appendix B — GO Rollout Plans

### B.1 Recommended rollout plan

```
Week 0 (pre-flight)
  ├── Deploy api + telephony-v3-worker (flags false)
  ├── Verify /ready/v3 (workers heartbeat, no tenant traffic)
  ├── Run test:v3 + confirm v3-integration CI green
  └── Backup + rollback drill

Week 1 (P0 shadow)
  ├── TELEPHONY_V3_* = true globally
  ├── No tenant engineEnabled
  └── Monitor metrics/v3, worker logs (no call impact)

Week 2 (P1 internal)
  ├── 1 tenant: engineEnabled + pstnEnabled
  ├── Telnyx app → /webhook/v3/call-control for internal DID only
  └── Inbound/outbound smoke: P-01, P-05, E-01

Week 3–4 (P2 pilot)
  ├── 2–5 tenants, desk/mobile as needed
  ├── hold + transfer for 1 tenant only
  └── Daily /ready/v3 + DLQ review

Week 5+ (P3 expand)
  ├── recording, voicemail per tenant request
  ├── conference/queue/IVR last (highest complexity)
  └── Load review before >500 concurrent calls
```

### B.2 Canary deployment plan

| Step | Action |
|------|--------|
| 1 | Create Telnyx Call Control app `VSP-V3-Canary` with webhook `https://api.<domain>/webhook/v3/call-control` |
| 2 | Assign **one** pilot DID to canary app (do not share with legacy app) |
| 3 | Deploy code with all `TELEPHONY_V3_*=true`; tenant row `engineEnabled=false` initially |
| 4 | Enable `engineEnabled` for pilot tenant in DB |
| 5 | Place test calls; compare V3 session rows vs legacy (no overlap) |
| 6 | If stable 72h, add second tenant |
| 7 | Rollback: set `engineEnabled=false`, revert DID to legacy app, set `TELEPHONY_V3_INGRESS_ENABLED=false` if needed |

### B.3 Feature flag rollout order

**Global env (once, before any tenant):**

```
TELEPHONY_V3_GLOBAL=true
TELEPHONY_V3_INGRESS_ENABLED=true
TELEPHONY_V3_CALLMANAGER_ENABLED=true
TELEPHONY_V3_EXECUTOR_ENABLED=true
TELEPHONY_V3_REDIS_REQUIRED=true
```

**Per-tenant (`V3TenantFeatureFlags`), in order:**

1. `engineEnabled`
2. `pstnEnabled` (inbound/outbound PSTN)
3. `deskEnabled` / `mobileEnabled` (as needed)
4. `holdEnabled` + `transferEnabled`
5. `recordingEnabled` + `voicemailEnabled`
6. `conferenceEnabled`
7. `queueEnabled`
8. `ivrEnabled`

**Emergency stops:**

- `TELEPHONY_V3_OUTBOX_PAUSED=true` — stop command execution
- `TELEPHONY_V3_INGRESS_ENABLED=false` — stop accepting V3 webhooks (503)
- Tenant `engineEnabled=false` — tenant falls through (no V3 processing for that tenant's resolved calls)

### B.4 Monitoring checklist

| Signal | Source | Alert threshold |
|--------|--------|-----------------|
| V3 readiness | `GET /ready/v3` | `ready: false` |
| Worker heartbeats | `/ready/v3` → workers | 0 active in production |
| Ingress rate | `metrics/v3` `v3_ingress_received_total` | Anomaly vs baseline |
| Queue lag | `/ready/v3` → queueLagMs | > `V3_QUEUE_LAG_MAX_MS` (60s) |
| DLQ depth | `/ready/v3` → dlqDepth | > `V3_DLQ_DEPTH_MAX` (1000) |
| Outbox dead | `/ready/v3` → outboxDead | > `V3_OUTBOX_DEAD_MAX` (100) |
| Duplicate ingress | `v3_ingress_duplicate_total` | Spike vs received |
| Command failures | `v3_command_failed_total` | Sustained increase |
| Worker restarts | Docker/PM2 | >2/hour |
| PG connections | `pg_stat_activity` | >80% max_connections |
| Redis memory | INFO memory | >80% maxmemory |

### B.5 Rollback checklist

| # | Step |
|---|------|
| 1 | Set tenant `engineEnabled=false` (immediate tenant stop) |
| 2 | Set `TELEPHONY_V3_INGRESS_ENABLED=false` if full stop needed |
| 3 | Set `TELEPHONY_V3_OUTBOX_PAUSED=true` to halt executor |
| 4 | Revert Telnyx canary DID to legacy Call Control app |
| 5 | `git checkout <last-good-sha>` on EC2 |
| 6 | `bash deploy/deploy-api.sh && bash deploy/deploy-v3-worker.sh` |
| 7 | Verify `/ready` and `/ready/v3` |
| 8 | Confirm legacy inbound test call succeeds |
| 9 | Document incident; preserve V3 DB rows for forensics (do not delete) |
| 10 | If migration issue: restore from pre-deploy backup |

### B.6 Post-launch validation checklist

| # | Test | Pass |
|---|------|------|
| 1 | `/ready/v3` → `ready: true`, ≥1 worker | ☐ |
| 2 | Inbound PSTN → ring → answer → hangup (canary tenant) | ☐ |
| 3 | Outbound PSTN from mobile (canary tenant) | ☐ |
| 4 | Desk extension inbound (if deskEnabled) | ☐ |
| 5 | Hold + resume (if holdEnabled) | ☐ |
| 6 | Blind transfer (if transferEnabled) | ☐ |
| 7 | Recording appears in portal (if recordingEnabled) | ☐ |
| 8 | Voicemail deposit + playback (if voicemailEnabled) | ☐ |
| 9 | Duplicate webhook delivery → no double session | ☐ |
| 10 | Worker restart → calls recover (no stuck PENDING >5min) | ☐ |
| 11 | `metrics/v3` scraping in monitoring | ☐ |
| 12 | No cross-tenant session bleed (two tenants, ext 101) | ☐ |
| 13 | Legacy tenants unaffected (non-canary DID) | ☐ |
| 14 | Rollback drill completed within RTO target | ☐ |

---

## Sign-off

| Role | Decision | Date |
|------|----------|------|
| Engineering | **GO** (controlled canary, conditions above) | 2026-07-01 |
| Security | Pending formal sign-off | |
| Operations | Pending backup automation + staging matrix | |
| Product | Pending pilot tenant selection | |

---

## References

- [12-v3-test-coverage-audit.md](./12-v3-test-coverage-audit.md)
- [11-v3-platform-performance-audit.md](./11-v3-platform-performance-audit.md)
- [16-telephony-v3-worker.md](../deployment/16-telephony-v3-worker.md)
- [17-v3-integration-validation.md](../deployment/17-v3-integration-validation.md)
- [06-deployment-checklist.md](./06-deployment-checklist.md)
- [08-rollback.md](../deployment/08-rollback.md)
- `lib/telephony-v3/README.md`
