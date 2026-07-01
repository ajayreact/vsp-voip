# VSP Phone V3 — Platform Performance Audit

**Date:** 2026-07-01  
**Scope:** `lib/telephony-v3/` through Phase 3.9.5 (frozen architecture)  
**Mode:** Read-only audit — no redesign, no optimizations implemented  
**Assumptions:** Production EC2, Docker API + dedicated worker(s), PostgreSQL 16, Redis 7, Telnyx Call Control webhooks

---

## 1. Executive Summary

The V3 telephony engine is **architecturally sound for horizontal scaling**: Redis Streams consumer groups, PostgreSQL `FOR UPDATE SKIP LOCKED` outbox claiming, per-session Redis locks, and optimistic versioning are appropriate production patterns. Correctness and recovery paths (B3 integration validation) are stronger than raw throughput tuning.

**Primary performance characteristic:** The system prioritizes **durability and per-session serialization** over maximum parallel throughput. That is correct for telephony FSM semantics but creates predictable bottlenecks as concurrent call count rises.

**At 100–500 concurrent calls** with 2–4 workers and a right-sized PostgreSQL instance, the platform should operate within health thresholds with monitoring and modest tuning (env vars, worker count).

**At 1,000+ concurrent calls**, queue lag, webhook accept latency, and PostgreSQL connection pressure become the limiting factors without additional workers, API replicas, and connection pool planning.

**At 5,000 concurrent calls**, the current default single-worker deployment and synchronous webhook path are **not sufficient** without a deliberate scale-out plan and optimization backlog execution.

**Verdict:** **CONDITIONAL PASS** for production launch at moderate scale (≤500 concurrent calls with ≥2 workers). **FAIL** at 5,000 concurrent calls without scale-out and backlog work.

---

## 2. Performance Score

| Dimension | Score (0–100) | Notes |
|-----------|---------------|-------|
| Architecture scalability design | 82 | Consumer groups, SKIP LOCKED, idempotency layers |
| Webhook / ingress throughput | 68 | Synchronous PG+Redis path before HTTP 200 |
| Worker / stream processing | 74 | Sequential in-batch; scales with worker count |
| PostgreSQL efficiency | 70 | Good indexes; cache bypass on hot path |
| Redis efficiency | 76 | External payload storage; SCAN-based timers |
| Executor throughput | 72 | Session-serialized; Telnyx-bound |
| Observability overhead | 78 | Bounded metrics; health checks moderate cost |
| Multi-worker behavior | 80 | Proven SKIP LOCKED + consumer groups (B3) |
| **Overall performance score** | **74** | Production-ready at moderate scale |

---

## 3. Bottleneck Analysis

### Load model (Telnyx event rates)

Assume ~8–15 Call Control events per call lifecycle (initiated, ringing, answered, bridged, hangup, media, recording, etc.).

| Concurrent calls | Sustained events/sec (est.) | Burst events/sec (est.) |
|------------------|----------------------------|-------------------------|
| 100 | 15–40 | 150–400 |
| 500 | 75–200 | 750–2,000 |
| 1,000 | 150–400 | 1,500–4,000 |
| 5,000 | 750–2,000 | 7,500–20,000 |

### Expected bottlenecks by tier

| Tier | First bottleneck | Second bottleneck | Third bottleneck |
|------|------------------|-------------------|------------------|
| 100 | Single worker ingress loop (if 1 worker) | PG dedup on webhook path | — |
| 500 | Webhook synchronous path (1 API) | Worker sequential processing | Session lock wait under hot sessions |
| 1,000 | PostgreSQL connections (API + N workers) | Redis stream depth / lag | Outbox executor Telnyx latency |
| 5,000 | API webhook accept rate | PG write amplification | Queue depth → `/ready/v3` false |

### Critical path diagram

```
Telnyx webhook
  → API: PG dedup read → Redis payload SET → Redis XADD → PG dedup write  [SYNC ~15–40ms]
  → Worker: XREADGROUP → load payload → CallManager [PG×3–6 + session lock]
    → FSM transaction [PG tx: session + leg + transitions + outbox inserts]
    → Domain events [in-process sync subscribers]
  → Outbox tick (500ms): claim 50 → executor [session lock + Telnyx HTTP ~200–800ms each]
```

