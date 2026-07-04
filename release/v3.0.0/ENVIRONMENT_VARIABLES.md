# V3.0.0 — Environment Variables

## Portal Gate

| Variable | Default | Layer | Description |
|----------|---------|-------|-------------|
| `V3_PORTAL_ENABLED` | `false` | API | `/api/v3/*` returns 404 when off |
| `NEXT_PUBLIC_V3_PORTAL` | `false` | Web build | Shows V3 nav and `/v3/*` routes |

## Runtime Sync

| Variable | Default | Description |
|----------|---------|-------------|
| `V3_RUNTIME_SYNC_ENABLED` | `false` | Master sync switch |
| `V3_RUNTIME_SYNC_TENANT_ALLOWLIST` | empty | Comma-separated tenant UUIDs |

## Test Lab

| Variable | Default | Description |
|----------|---------|-------------|
| `V3_TEST_LAB_ENABLED` | `false` | Enables Test Lab |
| `V3_TEST_LAB_ALLOW_PRODUCTION` | `false` | Staging override only |

## Telephony V3 Worker (Separate Stack)

| Variable | Default |
|----------|---------|
| `TELEPHONY_V3_GLOBAL` | `false` |
| `TELEPHONY_V3_INGRESS_ENABLED` | `false` |
| `TELEPHONY_V3_CALLMANAGER_ENABLED` | `false` |
| `TELEPHONY_V3_EXECUTOR_ENABLED` | `false` |
| `TELEPHONY_V3_OUTBOX_PAUSED` | `false` |
| `TELEPHONY_V3_REDIS_REQUIRED` | `true` |
| `V3_OUTBOX_POLL_MS` | `500` |
| `V3_WORKER_ID` | optional |

## Shared Infrastructure

| Variable | Required |
|----------|----------|
| `DATABASE_URL` | Yes |
| `REDIS_URL` | Yes |
| `JWT_SECRET` | Yes |
| `TELNYX_API_KEY` | Yes |
| `API_PUBLIC_URL` | Yes |
| `WEB_ORIGIN` | Yes |

## Production Template (Portal Only)

```bash
V3_PORTAL_ENABLED=true
NEXT_PUBLIC_V3_PORTAL=true
V3_RUNTIME_SYNC_ENABLED=false
V3_TEST_LAB_ENABLED=false
TELEPHONY_V3_GLOBAL=false
```

## Staging Template

```bash
V3_PORTAL_ENABLED=true
NEXT_PUBLIC_V3_PORTAL=true
V3_TEST_LAB_ENABLED=true
V3_TEST_LAB_ALLOW_PRODUCTION=true
V3_RUNTIME_SYNC_ENABLED=false
```
