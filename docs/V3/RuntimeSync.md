# Tenant Portal V3 — Runtime Sync

**RC1:** v3.0.0-rc1 — **disabled by default**

## Purpose

Phase 9 pushes portal configuration to the telephony-v3 worker via Redis job enqueue. Does not affect legacy Call Control when off.

## Architecture

```
lib/v3/*Service (mutation)
    → lib/v3/runtime/*RuntimeAdapter.js
    → runtimeEnqueue.js
    → Redis / outbox
    → telephony-v3-worker
```

## Adapters (10)

extension, number, ringGroup, queue, callFlow, businessHours, holiday, voicemail, device, base runtimeAdapter

## Feature Flags

```bash
V3_RUNTIME_SYNC_ENABLED=false
V3_RUNTIME_SYNC_TENANT_ALLOWLIST=<uuid>  # canary only
```

## API

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v3/runtime/status` | Sync state |
| GET | `/api/v3/runtime/jobs` | Job list |
| GET | `/api/v3/runtime/health` | Health metrics |
| POST | `/api/v3/runtime/sync` | Trigger sync |
| POST | `/api/v3/runtime/resync` | Full resync |
| POST | `/api/v3/runtime/repair` | Repair links |
| POST | `/api/v3/runtime/jobs/:id/retry` | Retry job |

## UI

`/v3/runtime`, `/v3/runtime/health`, `/v3/runtime/jobs`, `/v3/runtime-validation`

## Enablement Checklist

1. Worker running and healthy
2. Test Lab runtime checks pass on staging
3. Enable for one allowlisted tenant
4. Manual inbound/outbound smoke test
5. Monitor `/api/v3/runtime/health`

## Rollback

Set `V3_RUNTIME_SYNC_ENABLED=false` and restart API. Legacy telephony unaffected.

## RC1 Status

**NO-GO** for production enablement until canary validated.