---

## 4. Database Performance Review

### Index coverage (V3 tables)

| Table | Indexes | Assessment |
|-------|---------|------------|
| `V3CommandOutbox` | `(status, nextAttemptAt)`, `(status, claimedUntil)`, `idempotencyKey` unique | **Good** — supports claim + reclaim |
| `V3CallSession` | tenant+state, tenant+createdAt, telnyxCallSessionId, primaryCallControlId | **Good** |
| `V3CallLeg` | `callControlId` unique, sessionId, sessionId+role | **Good** |
| `ProcessedTelnyxEvent` | processedAt, callControlId, tenantId+processedAt | **Good** for dedup/purge |
| `V3SessionTransition` / `V3LegTransition` | session/leg + occurredAt | **Good** for audit reads |

### Missing / weak indexes

| Issue | Severity | Detail |
|-------|----------|--------|
| No index on `ProcessedTelnyxEvent.callSessionId` | Medium | `replaySessionEvents` filters by `callSessionId` — seq scan at scale |
| No partial index on active sessions | Low | `(state) WHERE state NOT IN ('ENDED','FAILED')` would help ops queries |
| `routeSnapshot` JSONB unindexed | Low | Expected — not queried by JSON path today |

### Transaction patterns

- **Strength:** `callPersistence.persistCallFsmResult` co-commits FSM writes + outbox inserts in one `$transaction`.
- **Weakness:** `loadSession` always `include: { legs: true }` even when only session fields needed — extra join payload on every CallManager event.
- **Weakness:** `sessionCache` / `legCache` written after persist but **not read** on CallManager hot path — every event hits PostgreSQL.

### N+1 and redundant query risks

| Pattern | Location | Impact |
|---------|----------|--------|
| Leg + session load per ingress event | `callManager.js`, `sessionManager.js`, `legManager.js` | 2+ queries/event |
| Bootstrap triple `loadSession` | `callManager.bootstrapSessionAndLeg` | 3× read on new call |
| `resolveCommandContext` per command | `commandExecutor.js` | 2 queries/command |
| `updateMany` + `findUnique` after outbox write | `commandOutbox.js` | Extra round-trip |
| `countOutboxByStatus` × 5 on health probe | `commandOutbox.js`, `healthService.js` | 5 COUNT queries per `/ready/v3` |
| Feature sidecars read `routeSnapshot` separately | IVR, queue, conference managers | 2 queries per sidecar update |

### Connection pooling

- `db.js` uses `@prisma/adapter-pg` with a **singleton** `PrismaClient` per Node process.
- **No explicit pool size** configured — defaults to `pg` pool (~10 connections/process).
- **Impact:** API (1 process) + N workers (N processes) × ~10 = connection count grows linearly with workers. At 10 workers + API ≈ 110 connections — within typical PG limits but needs monitoring at scale.

### Slow query risks

- Outbox claim uses raw SQL with subquery + `FOR UPDATE SKIP LOCKED` — efficient at moderate depth; degrades if millions of PENDING rows (retention mitigates).
- Transition audit tables grow unbounded per call — indexed by `occurredAt` for purge but no automated retention job in worker maintenance loop (only processed events + outbox purge).

---

## 5. Redis Performance Review

### Streams

| Setting | Value | Assessment |
|---------|-------|------------|
| Ingress MAXLEN | ~100,000 (approx) | Prevents unbounded memory; may drop under extreme overload |
| DLQ MAXLEN | ~50,000 | Adequate |
| Read batch | 10 messages | Conservative — limits burst absorption per worker iteration |
| BLOCK | 5000ms | Good for CPU; adds up to 5s latency on sparse queues |
| Stale reclaim | 60s idle | Appropriate crash recovery |

### Payload storage

- Full webhook JSON stored as Redis STRING (`v3:ingress:payload:{sha256}`), TTL 24h.
- Stream carries metadata only — **good** for stream efficiency.
- **Cost:** Double `JSON.stringify` on ingress (hash + store) — CPU overhead at high webhook rates.

### Locks

- Session lock: `SET NX EX 30` with 3 retries, backoff 50/100/150ms.
- Bootstrap lock per `callControlId` — serializes concurrent `call.initiated`.
- **Contention:** Hot sessions (transfer, conference, IVR) serialize FSM + executor — by design.

