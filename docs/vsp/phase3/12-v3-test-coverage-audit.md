# VSP Phone V3 — Test Coverage Audit

**Date:** 2026-07-01  
**Scope:** `tests/telephony-v3/` through Phase 3.9.5 (frozen architecture)  
**Mode:** Read-only audit — no code, test, or architecture changes  
**Suite run:** `npx vitest run tests/telephony-v3 --pool=forks --maxWorkers=1` → **398 passed, 20 skipped, 72 files, ~20s**

---

## 1. Executive Summary

The V3 test suite is **broad and well-structured for unit-level validation**. With **~398 active tests** across **~70 unique test files**, coverage is strong for:

- FSM / state machine transitions
- Desk, Mobile, and PSTN routers (policy, resolver, command builders)
- Feature sidecars (Hold/Transfer, Recording, Voicemail, Conference, Queue, IVR) at manager/policy level
- Command executor, Telnyx adapter, failure classifier
- Phase 3.4.5 mocked E2E flow matrix (9 routing flows)
- Phase 3.9.5 hardening (schema, tenant bootstrap, session cleanup, sidecar registration)
- Deployment/migration validation (B1, B2)

**Primary gap:** The majority of tests use **`__setGetPrismaForTests` mocks** or **Redis spies/mocks**. Real PostgreSQL + Redis integration exists (`realInfra.test.ts`, 20 scenarios) but is **skipped unless `V3_INTEGRATION=1`**. Default CI runs unit tests only; B3 integration runs in a separate CI job.

**Secondary gaps:** Several infrastructure modules have **no dedicated tests** (participant/agent managers, replay DLQ, routeSnapshot helper, retention purge, full worker loop, tracing). **Concurrency** is tested via mock-level SKIP LOCKED and source-string checks, not live multi-process tests.

**Verdict:** Strong confidence in **business logic correctness** at unit level. Moderate confidence in **production runtime behavior** until B3 integration runs green in CI on every release.

---

## 2. Coverage Score: **76 / 100**

| Layer | Weight | Score | Notes |
|-------|--------|-------|-------|
| Unit tests (logic/FSM/routers) | 30% | 88 | Comprehensive mocked suite |
| Integration (real PG/Redis) | 20% | 62 | 20 tests skipped by default |
| Concurrency / failure injection | 15% | 68 | Partial; mostly mocked |
| Sidecars & feature modules | 15% | 74 | Manager-level; sub-managers thin |
| Deployment / migration | 10% | 80 | B1/B2/migrationOrder present |
| Worker / executor runtime | 10% | 65 | Tick/structural; no full loop |
| **Overall** | 100% | **76** | |

---

## 3. Coverage by Module

