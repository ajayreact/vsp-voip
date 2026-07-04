# VSP Phone V3 — Phase 1 Infrastructure + Phase 2 CallManager Foundation

Phase 1 delivers telephony **infrastructure only** (webhook gateway, Redis streams, outbox, worker, health).

Phase 1.5 hardening: PROCESSING outbox claims, per-message stream DLQ, graceful worker shutdown, health thresholds, Redis metrics mirror.

Phase 2 adds **CallManager foundation** — session/leg orchestration, dual FSM, domain event bus, command intents (outbox only), PolicyEngine observe mode. No Desk/Mobile/PSTN routing or Telnyx command execution.

Phase 2.6 hardens CallManager: bootstrap locking, atomic FSM persist, session completion, optimistic-lock retry, command/outbox co-commit.

Phase 3.1 adds the **Telnyx Command Executor** — claims outbox commands, executes via `lib/telnyxCallControl.js` adapter, retries with backoff, dead-letters permanent failures, emits command domain events and Prometheus metrics. Gated by `TELEPHONY_V3_EXECUTOR_ENABLED=false` (default off; stub outbox tick remains until enabled).

Phase 3.2 adds the **Desk Routing Module** — converts desk-originated CallManager events into routing decisions and command intents via `Routing/deskRouter.js`. Gated by tenant `deskEnabled` and global V3 flags. Never calls Telnyx directly; commands enqueue through CommandBus.

Phase 3.3 adds the **Mobile Routing Module** — parallel sidecar for mobile-app-originated calls via `Routing/mobileRouter.js`. Gated by tenant `mobileEnabled`. Supports Mobile→Mobile, Mobile→Desk, and Mobile→PSTN. Never calls Telnyx directly; commands enqueue through CommandBus.

Phase 3.4 adds the **PSTN Routing Module** — parallel sidecar for PSTN-originated and PSTN-terminating calls via `Routing/pstnRouter.js`. Gated by tenant `pstnEnabled`. Supports Incoming PSTN→Desk/Mobile/Ring Group, voicemail stub, and outbound PSTN stub. Never calls Telnyx directly; commands enqueue through CommandBus.

Phase 3.4.5 adds **End-to-End Integration & Canary Validation** — integration tests in `tests/telephony-v3/integration/` validating the full pipeline (CallManager → Routers → CommandBus → Outbox → Executor → Telnyx Adapter), FSM lifecycle, tenant isolation, failure recovery, rollback flags, and observability. Validation only — no new PBX features.

Phase 3.5 adds **Hold & Transfer** — `HoldTransfer/holdManager.js` and `HoldTransfer/transferManager.js` on top of the frozen engine. Gated by tenant `holdEnabled` and `transferEnabled`. Uses existing FSM states (ACTIVE, HELD, TRANSFER_PENDING). Command intents via CommandBus; Telnyx execution via Executor adapter (HOLD, UNHOLD, TRANSFER).

Phase 3.6 adds **Recording & Voicemail** — `Recording/recordingManager.js` and `Voicemail/voicemailManager.js` on top of the frozen engine. Gated by tenant `recordingEnabled` and `voicemailEnabled`. Recording attaches to ACTIVE/BRIDGED legs (no new FSM states). Voicemail executes from routing outcomes (no-answer, busy, DND, policy). Command intents via CommandBus; Telnyx execution via Executor adapter (START_RECORDING, STOP_RECORDING, START_VOICEMAIL, STOP_VOICEMAIL, PLAY_GREETING).

Phase 3.7 adds **Conference Calling** — `Conference/conferenceManager.js` and `Conference/conferenceParticipantManager.js` on top of the frozen engine. Gated by tenant `conferenceEnabled`. Conference metadata in `routeSnapshot.conference` (no new FSM states). Command intents via CommandBus; Telnyx execution via Executor adapter (CREATE_CONFERENCE, ADD/REMOVE_PARTICIPANT, MUTE/UNMUTE, DESTROY_CONFERENCE, BRIDGE, START/STOP_RECORDING).

Phase 3.8 adds **Call Queue & Ring Queue** — `Queue/queueManager.js` and `Queue/queueAgentManager.js` on top of the frozen engine. Gated by tenant `queueEnabled`. Queue metadata in `routeSnapshot.queue` (no new FSM states). Supports ring strategies (ROUND_ROBIN, LEAST_RECENT, RANDOM, SIMULTANEOUS, SEQUENTIAL, LONGEST_IDLE), agent assignment, timeout/retry/overflow, and queue recording compatibility.

