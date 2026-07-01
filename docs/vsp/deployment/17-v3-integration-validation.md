# V3 Integration Validation (B3)

Production-style validation of the VSP Phone V3 engine against **real PostgreSQL** and **real Redis**. No mocks for database or Redis in these tests. Telnyx HTTP is mocked only in the end-to-end executor scenario.

Related: [16-telephony-v3-worker.md](./16-telephony-v3-worker.md), [14-telephony-validation.md](./14-telephony-validation.md)

---

## What is validated

| # | Scenario | Validates |
|---|----------|-----------|
| 1 | Webhook → Gateway → Redis | Accept, payload storage, stream enqueue, `ProcessedTelnyxEvent`, duplicate rejection |
| 2 | Redis consumer group | Group creation, delivery, ACK, pending list |
| 3 | CallManager pipeline | Worker → session/leg bootstrap, FSM transition, outbox rows |
| 4 | PostgreSQL transactions | Optimistic locking, rollback, duplicate replay, version retry, persistence |
| 5 | Outbox lifecycle | PENDING → PROCESSING → SENT → ACKED, FAILED, DEAD, lease reclaim |
| 6 | Multi-worker | Disjoint SKIP LOCKED claims, consumer group distribution, no duplicate legs |
| 7 | Crash recovery | Stale ingress reclaim after simulated worker death |
| 8 | Redis restart | Client reconnect + heartbeat restoration |
| 9 | Database restart | Prisma reconnect + committed row integrity |
| 10 | E2E pipeline | Gateway → Worker → CallManager → CommandBus → Outbox → Executor (mock Telnyx) |
| 11 | Performance | Webhook, worker, transaction, outbox timing summary |

Unit tests with mocks remain in `tests/telephony-v3/` for fast feedback. B3 tests prove the **infrastructure path** works with real services.

---

## Infrastructure

### Docker Compose (local)

[`docker-compose.integration.yml`](../../../docker-compose.integration.yml):

| Service | Port | Purpose |
|---------|------|---------|
| `postgres-integration` | 5433 | Dedicated integration DB |
| `redis-integration` | 6380 | Dedicated integration Redis |

### Environment

| Variable | Required | Default (docker script) |
|----------|----------|-------------------------|
| `V3_INTEGRATION` | Yes | `1` |
| `DATABASE_URL` | Yes | `postgresql://vsp:vsp@localhost:5433/vsp_voip_integration` |
| `REDIS_URL` | Yes | `redis://localhost:6380` |
| `TELEPHONY_V3_*` flags | Yes | all `true` in runner script |

---

## Commands

### Full run (starts Docker, migrates, tests)

```bash
npm run test:v3:integration
```

### Use existing PostgreSQL + Redis (CI / manual)

```bash
export V3_INTEGRATION=1
export DATABASE_URL=postgresql://vsp:vsp@localhost:5432/vsp_voip_test
export REDIS_URL=redis://localhost:6379
export TELEPHONY_V3_GLOBAL=true
export TELEPHONY_V3_INGRESS_ENABLED=true
export TELEPHONY_V3_CALLMANAGER_ENABLED=true
export TELEPHONY_V3_EXECUTOR_ENABLED=true

npx prisma migrate deploy
npm run test:v3:integration:vitest
```

### Skip Docker (services already running)

```bash
npm run test:v3:integration -- --no-docker
```

---

## Expected output

Successful run ends with:

```
✓ tests/telephony-v3/integration/realInfra.test.ts (N tests)

=== V3 Integration Timing Summary ===
{
  "webhook_gateway": { "count": 1, "minMs": ..., "avgMs": ..., "p95Ms": ... },
  "worker_process": { ... },
  "outbox_claim": { ... },
  "webhook_latency": { ... },
  "worker_latency": { ... }
}

==> V3 integration tests PASSED
```

When `V3_INTEGRATION` is unset, tests skip with a single passing skip assertion.

---

## Failure scenarios tested

| Failure | Test behavior |
|---------|---------------|
| Duplicate Telnyx event ID | Gateway returns `duplicate: true`, no second stream entry |
| Stale session version | `V3ConflictError` on optimistic lock |
| Simulated transaction failure | Session state unchanged, no orphan transition |
| Expired outbox lease | `recovery-worker` reclaims PROCESSING row |
| Max outbox attempts | Row transitions to DEAD |
| Redis client reset | Reconnect + heartbeat restored |
| Prisma disconnect | Reconnect preserves committed session |
| Stale ingress PEL entry | XAUTOCLAIM / XCLAIM + single processing |

---

## CI

GitHub Actions job **`v3-integration`** in [`.github/workflows/ci.yml`](../../../.github/workflows/ci.yml):

1. PostgreSQL 16 + Redis 7 service containers
2. `npm run validate:migrations`
3. `npx prisma migrate deploy`
4. `npm run test:v3:integration:vitest`

---

## Rollback strategy

B3 adds **tests and tooling only**. No production telephony logic changes.

| If… | Action |
|-----|--------|
| Integration tests fail in CI | Block merge; fix infra defect or test harness — do not disable without architect sign-off |
| Integration tests fail locally | Verify Docker ports 5433/6380 free; run `docker compose -f docker-compose.integration.yml down -v` and retry |
| False positive after schema change | Run `npx prisma migrate deploy` on integration DB; update tests only if schema contract changed |
| Need to bypass temporarily | Do **not** merge with `V3_INTEGRATION` disabled in CI — use `describe.skip` only on feature branches under review |

Production rollback unaffected — see [08-rollback.md](./08-rollback.md).

---

## Files

| Path | Purpose |
|------|---------|
| `docker-compose.integration.yml` | Local PG + Redis |
| `scripts/run-v3-integration-tests.js` | Orchestrator |
| `tests/telephony-v3/integration/realInfra.js` | Harness helpers |
| `tests/telephony-v3/integration/realInfra.test.ts` | B3 test suite |
| `db.js` | `disconnectPrisma()` for reconnect tests |