| Module / Area | Test file(s) | Est. coverage | Real infra? | Notes |
|---------------|--------------|---------------|-------------|-------|
| **Core engine** | | | | |
| StateMachine / FSM | `stateMachine`, `sessionFsm`, `legFsm`, `telnyxTriggerMap`, `sessionCompletion` | **90%** | No | Strong transition coverage |
| CallManager | `callManager`, `callManagerHardening` | **72%** | Partial (B3) | Heavy mocking; bootstrap/FSM paths |
| callPersistence | `callPersistence` | **65%** | Partial (B3) | Mock tx; duplicate transition |
| SessionManager / LegManager | `sessionManager`, `findOrCreate` | **70%** | Partial (B3) | findOrCreate conflict mocked |
| PolicyEngine | `policyEngine` | **60%** | No | Observe-mode only tests |
| **Workers** | | | | |
| ingressDispatcher | `ingressDispatcher` | **55%** | Partial (B3) | CallManager on/off paths |
| ingressWorker | `workerShutdown`, `commandExecutorWorker` | **40%** | No | Outbox tick only; loop mocked |
| telephony-v3-worker.js | `workerProduction` | **25%** | No | Structural/file checks only |
| **Executor** | | | | |
| commandExecutor | `commandExecutor`, `commandExecutorWorker` | **78%** | Partial (B3) | Retry, lease, batch mocked |
| telnyxAdapter | `telnyxAdapter` | **85%** | No | Broad command type coverage |
| failureClassifier | `failureClassifier` | **80%** | No | |
| **Routers** | | | | |
| deskRouter | `deskRouter`, `deskResolver`, `deskPolicy`, `deskCommandBuilder` | **82%** | No | |
| mobileRouter | `mobileRouter`, `mobileResolver`, `mobilePolicy`, `mobileCommandBuilder` | **82%** | No | |
| pstnRouter | `pstnRouter`, `pstnResolver`, `pstnPolicy`, `pstnCommandBuilder` | **82%** | No | |
| **Sidecars** | | | | |
| Hold/Transfer | `holdManager`, `holdPolicy`, `holdCommandBuilder`, `transferManager`, `transferPolicy`, `transferCommandBuilder` | **80%** | No | |
| Recording | `recordingManager`, `recordingPolicy`, `recordingCommandBuilder` | **78%** | No | |
| Voicemail | `voicemailManager`, `voicemailPolicy`, `voicemailCommandBuilder` | **78%** | No | |
| Conference | `conferenceManager`, `conferencePolicy`, `conferenceCommandBuilder` | **75%** | No | Participant flows via manager |
| Queue | `queueManager`, `queuePolicy`, `queueCommandBuilder`, `queueStrategy` | **78%** | No | |
| IVR | `ivrManager`, `ivrPolicy`, `ivrCommandBuilder`, `ivrMenuResolver`, `ivrInputProcessor` | **80%** | No | |
| sessionCleanup | `phase395Hardening` | **50%** | No | Single happy-path test |
| sidecarCoordinator | `phase395Hardening` | **30%** | No | Registration only |
| **Infrastructure** | | | | |
| Webhook gateway | `gateway`, `normalize` | **70%** | Partial (B3) | PG/streams mocked in unit |
| Redis streams | `streamsPoison`, `keys` | **45%** | Partial (B3) | Mock Redis; no XREADGROUP live |
| Redis locks | indirect via CallManager | **35%** | No | Locks always mocked |
| Outbox | `commandOutbox`, `outboxLifecycle`, `outboxConcurrency` | **75%** | Partial (B3) | Lifecycle mocked; B3 real PG |
| Timer | `timerService` | **50%** | No | schedule/cancel; no pollExpiredTimers |
| Replay | `phase395Hardening` | **35%** | No | isDurableDuplicate only |
| Feature flags | `featureFlags` | **65%** | No | Cache mocked |
| Health | `healthService` | **40%** | No | Single negative-path test |
| Metrics | `metrics` | **70%** | No | Counter/gauge render |
| Tenant bootstrap | `phase395Hardening` | **55%** | No | DID + reject paths |
| **Deployment** | | | | |
| Migrations | `migrationOrder`, `phase395Hardening` | **75%** | No | Ordering + schema alignment |
| Worker deploy | `workerProduction` | **60%** | No | Env + structural |
| **Integration** | | | | |
| Mocked E2E | `integration/e2eValidation` | **75%** | No | 9 flows, rollback flags |
| Real infra B3 | `integration/realInfra` | **85%** when enabled | **Yes** | 20 scenarios; skipped default |

### Modules with no dedicated test file

| Module | Risk | Indirect coverage |
|--------|------|-------------------|
| `Conference/conferenceParticipantManager.js` | Medium | Via `conferenceManager.test.ts` participant scenarios |
| `Queue/queueAgentManager.js` | Medium | Via `queueManager.test.ts` agent mocks |
| `Utils/routeSnapshotHelper.js` | Medium | Sidecar managers mock `updateMany` |
| `Replay/replayService.js` (DLQ replay) | Medium | Not tested |
| `Maintenance/retention.js` | Low | Mocked in workerShutdown |
| `Maintenance/outboxRetention.js` | Low | Not tested |
| `Redis/sessionCache.js` / `legCache.js` | Medium | Write path untested; reads bypassed in prod |
| `Redis/heartbeat.js` | Low | Mocked everywhere |
| `Utils/tracing.js` | Low | Not tested |
| `Sessions/sessionMapper.js` | Low | Implicit via session tests |
| `Session/sessionRepository.js` | Low | Phase-1 path in ingressDispatcher |
| `index.js` | Low | Export barrel |

---

## 4. Missing Scenarios

### Integration (real PG/Redis)

- [ ] Default CI path without `V3_INTEGRATION=1` skips all B3 tests
- [ ] Full router → CommandBus → outbox path on real DB (B3 test 10 stops before routers)
- [ ] Feature sidecar + `routeSnapshot` merge on real PostgreSQL
- [ ] Telnyx webhook burst / sustained load test
- [ ] Multi-process worker test (two Node processes, not sequential consumer names)

### Concurrency

- [ ] Live Redis lock contention / LOCK_TIMEOUT under parallel session updates
- [ ] Optimistic lock retry storm (3 retries exhausted) on real PG
- [ ] Parallel bootstrap lock for same `callControlId` across processes
- [ ] Executor session lock blocking second command on same session (integration)
- [ ] `outboxTickInFlight` mutex under concurrent ticks

### Failure injection

- [ ] Redis unavailable during gateway enqueue (partial: ingress_disabled only)
- [ ] PostgreSQL unavailable mid-`persistCallFsmResult` transaction
- [ ] Telnyx 503 storm with executor retry/backoff (partial: single retry mocked)
- [ ] Payload missing from Redis after enqueue (ingressDispatcher throws — not tested)
- [ ] DLQ replay when payload TTL expired
- [ ] Worker OOM / kill -9 mid-job (only stale reclaim tested in B3)
- [ ] `markWebhookProcessed` failure after successful enqueue (gateway warn path)