Phase 3.9 adds **IVR Engine** — `IVR/ivrManager.js` on top of the frozen engine. Gated by tenant `ivrEnabled`. IVR metadata in `routeSnapshot.ivr` (no new FSM states). Supports multi-level menus, digit collection, business hours/holiday routing, and destinations (extension, queue, ring group, conference, voicemail, operator, disconnect, repeat, submenu). Command intents via CommandBus; Telnyx execution via Executor adapter (PLAY_GREETING, GATHER, DIAL, BRIDGE, START_VOICEMAIL, HANGUP).

## Components

| Module | Purpose |
|--------|---------|
| `WebhookGateway/` | Verify (via server middleware), dedup, normalize, enqueue |
| `Redis/` | Streams, locks, session/leg cache, timers, heartbeat |
| `Workers/` | Ingress consumer + outbox tick; delegates to CallManager when enabled |
| `Outbox/` | Durable command queue |
| `Executor/` | Telnyx command executor + adapter + failure classifier (Phase 3.1) |
| `Routing/` | Desk (3.2), Mobile (3.3), PSTN (3.4) — resolver, policy, command builder |
| `HoldTransfer/` | Hold & Transfer managers, policy, command builders (Phase 3.5) |
| `Recording/` | Call recording manager, policy, command builder (Phase 3.6) |
| `Voicemail/` | Voicemail manager, policy, command builder (Phase 3.6) |
| `Conference/` | Conference manager, participant manager, policy, state (Phase 3.7) |
| `Queue/` | Call queue manager, agent manager, policy, strategy, state (Phase 3.8) |
| `IVR/` | IVR engine, menu resolver, input processor, policy, command builder (Phase 3.9) |
| `CallManager/` | Central orchestration (Phase 2) |
| `Sessions/` | SessionManager + LegManager with optimistic locking |
| `StateMachine/` | Frozen session + leg FSM |
| `Events/` | In-process domain event bus |
| `Commands/` | Command intent enqueue to outbox |
| `Policy/` | PolicyEngine (observe mode only) |
| `FeatureFlags/` | Tenant + global flags |
| `Timer/` | Redis NX timer keys |
| `Health/` | `/ready/v3` aggregation |
| `Session/` | PG + Redis session load (Phase 1 read path) |

## Environment

| Variable | Default | Description |
|----------|---------|-------------|
| `TELEPHONY_V3_INGRESS_ENABLED` | `false` | Enable V3 webhook enqueue route |
| `TELEPHONY_V3_CALLMANAGER_ENABLED` | `false` | Enable Phase 2 CallManager orchestration in worker |
| `TELEPHONY_V3_EXECUTOR_ENABLED` | `false` | Enable Phase 3.1 Telnyx command executor (replaces stub outbox tick) |
| `TELEPHONY_V3_GLOBAL` | `false` | Global V3 engine flag |
| `TELEPHONY_V3_OUTBOX_PAUSED` | `false` | Pause outbox worker tick |
| `TELEPHONY_V3_REDIS_REQUIRED` | `true` | Fail closed without Redis |
| `V3_QUEUE_LAG_MAX_MS` | `60000` | Readiness queue lag threshold |
| `V3_DLQ_DEPTH_MAX` | `1000` | Readiness DLQ depth threshold |
| `V3_OUTBOX_DEAD_MAX` | `100` | Max dead outbox rows before not-ready |
| `V3_PROCESSED_EVENT_RETENTION_DAYS` | `30` | Dedup ledger purge window |
| `V3_METRICS_REDIS_MIRROR` | `true` | Mirror worker metrics to Redis |
| `OTEL_ENABLED` | `false` | OpenTelemetry spans |

## Worker process

```bash
node scripts/telephony-v3-worker.js
```

Enable CallManager locally:

```bash
TELEPHONY_V3_CALLMANAGER_ENABLED=true TELEPHONY_V3_INGRESS_ENABLED=true node scripts/telephony-v3-worker.js
```

Enable Telnyx command execution (Phase 3.1):

```bash
TELEPHONY_V3_EXECUTOR_ENABLED=true TELEPHONY_V3_CALLMANAGER_ENABLED=true TELEPHONY_V3_INGRESS_ENABLED=true node scripts/telephony-v3-worker.js
```

## Health

- `GET /ready/v3` — V3 readiness (Redis, PG, workers, queue, outbox)
- `GET /metrics/v3` — Prometheus text metrics

## Redis keys

See Phase 0.5 Redis RFC — prefix `v3:`.

## Tests

```bash
npm run test:v3
```