### Timer service

- Uses **SCAN** over `v3:timer:*` keys every ~10 worker loop iterations — O(keyspace) per worker.
- **Multi-worker duplication:** Every worker runs timer poll + maintenance purge — redundant work scales with worker count.

### Command efficiency

| Operation | Frequency | Concern |
|-----------|-----------|---------|
| XREADGROUP + XACK | Per ingress job | Low |
| GET payload | Per ingress job | Low |
| SET heartbeat + SADD index | Every worker loop | Low |
| SCAN timers | Every ~10 loops × workers | Medium at scale |
| Metrics mirror INCRBY | Per metric increment | Low if mirror enabled |

### Recovery (Redis restart)

- B3 validated: ioredis reconnect + heartbeat restoration within ~30s.
- In-flight PEL entries reclaimed after 60s stale threshold.
- **Impact:** Up to 60s delayed processing for in-flight messages during Redis outage.

---

## 6. Worker Performance Review

### Throughput model (single worker)

| Stage | Estimated rate | Limiting factor |
|-------|----------------|-----------------|
| Ingress read | Up to 10 jobs/block | BLOCK 5s wait |
| Ingress process | 5–20 jobs/sec | Sequential await + CallManager PG |
| Outbox tick | 2 ticks/sec (500ms poll) | Poll interval |
| Outbox execute | 2–10 commands/sec | Telnyx HTTP + session lock |

### Scaling formula (approximate)

```
ingress_capacity ≈ workers × (5–20 events/sec)
outbox_capacity ≈ workers × (2–10 commands/sec)
```

| Workers | Ingress capacity (est.) | Outbox capacity (est.) |
|---------|-------------------------|------------------------|
| 1 | 5–20 /s | 2–10 /s |
| 4 | 20–80 /s | 8–40 /s |
| 10 | 50–200 /s | 20–100 /s |
| 20 | 100–400 /s | 40–200 /s |

### Maintenance overhead

Every worker independently runs:
- Timer SCAN (every ~10 loops)
- Processed event purge (every 120 loops)
- Outbox row purge (every 120 loops)

At 10+ workers, duplicate purge work is wasteful but not correctness-critical.

### Queue depth behavior

Health thresholds (`constants.js`):
- Queue depth max: 10,000
- Queue lag max: 60,000ms
- DLQ depth max: 1,000
- Outbox dead max: 100

At 500 concurrent calls with 1 worker, sustained lag likely exceeds 60s during bursts → `/ready/v3` not-ready.

---

## 7. Executor Performance Review

### Batch processing

- Claims up to **50** commands per tick via SKIP LOCKED.
- Groups by `sessionId`, executes **sequentially** within group.
- **Single `outboxTickInFlight` mutex** — one batch at a time per worker process.

### Session lock stacking

- CallManager holds session lock during FSM persist.
- Executor acquires session lock again per command (2 retries).
- Long Telnyx operations (DIAL, BRIDGE) hold lock for HTTP duration.
- Lease renewal every 10s prevents outbox reclaim but **blocks other session work**.

### Telnyx adapter (dominant latency)

- Executor throughput is **Telnyx-bound**, not CPU-bound.
- Mock-free production: 200–800ms per command typical.
- 50 commands sequential ≈ 10–40 seconds per batch worst case.

### Domain events during execution

- Each command publishes STARTED/COMPLETED/FAILED synchronously.
- Routers subscribe and may enqueue more commands — cascading work in same process.

---

## 8. Memory Analysis

| Component | Bound | Per-worker estimate | Risk |
|-----------|-------|---------------------|------|
| Domain event replay log | 5,000 events | ~1–5 MB | Low |
| Metrics histograms | 1,000 samples/label | ~1–10 MB | Low |
| In-flight ingress Set | ≤ batch size (10) | Negligible | Low |
| `routeSnapshot` in PG | Unbounded JSON | 5–50 KB/call | Medium — long IVR/queue calls |
| Outbox payload JSON | Grows with execution metadata | 1–10 KB/command | Low |
| ioredis buffer | Connection-dependent | ~1–5 MB | Low |
| Prisma client | Query result caching minimal | ~10–30 MB | Low |

**Node.js worker RSS estimate:** 80–150 MB idle; 150–300 MB under load.