### Recovery

- [ ] Full worker process restart with in-flight PEL (B3 partial)
- [ ] API restart during webhook burst
- [ ] Migration rollback validation
- [ ] Feature flag flip mid-call (rollback tests cover skip, not mid-flight)

### Edge cases

- [ ] `callControlId` missing webhook
- [ ] Unknown Telnyx event types (telnyxTriggerMap default null triggers)
- [ ] Invalid FSM transitions under concurrent events
- [ ] `routeSnapshot` version conflict on sidecar update
- [ ] Outbox `renewCommandLease` failure during long Telnyx call
- [ ] Timer `pollExpiredTimers` with many keys (SCAN performance)
- [ ] Domain event handler throws (domainEventBus catches — not tested)
- [ ] Replay log overflow (>5000 events)

### Deployment

- [ ] `scripts/telephony-v3-worker.js` end-to-end smoke in CI with worker container
- [ ] `validate:v3-worker` runtime checks in CI (optional flag)
- [ ] Docker healthcheck script against live Redis

---

## 5. High-Risk Untested Paths

| ID | Path | Why high risk | Current coverage |
|----|------|---------------|------------------|
| **TC-001** | Gateway enqueue succeeds, `markWebhookProcessed` fails | Orphan stream entry + retry duplicate | Not tested |
| **TC-002** | Session/leg cache read path in production | Cache never read; PG on every event | No read-through tests |
| **TC-003** | `conferenceParticipantManager` add/remove/mute | Complex Telnyx command sequences | Indirect via manager only |
| **TC-004** | `queueAgentManager` agent state mutations | Queue fairness under load | Mock agents in queueManager |
| **TC-005** | `routeSnapshotHelper` optimistic merge conflict | Sidecar state corruption risk | Untested |
| **TC-006** | `replayDlqMessages` | Ops recovery path | Untested |
| **TC-007** | `runIngressWorkerLoop` full loop | Production worker core | Partially mocked |
| **TC-008** | `pollExpiredTimers` SCAN sweep | IVR/queue timeouts in prod | Not tested |
| **TC-009** | Real multi-worker same-session ordering | Race on FSM | B3 tests parallel legs only |
| **TC-010** | Executor lease renewal + long Telnyx call | Double execution if renewal fails | Not tested |

---

## 6. Weak Assertions & Test Quality Issues

### Weak assertions (common patterns)

| Pattern | Example | Issue |
|---------|---------|-------|
| `enqueueIntents` called | Router tests | Does not verify command types, idempotency keys, or count |
| `toHaveBeenCalled()` on mocks | CallManager | Does not verify ordering vs persist |
| Source string grep | `workerProduction` SKIP LOCKED check | Proves code exists, not behavior |
| `typeof fn === 'function'` | workerShutdown, phase395 | Structural only |
| All locks mocked to passthrough | callManager*, commandExecutor | Never tests LOCK_TIMEOUT |
| Single health test | healthService | Only not-ready path |

### Duplicate / overlapping tests

| Overlap | Files | Recommendation (backlog) |
|---------|-------|--------------------------|
| Router flow matrix | `e2eValidation` vs individual `*Router.test.ts` | Keep both; e2e is matrix, unit is edge cases |
| Outbox lifecycle | `outboxLifecycle` vs `commandOutbox` vs B3 outbox tests | Consolidate mock lifecycle into one file |
| Gateway duplicate | `gateway.test.ts` | Single file (Windows path duplicate in tooling only) |
| Metrics counters | `metrics.test.ts` | Acceptable; documents all metric names |

### Flaky test risk

| Test | Risk | Mitigation today |
|------|------|------------------|
| `realInfra.test.ts` (when enabled) | Timing, Redis BLOCK 5s, race in parallel tests | `--maxWorkers=1` |
| None observed in default run | 398/398 pass | Stable mocked suite |

### Slow tests

| Test | Duration impact | Notes |
|------|-----------------|-------|
| Full `tests/telephony-v3` | ~20s total | Acceptable |
| `realInfra` (when enabled) | +30–120s est. | PG/Redis I/O, BLOCK waits |
| `e2eValidation` | ~2–5s | Many mocked setups |

---

## 7. Suggested Future Tests (Backlog Only — Do Not Implement in Audit)

### P0 — Production confidence

