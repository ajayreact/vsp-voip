# Tenant Portal V3 — Environment Variables

**Version:** v3.0.0-rc1

---

## Portal Gate Flags

| Variable | Default | Layer | Description |
|----------|---------|-------|-------------|
| `V3_PORTAL_ENABLED` | `false` | API | When not truthy, `/api/v3/*` returns 404 |
| `NEXT_PUBLIC_V3_PORTAL` | `false` | Web (build) | Shows V3 nav and enables `/v3/*` routes |

Accepted truthy values: `true`, `1`, `yes`, `on` (case-insensitive).

---

## Runtime Sync (Phase 9)

| Variable | Default | Description |
|----------|---------|-------------|
| `V3_RUNTIME_SYNC_ENABLED` | `false` | Master switch for runtime job enqueue |
| `V3_RUNTIME_SYNC_TENANT_ALLOWLIST` | empty | Comma-separated tenant UUIDs when globally enabled |

When disabled, runtime pages show informational state; no telephony side effects.

---

## Test Lab

| Variable | Default | Description |
|----------|---------|-------------|
| `V3_TEST_LAB_ENABLED` | `false` | Enables Test Lab API and UI |
| `V3_TEST_LAB_ALLOW_PRODUCTION` | `false` | Allow on production hosts (staging only) |

Test Lab blocks `vspphone.com` URLs unless allow-production is set.

---

## Telephony V3 Worker (Separate Stack)

These control `lib/telephony-v3/` — required only when enabling live V3 telephony path:

| Variable | Default |
|----------|---------|
| `TELEPHONY_V3_GLOBAL` | `false` |
| `TELEPHONY_V3_INGRESS_ENABLED` | `false` |
| `TELEPHONY_V3_CALLMANAGER_ENABLED` | `false` |
| `TELEPHONY_V3_EXECUTOR_ENABLED` | `false` |
| `TELEPHONY_V3_OUTBOX_PAUSED` | `false` |
| `TELEPHONY_V3_REDIS_REQUIRED` | `true` |

Worker tuning: `V3_OUTBOX_POLL_MS`, `V3_QUEUE_LAG_MAX_MS`, `V3_WORKER_ID`, etc.  
See `.env.example` lines 44–78.

---

## Shared Infrastructure

| Variable | Required | Notes |
|----------|----------|-------|
| `DATABASE_URL` | Yes | PostgreSQL connection |
| `REDIS_URL` | Yes | Sessions + runtime jobs |
| `JWT_SECRET` | Yes | Auth for all `/api/v3` routes |
| `TELNYX_API_KEY` | Yes | Number sync, provisioning |
| `API_PUBLIC_URL` | Yes | Test Lab host detection |
| `WEB_ORIGIN` | Yes | CORS |

---

## Staging Template

```bash
# Portal
V3_PORTAL_ENABLED=true
NEXT_PUBLIC_V3_PORTAL=true

# Test Lab (staging)
V3_TEST_LAB_ENABLED=true
V3_TEST_LAB_ALLOW_PRODUCTION=true

# Runtime — off until canary
V3_RUNTIME_SYNC_ENABLED=false
V3_RUNTIME_SYNC_TENANT_ALLOWLIST=

# Telephony worker — off for portal-only staging
TELEPHONY_V3_GLOBAL=false
TELEPHONY_V3_EXECUTOR_ENABLED=false
```

---

## Production Template

```bash
V3_PORTAL_ENABLED=true
NEXT_PUBLIC_V3_PORTAL=true
V3_TEST_LAB_ENABLED=false
V3_TEST_LAB_ALLOW_PRODUCTION=false
V3_RUNTIME_SYNC_ENABLED=false
# Enable per-tenant when validated:
# V3_RUNTIME_SYNC_ENABLED=true
# V3_RUNTIME_SYNC_TENANT_ALLOWLIST=<tenant-uuid>
```

---

## Related

- `.env.example`
- [Deployment.md](./Deployment.md)
- [RuntimeSync.md](./RuntimeSync.md)
