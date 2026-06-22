# Redis Deployment Guide (Production)

Redis is **required in production** for Phase 2A. Without it, rate limiting fails closed, and multi-instance deployments lose shared state.

## What uses Redis

| Feature | Key prefix | TTL |
|---------|------------|-----|
| Tenant number cache | `tenant:num:{e164}` | 24h |
| Call Control sessions | `ccs:{callControlId}` | 1h |
| Greeting dedup | `greet:dedup:{from\|to}` | 15s |
| Rate limits | `rl:{name}:{key}:{bucket}` | window |

## Recommended deployment

### Managed (preferred)

- **AWS:** ElastiCache Redis 7.x, single shard for small deployments
- **GCP:** Memorystore for Redis
- **Azure:** Azure Cache for Redis
- **Railway / Render / Fly:** add Redis add-on

Set:

```env
REDIS_URL=rediss://default:password@your-host:6379
```

Use `rediss://` (TLS) when the provider requires it.

### Docker Compose (staging / self-hosted)

Included in repo root `docker-compose.yml`:

```bash
docker compose up -d redis
export REDIS_URL=redis://localhost:6379
npm start
```

Verify: `GET /ready` → `"redis": { "connected": true }`

## Production checklist

1. `REDIS_URL` set and reachable from API containers
2. `/ready` shows `redis.connected: true` and `ready: true`
3. Run `node scripts/validate-phase2a.js` with `REDIS_URL` set
4. Enable persistence (AOF) if you rely on rate-limit counters across restarts (optional)
5. Set maxmemory policy `allkeys-lru` for cache-heavy workloads

## Stripe webhook secret

Obtain from Stripe Dashboard → Developers → Webhooks → signing secret, or via CLI:

```bash
stripe listen --forward-to localhost:3000/api/billing/webhook
# Copy whsec_... to STRIPE_WEBHOOK_SECRET
```

Subscribe to events:

- `checkout.session.completed`
- `invoice.paid` (optional — no handler yet; deduped only)
- `invoice.payment_failed`
- `customer.subscription.deleted`

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| `/ready` redis false in prod | Check `REDIS_URL`, security groups, TLS |
| 429 on all requests in prod | Redis down — rate limit fail-closed |
| Call Control state lost across instances | Redis not shared or not configured |