| ID | Test | Target |
|----|------|--------|
| TB-1 | Enable B3 in default CI (already separate job — verify always green) | realInfra |
| TB-2 | Gateway: enqueue ok + markProcessed fails → idempotent retry | gateway.js |
| TB-3 | routeSnapshotHelper version conflict + merge | routeSnapshotHelper.js |
| TB-4 | replayDlqMessages round-trip with real Redis | replayService.js |
| TB-5 | pollExpiredTimers fires handler (mock Redis SCAN results) | timerService.js |
| TB-6 | conferenceParticipantManager dedicated suite | conferenceParticipantManager.js |
| TB-7 | queueAgentManager dedicated suite | queueAgentManager.js |

### P1 — Concurrency & failure

| ID | Test | Target |
|----|------|--------|
| TB-8 | Two-process worker integration (spawn child worker) | ingressWorker |
| TB-9 | LOCK_TIMEOUT when lock held > TTL | locks.js |
| TB-10 | Optimistic lock exhaust 3 retries → error propagates | callManager |
| TB-11 | Executor lease renewal failure mid-command | commandExecutor |
| TB-12 | Missing ingress payload → DLQ after max delivery | ingressWorker + streams |
| TB-13 | retention + outboxRetention purge counts | Maintenance/ |

### P2 — Completeness

| ID | Test | Target |
|----|------|--------|
| TB-14 | sessionCache/legCache read-through after write | sessionCache, legManager |
| TB-15 | sidecarCoordinator handlePostIngressMedia | sidecarCoordinator |
| TB-16 | healthService all check combinations | healthService |
| TB-17 | tracing span creation (OTEL_ENABLED) | tracing.js |
| TB-18 | E2E with routers on real DB (extend B3 test 10) | integration |
| TB-19 | Load test harness: 100/500 concurrent call simulation | scripts/ |
| TB-20 | Worker container smoke in CI | deploy + docker |

---

## 8. Production Confidence Score

| Dimension | Score (0–100) | Rationale |
|-----------|---------------|-----------|
| Logic correctness (unit) | **85** | 398 tests, broad router/sidecar coverage |
| Data layer correctness | **68** | B3 exists but skipped locally; mocks dominate |
| Runtime worker behavior | **62** | No full loop test; structural worker checks only |
| Failure/recovery | **70** | DLQ mock, B3 crash/reconnect; gaps in TB-1–12 |
| Deployment readiness | **78** | Migration + worker validation scripts |
| **Production confidence** | **73** | |

---

## 9. PASS / FAIL Recommendation

### **CONDITIONAL PASS**

| Criterion | Status |
|-----------|--------|
| Core FSM + CallManager unit coverage | **PASS** |
| Router + sidecar feature coverage | **PASS** |
| Executor + adapter coverage | **PASS** |
| Mocked E2E flow matrix (3.4.5) | **PASS** |
| Real PG/Redis integration default path | **CONDITIONAL** — 20 tests skipped without `V3_INTEGRATION=1` |
| Untested sub-managers (participant, agent) | **GAP** — acceptable for launch with monitoring |
| Full worker runtime proof | **GAP** — mitigated by B2 deploy + B3 CI job |
| Load / concurrency at 1000+ calls | **NOT TESTED** — see performance audit |

### Launch conditions (testing)

1. **`v3-integration` CI job must pass** on every merge to main/development.
2. Run **`npm run test:v3`** (398 tests) before release — currently green.
3. Run **`npm run test:v3:integration`** before GA beyond 500 concurrent calls.
4. Address **TB-6, TB-7, TB-2** in first post-launch hardening sprint.
5. Do not treat mocked router tests as proof of PostgreSQL behavior — rely on B3 for that.

### FAIL would apply if

- B3 integration CI job failing or disabled
- `test:v3` suite below 95% pass rate
- Critical path TC-001 through TC-005 untested **and** B3 not running in CI

---

## Appendix: Test Inventory Summary

| Category | Files | Tests (approx.) |
|----------|-------|-----------------|
| FSM / State machine | 6 | ~35 |
| CallManager / Sessions | 8 | ~35 |
| Routers (desk/mobile/pstn) | 12 | ~90 |
| Sidecars (hold/rec/conf/queue/ivr/vm) | 24 | ~120 |
| Executor / adapter | 4 | ~45 |
| Outbox / command bus | 5 | ~25 |
| Redis / gateway / streams | 6 | ~20 |
| Integration (mocked E2E) | 1 | ~26 |
| Integration (real B3) | 1 | 20 (skipped default) |
| Deployment / hardening | 4 | ~40 |
| Utils (metrics, flags, timer, etc.) | 8 | ~42 |
| **Total** | **~70 unique** | **398 + 20 skipped** |

---

## References

- Test index: `tests/telephony-v3/`
- B3 integration: `docs/vsp/deployment/17-v3-integration-validation.md`
- Performance audit: `docs/vsp/phase3/11-v3-platform-performance-audit.md`
- Phase 3.4.5 E2E: `tests/telephony-v3/integration/e2eValidation.test.ts`
- Run command: `npm run test:v3`
