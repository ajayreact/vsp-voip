# Performance

Performance considerations for VSP Phone PBX at current scale (pilot / ~10 tenants).

---

## Architecture constraints

| Factor | Current design |
|--------|----------------|
| API instances | Single EC2 Docker container |
| Redis | Single container — session store |
| Postgres | Single container — all tenants |
| Media | Offloaded to Telnyx — not VSP bottleneck |
| Webhooks | Synchronous Express handlers |

---

## Hot paths

1. **Webhook burst** during simultaneous ring — multiple `call.*` events per inbound
2. **Redis read/write** — every webhook touches session
3. **Prisma queries** — DID lookup, extension resolution on `call.initiated`
4. **Winner claim** — Redis SET NX must be sub-ms

---

## Optimizations in place

| Pattern | Location |
|---------|----------|
| Redis session cache | Avoid repeated Postgres during call |
| Atomic SET NX winner | `claimConnectedLeg` |
| Answer side-effects dedup | `claimAnswerSideEffects` |
| Tenant cache | `lib/tenantCache.js` |
| Connection pooling | Prisma + pg |

---

## Webhook timeouts

Telnyx expects webhook response within ~10s. Handlers should:

- Ack quickly after enqueueing Telnyx REST commands
- Avoid long Prisma transactions in webhook path
- Use Redis for ephemeral state, Postgres for durable CDR

Nginx proxy timeouts: 120s read/send on API (`deploy/nginx/vspphone.conf`).

---

## WebRTC client

- `prefetchIceCandidates` — faster first call
- `trickleIce` — progressive ICE
- Reconnect on `telnyx.socket.close` — avoid registration storms with backoff in `scheduleTelnyxReconnect`

---

## Scaling path (future)

| Stage | Change |
|-------|--------|
| 10–50 tenants | Vertical EC2 scale, RDS Postgres |
| 50+ | Multiple API instances **require** Redis (no in-memory fallback) |
| 100+ | ElastiCache Redis, webhook queue (SQS), read replicas |

See [24-future-roadmap.md](./24-future-roadmap.md)

---

## Monitoring

- `/ready` latency — DB ping in `lib/health.js`
- Docker logs — webhook processing time
- Telnyx debugger — carrier-side latency

See [../deployment/13-monitoring.md](../deployment/13-monitoring.md)

---

## Related docs

- [06-session-management.md](./06-session-management.md)
- [23-performance.md](./23-performance.md) → [24-future-roadmap.md](./24-future-roadmap.md)