**Risk:** `routeSnapshot` accumulation on long-running calls (conference + queue + IVR nested state) increases PG row size and merge CPU. `sessionCleanup` clears sidecar keys on session close — mitigates if ENDED path always runs.

---

## 9. CPU Analysis

| Hotspot | Cause | Severity |
|---------|-------|----------|
| JSON.stringify (webhook) | Payload hash + Redis store | Medium at >500 evt/s |
| JSON merge (routeSnapshot) | Read-modify-write per sidecar update | Medium on complex calls |
| Sequential ingress loop | No parallel job processing | Medium — scales with workers not threads |
| Timer SCAN | Full prefix scan per worker | Medium at 10+ workers |
| Domain event sync handlers | Router work inline on publish | Medium during routing storms |
| Prometheus mirror SCAN | `/metrics/v3` render | Low unless high cardinality |

**CPU scaling:** Worker processes are single-threaded Node event loop. Scale **horizontally** (more worker containers), not vertically on CPU cores per process.

---

## 10. Scalability Assessment

### Horizontal scaling (designed for)

| Layer | Scale mechanism | Limit |
|-------|-----------------|-------|
| API / webhook | Multiple API replicas (stateless enqueue) | PG dedup write contention |
| Workers | `docker compose scale telephony-v3-worker=N` | Unique consumer names; shared consumer group |
| Outbox | SKIP LOCKED across workers | Telnyx rate limits; session lock serialization |
| Redis | Single primary (current) | Stream single-threaded; Redis CPU ceiling |
| PostgreSQL | Vertical scale + read replicas (not used for writes) | Write throughput ceiling |

### Multi-worker contention (validated B3)

- **Ingress:** Consumer group distributes messages — no duplicate processing.
- **Outbox:** SKIP LOCKED — disjoint claims.
- **Session bootstrap:** Redis bootstrap lock prevents duplicate legs.
- **FSM:** Optimistic lock + retry (max 3) handles concurrent events on same session.

### Recovery behavior

| Event | Recovery time | Data risk |
|-------|---------------|-----------|
| Redis restart | ~5–30s reconnect; 60s stale reclaim | In-flight PEL delayed |
| PostgreSQL restart | Prisma reconnect on next query | Committed rows safe (B3) |
| Worker crash | Stale claim 60s; outbox lease 30s | At-least-once; idempotency protects |

### Scale targets (recommended worker count)

| Concurrent calls | Recommended workers | API replicas | Notes |
|------------------|---------------------|--------------|-------|
| 100 | 1–2 | 1 | Default deployment OK |
| 500 | 3–5 | 1–2 | Monitor queue lag |
| 1,000 | 6–12 | 2 | PG connection planning required |
| 5,000 | 25–50+ | 4+ | Requires backlog + Redis/PG sizing |

---

## 11. Production Readiness Score (Performance)

| Criterion | Weight | Score | Weighted |
|-----------|--------|-------|----------|
| Meets SLA at 100 calls | 25% | 90 | 22.5 |
| Meets SLA at 500 calls | 25% | 75 | 18.75 |
| Meets SLA at 1,000 calls | 20% | 60 | 12.0 |
| Meets SLA at 5,000 calls | 10% | 35 | 3.5 |
| Recovery / correctness under load | 10% | 85 | 8.5 |
| Observability for perf tuning | 10% | 80 | 8.0 |
| **Total** | 100% | — | **73.25** |

**Production readiness (performance): 73/100 — CONDITIONAL PASS**

---

## 12. Issue Register

### Critical

*None identified that affect correctness under load. Architecture idempotency and locking prevent data corruption at scale. Performance degradation manifests as lag/timeouts, not silent corruption.*

### High

#### V3-PERF-001 — Synchronous webhook path before HTTP 200

| Field | Detail |
|-------|--------|
| **Why** | `handleV3WebhookIngress` awaits PG dedup read, Redis payload write, Redis XADD, PG dedup insert before responding (`gateway.js`, `replayService.js`). |
| **Production impact** | At 500+ concurrent calls, webhook accept latency may exceed Telnyx timeout → retries → duplicate dedup load → amplified ingress. |
| **Recommended fix** | Future: optional fast-accept mode (Redis dedup first, async PG mark) behind feature flag — **architecture change, backlog only**. Short-term: scale API replicas + PG read replica for dedup reads. |
| **Priority** | P1 |

