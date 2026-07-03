# Tenant Portal V3 — Runtime Sync

**Version:** v3.0.0-rc1

---

## Purpose

Phase 9 bridges **portal configuration** (Phases 1–8) to the **telephony-v3 worker** (`lib/telephony-v3/`). When enabled, configuration changes enqueue sync jobs that update runtime routing state.

**RC1 default: OFF.** Portal operates in configuration-only mode until explicitly enabled.

---

## Architecture

```
Portal mutation (e.g. ring group save)
        │
        ▼
lib/v3/runtime/*RuntimeAdapter.js
        │
        ▼
lib/v3/runtime/runtimeEnqueue.js  →  Redis stream / outbox
        │
        ▼
telephony-v3-worker processes job
        │
        ▼
lib/telephony-v3/ (CallManager, routers, executor)
```

Adapters exist for: extensions, numbers, ring groups, queues, call flows, business hours, holidays, voicemail, devices.

---

## Feature Flags

```bash
V3_RUNTIME_SYNC_ENABLED=false                    # Master switch
V3_RUNTIME_SYNC_TENANT_ALLOWLIST=uuid1,uuid2     # Optional canary list
```

Logic: `lib/v3/runtime/runtimeFeatureFlag.js`

When globally enabled, only allowlisted tenants sync unless allowlist is empty (all tenants — not recommended for RC1).

---

## UI & API

| Route | Purpose |
|-------|---------|
| `/v3/runtime` | Sync status, job overview |
| `/v3/runtime/health` | Runtime health metrics |
| `/v3/runtime/jobs` | Job listing |
| `/v3/runtime-validation` | Pre-flight validation |

API prefix: `/api/v3/runtime/*`

---

## Validation Before Enable

1. Worker running: `docker compose ps telephony-v3-worker`
2. Worker health: `npm run validate:v3-worker`
3. Run Test Lab runtime checks on staging tenant
4. Run `/v3/runtime-validation` — resolve missing runtime links
5. Enable for **one** tenant via allowlist
6. Manual telephony smoke: inbound, outbound, extension dial

---

## RC1 Status

| Check | Status |
|-------|--------|
| Portal runtime UI | ✅ Shipped |
| Job enqueue plumbing | ✅ Shipped |
| Default enabled | ❌ Disabled |
| Production canary | ⚠️ Not validated in RC1 |
| Live call matrix | ⚠️ Manual staging pending |

---

## Disable / Emergency Stop

```bash
V3_RUNTIME_SYNC_ENABLED=false
docker compose restart api
# Optionally pause outbox:
TELEPHONY_V3_OUTBOX_PAUSED=true
docker compose restart telephony-v3-worker
```

Existing legacy Call Control path remains unaffected.

---

## Related

- [Environment.md](./Environment.md)
- [Troubleshooting.md](./Troubleshooting.md)
- `docs/vsp/deployment/16-telephony-v3-worker.md`
- `docs/vsp/deployment/17-v3-integration-validation.md`