#### V3-PERF-002 — Session/leg cache bypass on CallManager hot path

| Field | Detail |
|-------|--------|
| **Why** | `sessionManager.loadSession` and `legManager.findLegByCallControlId` always query PostgreSQL; caches are write-through only. |
| **Production impact** | 2–4 PG queries per webhook event × event rate = primary DB load driver. |
| **Recommended fix** | Backlog: read-through cache with version validation or cache-aside after persist. |
| **Priority** | P1 |

#### V3-PERF-003 — Sequential ingress job processing

| Field | Detail |
|-------|--------|
| **Why** | Worker reads batch of 10 but processes with `await` in serial loop (`ingressWorker.js`). |
| **Production impact** | Single worker caps at ~5–20 events/sec regardless of CPU headroom. |
| **Recommended fix** | Backlog: limited parallelism (2–4 in-flight) with same-session ordering preserved via lock. |
| **Priority** | P1 |

#### V3-PERF-004 — Single outbox tick in flight per worker

| Field | Detail |
|-------|--------|
| **Why** | `outboxTickInFlight` mutex prevents overlapping executor batches (`ingressWorker.js`). |
| **Production impact** | Executor throughput capped at one batch per poll interval per worker. |
| **Recommended fix** | Backlog: pipeline claim vs execute or reduce poll interval via `V3_OUTBOX_POLL_MS`. |
| **Priority** | P2 |

### Medium

#### V3-PERF-005 — Timer SCAN on every worker

| Field | Detail |
|-------|--------|
| **Why** | `pollExpiredTimers` uses SCAN over all timer keys; each worker runs independently. |
| **Production impact** | Redis CPU grows with workers × active timers (IVR timeouts, queue timeouts). |
| **Recommended fix** | Backlog: Redis keyspace notifications, dedicated timer worker, or sorted-set schedule. |
| **Priority** | P2 |

#### V3-PERF-006 — Duplicate maintenance on all workers

| Field | Detail |
|-------|--------|
| **Why** | Purge jobs run every 120 loops on every worker (`ingressWorker.js`). |
| **Production impact** | Redundant PG DELETE load scales with worker count. |
| **Recommended fix** | Backlog: leader election or dedicated maintenance sidecar. |
| **Priority** | P3 |

#### V3-PERF-007 — routeSnapshot unbounded growth

| Field | Detail |
|-------|--------|
| **Why** | JSON merge accumulates conference/queue/IVR/hold state (`routeSnapshotHelper.js`, feature managers). |
| **Production impact** | Larger PG rows → slower reads/writes; higher memory on session load. |
| **Recommended fix** | Backlog: size cap, prune on sidecar completion, selective fields. |
| **Priority** | P2 |

#### V3-PERF-008 — Health probe cost

| Field | Detail |
|-------|--------|
| **Why** | `/ready/v3` runs 5 outbox COUNTs, stream info, N heartbeat GETs (`healthService.js`). |
| **Production impact** | Expensive if probed every 5–15s by multiple orchestrators. |
| **Recommended fix** | Backlog: cache health snapshot 5s; lightweight `/health` vs full `/ready/v3`. |
| **Priority** | P3 |

#### V3-PERF-009 — Missing index on ProcessedTelnyxEvent.callSessionId

| Field | Detail |
|-------|--------|
| **Why** | Session replay queries filter by `callSessionId` without index. |
| **Production impact** | Slow replay ops at high dedup table size (30-day retention). |
| **Recommended fix** | Backlog migration: `@@index([callSessionId])`. |
| **Priority** | P3 |

#### V3-PERF-010 — No explicit PG pool tuning

| Field | Detail |
|-------|--------|
| **Why** | Default `pg` pool per process (~10 connections). |
| **Production impact** | Connection exhaustion or under-utilization at scale. |
| **Recommended fix** | Document and tune `connection_limit` per API/worker; monitor `pg_stat_activity`. |
| **Priority** | P2 |

### Low

#### V3-PERF-011 — Double JSON.stringify on ingress

| Field | Detail |
|-------|--------|
| **Why** | Hash and store both stringify payload (`streams.js`). |
| **Production impact** | Minor CPU at moderate rates. |
| **Recommended fix** | Backlog: stringify once, reuse buffer. |
| **Priority** | P4 |

#### V3-PERF-012 — Domain event in-process only

| Field | Detail |
|-------|--------|
| **Why** | `domainEventBus` is per-process memory (`domainEventBus.js`). |
| **Production impact** | Routers only fire in worker that processed event; acceptable by design. |
| **Recommended fix** | None required unless cross-worker event fan-out needed. |
| **Priority** | P4 |

#### V3-PERF-013 — Metrics histogram sample cap

| Field | Detail |
|-------|--------|
| **Why** | 1,000 samples per label combo (`metrics.js`). |
| **Production impact** | Tail latency under-represented in Prometheus render. |
| **Recommended fix** | Backlog: exponential histogram buckets. |
| **Priority** | P4 |

#### V3-PERF-014 — HIGH unused constant

| Field | Detail |
|-------|--------|
| **Why** | `HEALTH.OUTBOX_PROCESSING_STALE_SEC` defined but unused. |
| **Production impact** | None operational; missed readiness signal opportunity. |
| **Recommended fix** | Backlog: wire into health or remove. |
| **Priority** | P4 |

#### V3-PERF-015 — Verbose info logging on hot path

| Field | Detail |
|-------|--------|
| **Why** | `v3Logger.info` on every ingress, FSM, domain event, command. |
| **Production impact** | Disk I/O under load if log level info in production. |
| **Recommended fix** | Ensure `LOG_LEVEL=warn` in production workers; structured sampling for debug. |
| **Priority** | P3 |

---

## 13. Recommended Optimization Backlog (Future Work Only)

| ID | Item | Priority | Effort | Prerequisite |
|----|------|----------|--------|--------------|
| OB-1 | Read-through session/leg Redis cache on CallManager path | P1 | M | Phase 4 perf sprint |
| OB-2 | Webhook fast-accept + async durable mark (feature-flagged) | P1 | L | Architect ADR |
| OB-3 | Limited parallel ingress processing (per-session ordering) | P1 | M | Load test validation |
| OB-4 | Horizontal worker autoscaling on queue lag metric | P1 | S | K8s/compose + metrics |
| OB-5 | Timer service: sorted set or keyspace notifications | P2 | M | — |
| OB-6 | Dedicated maintenance leader for purge jobs | P3 | S | — |
| OB-7 | routeSnapshot size cap + aggressive cleanup | P2 | M | — |
| OB-8 | PG pool sizing documentation + env tuning | P2 | S | — |
| OB-9 | Index on `ProcessedTelnyxEvent.callSessionId` | P3 | S | Migration |
| OB-10 | Health probe result caching (5s TTL) | P3 | S | — |
| OB-11 | Transition table retention job | P2 | M | — |
| OB-12 | Load test harness: 500/1000/5000 call simulation | P1 | L | k6 or custom |

**No backlog items implemented in this audit.**

---

## 14. Final Verdict

| Question | Answer |
|----------|--------|
| **PASS / FAIL for production performance** | **CONDITIONAL PASS** |
| **Safe launch scale** | ≤ **500 concurrent calls** with **≥3 workers**, monitored `/ready/v3` |
| **Not ready without scale-out** | **1,000+** calls on default 1-worker deploy |
| **Fail at target** | **5,000 concurrent calls** without OB-1–OB-4 and infrastructure sizing |

### Launch conditions (performance)

1. Deploy **≥2 telephony-v3-worker** replicas (B2 complete).
2. Set `LOG_LEVEL=warn` on workers in production.
3. Monitor `/ready/v3` queue depth, lag, DLQ, outbox dead.
4. Run `npm run test:v3:integration` in CI (B3) on every release.
5. Document PG `max_connections` vs (API + workers × pool size).
6. Execute load test to 2× expected peak before GA beyond 500 calls.

---

## References

- Architecture: `lib/telephony-v3/README.md`
- Constants: `lib/telephony-v3/constants.js`
- B2 worker service: `docs/vsp/deployment/16-telephony-v3-worker.md`
- B3 integration validation: `docs/vsp/deployment/17-v3-integration-validation.md`
- Platform perf (non-V3): `docs/vsp/phase3/03-performance-audit.md`
